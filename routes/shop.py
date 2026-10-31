"""B5 cart and checkout, B7 buyer order history."""
from collections import defaultdict

from flask import Blueprint, g, jsonify

from db import execute, query, query_one, transaction
from helpers import ApiError, body, int_field, login_required

bp = Blueprint("shop", __name__, url_prefix="/api")


def get_cart_id(user_id):
    """The buyer's open cart (orders row with placed_at NULL), created on first use.
    It lives in the database, so it persists across sessions and devices."""
    execute(
        """
        INSERT INTO orders (buyer_id) VALUES (%s)
        ON CONFLICT (buyer_id) WHERE placed_at IS NULL DO NOTHING
        """,
        (user_id,),
    )
    return query_one(
        "SELECT id FROM orders WHERE buyer_id = %s AND placed_at IS NULL", (user_id,)
    )["id"]


def cart_lines(cart_id):
    lines = query(
        """
        SELECT li.item_id, li.quantity, i.name, i.price, i.quantity AS stock,
               i.is_active, i.seller_id, u.full_name AS seller_name,
               li.quantity * i.price AS line_total
        FROM line_items li
        JOIN items i ON i.id = li.item_id
        JOIN users u ON u.id = i.seller_id
        WHERE li.order_id = %s
        ORDER BY li.id
        """,
        (cart_id,),
    )
    for line in lines:
        if not line["is_active"]:
            line["problem"] = "this listing has been removed"
        elif line["stock"] == 0:
            line["problem"] = "out of stock"
        elif line["quantity"] > line["stock"]:
            line["problem"] = f"only {line['stock']} in stock"
        else:
            line["problem"] = None
    return lines


@bp.get("/cart")
@login_required
def view_cart():
    cart_id = get_cart_id(g.user["id"])
    lines = cart_lines(cart_id)
    total = sum(line["line_total"] for line in lines)
    return jsonify(
        cart_id=cart_id,
        lines=lines,
        total=total,
        item_count=sum(line["quantity"] for line in lines),
        balance=g.user["balance"],
        balance_after_checkout=g.user["balance"] - total,
        can_checkout=bool(lines)
        and all(line["problem"] is None for line in lines)
        and g.user["balance"] >= total,
    )


@bp.post("/cart/items")
@login_required
def add_to_cart():
    data = body()
    item_id = int_field(data, "item_id")
    quantity = int_field(data, "quantity", required=False, min_value=1, max_value=10000) or 1
    item = query_one("SELECT seller_id, quantity, is_active FROM items WHERE id = %s", (item_id,))
    if item is None or not item["is_active"]:
        raise ApiError("item not found", 404)
    if item["seller_id"] == g.user["id"]:
        raise ApiError("you cannot buy your own listing")
    if item["quantity"] == 0:
        raise ApiError("this item is out of stock")
    cart_id = get_cart_id(g.user["id"])
    with transaction():
        row = query_one(
            """
            INSERT INTO line_items (order_id, item_id, quantity) VALUES (%s, %s, %s)
            ON CONFLICT (order_id, item_id)
            DO UPDATE SET quantity = line_items.quantity + EXCLUDED.quantity
            RETURNING quantity
            """,
            (cart_id, item_id, quantity),
        )
        if row["quantity"] > item["quantity"]:
            raise ApiError(f"only {item['quantity']} in stock")
    return jsonify(item_id=item_id, quantity=row["quantity"]), 201


@bp.patch("/cart/items/<int:item_id>")
@login_required
def update_cart_line(item_id):
    quantity = int_field(body(), "quantity", min_value=0, max_value=10000)
    cart_id = get_cart_id(g.user["id"])
    if quantity == 0:
        execute("DELETE FROM line_items WHERE order_id = %s AND item_id = %s", (cart_id, item_id))
        return jsonify(item_id=item_id, quantity=0)
    row = query_one(
        "UPDATE line_items SET quantity = %s WHERE order_id = %s AND item_id = %s RETURNING quantity",
        (quantity, cart_id, item_id),
    )
    if row is None:
        raise ApiError("that item is not in your cart", 404)
    return jsonify(item_id=item_id, quantity=row["quantity"])


@bp.delete("/cart/items/<int:item_id>")
@login_required
def remove_from_cart(item_id):
    cart_id = get_cart_id(g.user["id"])
    execute("DELETE FROM line_items WHERE order_id = %s AND item_id = %s", (cart_id, item_id))
    return jsonify(ok=True)


