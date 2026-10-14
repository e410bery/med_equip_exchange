from flask import Flask, jsonify, request

from db import query

app = Flask(__name__)


@app.route("/users")
def users():
    rows = query("SELECT id, email, full_name, address, balance FROM users ORDER BY id")
    return jsonify(rows)


@app.route("/items")
def items():
    # Optional filters: ?q=keyword&seller_id=N&min_price=X&max_price=Y&in_stock=1
    args = request.args
    sql = """
        SELECT i.id, i.name, i.description, i.price, i.quantity,
               i.seller_id, u.full_name AS seller_name
        FROM items i
        JOIN users u ON u.id = i.seller_id
        WHERE TRUE
    """
    params = {}
    if args.get("q"):
        sql += " AND (i.name ILIKE %(q)s OR i.description ILIKE %(q)s)"
        params["q"] = f"%{args['q']}%"
    if args.get("seller_id") is not None:
        if not args["seller_id"].isdigit():
            return jsonify(error="seller_id must be an integer"), 400
        sql += " AND i.seller_id = %(seller_id)s"
        params["seller_id"] = args["seller_id"]
    for key, op in (("min_price", ">="), ("max_price", "<=")):
        if args.get(key) is not None:
            try:
                params[key] = float(args[key])
            except ValueError:
                return jsonify(error=f"{key} must be a number"), 400
            sql += f" AND i.price {op} %({key})s"
    if args.get("in_stock") == "1":
        sql += " AND i.quantity > 0"
    sql += " ORDER BY i.name"
    return jsonify(query(sql, params))


@app.route("/items/<int:item_id>")
def item_detail(item_id):
    rows = query(
        """
        SELECT i.id, i.name, i.description, i.price, i.quantity,
               i.seller_id, u.full_name AS seller_name, u.email AS seller_email
        FROM items i
        JOIN users u ON u.id = i.seller_id
        WHERE i.id = %(id)s
        """,
        {"id": item_id},
    )
    if not rows:
        return jsonify(error="item not found"), 404
    return jsonify(rows[0])


@app.route("/orders")
def orders():
    buyer_id = request.args.get("buyer_id")
    if buyer_id is not None and not buyer_id.isdigit():
        return jsonify(error="buyer_id must be an integer"), 400
    sql = """
        SELECT o.id, o.buyer_id, o.placed_at,
               SUM(li.quantity * li.unit_price) AS total,
               SUM(li.quantity) AS item_count
        FROM orders o
        JOIN line_items li ON li.order_id = o.id
        WHERE o.placed_at IS NOT NULL
    """
    params = {}
    if buyer_id is not None:
        sql += " AND o.buyer_id = %(buyer_id)s"
        params["buyer_id"] = buyer_id
    sql += " GROUP BY o.id ORDER BY o.placed_at DESC"
    return jsonify(query(sql, params))


if __name__ == "__main__":
    app.run(debug=True)