@bp.post("/checkout")
@login_required
def checkout():
    """All-or-nothing: if anything fails, the transaction rolls back and the cart is untouched.

    Rows are locked with FOR UPDATE (items by id, then users by id) so two
    concurrent checkouts can't both buy the last unit or overspend a balance,
    and always locking in the same order avoids deadlocks.
    """
    buyer_id = g.user["id"]
    with transaction():
        cart = query_one(
            "SELECT id FROM orders WHERE buyer_id = %s AND placed_at IS NULL FOR UPDATE",
            (buyer_id,),
        )
        if cart is None:
            raise ApiError("your cart is empty")
        lines = query(
            """
            SELECT li.id, li.item_id, li.quantity, i.name, i.price,
                   i.quantity AS stock, i.seller_id, i.is_active
            FROM line_items li JOIN items i ON i.id = li.item_id
            WHERE li.order_id = %s
            ORDER BY i.id
            FOR UPDATE OF i
            """,
            (cart["id"],),
        )
        if not lines:
            raise ApiError("your cart is empty")
        problems = []
        for line in lines:
            if not line["is_active"]:
                problems.append(f"{line['name']} is no longer available")
            elif line["seller_id"] == buyer_id:
                problems.append(f"{line['name']} is your own listing")
            elif line["quantity"] > line["stock"]:
                problems.append(f"{line['name']}: only {line['stock']} in stock")
        if problems:
            raise ApiError("; ".join(problems), 409)

        total = sum(line["price"] * line["quantity"] for line in lines)
        owed = defaultdict(int)
        for line in lines:
            owed[line["seller_id"]] += line["price"] * line["quantity"]

        user_ids = sorted({buyer_id, *owed})
        balances = {
            row["id"]: row["balance"]
            for row in query(
                "SELECT id, balance FROM users WHERE id = ANY(%s) ORDER BY id FOR UPDATE",
                (user_ids,),
            )
        }
        if balances[buyer_id] < total:
            raise ApiError(
                f"insufficient balance: total is {total}, you have {balances[buyer_id]}", 409
            )

        for line in lines:
            execute(
                "UPDATE items SET quantity = quantity - %s WHERE id = %s",
                (line["quantity"], line["item_id"]),
            )
            execute("UPDATE line_items SET unit_price = %s WHERE id = %s", (line["price"], line["id"]))
        execute("UPDATE users SET balance = balance - %s WHERE id = %s", (total, buyer_id))
        for seller_id, amount in owed.items():
            execute("UPDATE users SET balance = balance + %s WHERE id = %s", (amount, seller_id))
        execute("UPDATE orders SET placed_at = NOW() WHERE id = %s", (cart["id"],))

    new_balance = query_one("SELECT balance FROM users WHERE id = %s", (buyer_id,))["balance"]
    return jsonify(order_id=cart["id"], total=total, balance=new_balance), 201


ORDER_SUMMARY_SQL = """
    SELECT o.id, o.placed_at,
           SUM(li.quantity * li.unit_price) AS total,
           SUM(li.quantity) AS item_count,
           COUNT(*) AS line_count,
           COUNT(li.fulfilled_at) AS fulfilled_count,
           COUNT(*) = COUNT(li.fulfilled_at) AS is_complete
    FROM orders o JOIN line_items li ON li.order_id = o.id
    WHERE o.placed_at IS NOT NULL AND o.buyer_id = %(buyer_id)s
"""


@bp.get("/orders")
@login_required
def my_orders():
    return jsonify(
        query(
            ORDER_SUMMARY_SQL + " GROUP BY o.id ORDER BY o.placed_at DESC",
            {"buyer_id": g.user["id"]},
        )
    )


@bp.get("/orders/<int:order_id>")
@login_required
def order_detail(order_id):
    order = query_one(
        ORDER_SUMMARY_SQL + " AND o.id = %(order_id)s GROUP BY o.id",
        {"buyer_id": g.user["id"], "order_id": order_id},
    )
    if order is None:
        raise ApiError("order not found", 404)
    order["lines"] = query(
        """
        SELECT li.id, li.item_id, i.name, li.quantity, li.unit_price,
               li.quantity * li.unit_price AS line_total, li.fulfilled_at,
               i.seller_id, u.full_name AS seller_name,
               EXISTS (SELECT 1 FROM item_reviews r
                       WHERE r.item_id = li.item_id AND r.reviewer_id = %(buyer_id)s) AS item_reviewed,
               EXISTS (SELECT 1 FROM seller_reviews r
                       WHERE r.seller_id = i.seller_id AND r.reviewer_id = %(buyer_id)s) AS seller_reviewed
        FROM line_items li
        JOIN items i ON i.id = li.item_id
        JOIN users u ON u.id = i.seller_id
        WHERE li.order_id = %(order_id)s
        ORDER BY li.id
        """,
        {"buyer_id": g.user["id"], "order_id": order_id},
    )
    return jsonify(order)
