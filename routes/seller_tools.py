"""MS3 seller tools: customers, reviews received, fulfill a whole order, restock.
Every route acts on the logged-in seller's own data."""
from flask import Blueprint, g, jsonify
from psycopg.errors import CheckViolation

from db import query, query_one
from helpers import ApiError, body, int_field, login_required
from routes.catalog import seller_rating

bp = Blueprint("seller_tools", __name__, url_prefix="/api/seller")


@bp.before_request
@login_required
def require_login():
    pass


@bp.get("/customers")
def my_customers():
    """Every buyer who has placed an order containing one of my listings."""
    return jsonify(
        query(
            """
            SELECT u.id AS buyer_id, u.full_name, u.organization,
                   COUNT(DISTINCT o.id) AS order_count,
                   SUM(li.quantity) AS units,
                   SUM(li.quantity * li.unit_price) AS total_spent,
                   MAX(o.placed_at) AS last_order_at
            FROM line_items li
            JOIN orders o ON o.id = li.order_id
            JOIN items i ON i.id = li.item_id
            JOIN users u ON u.id = o.buyer_id
            WHERE i.seller_id = %s AND o.placed_at IS NOT NULL
            GROUP BY u.id, u.full_name, u.organization
            ORDER BY total_spent DESC, u.full_name
            """,
            (g.user["id"],),
        )
    )


@bp.get("/reviews")
def reviews_received():
    """Reviews of my listings and reviews of me as a seller, newest first."""
    reviews = query(
        """
        SELECT 'item' AS kind, r.id, r.item_id, i.name AS item_name,
               r.rating, r.comment, r.updated_at,
               r.reviewer_id, u.full_name AS reviewer_name
        FROM item_reviews r
        JOIN items i ON i.id = r.item_id
        JOIN users u ON u.id = r.reviewer_id
        WHERE i.seller_id = %(id)s
        UNION ALL
        SELECT 'seller' AS kind, r.id, NULL, NULL,
               r.rating, r.comment, r.updated_at,
               r.reviewer_id, u.full_name
        FROM seller_reviews r
        JOIN users u ON u.id = r.reviewer_id
        WHERE r.seller_id = %(id)s
        ORDER BY updated_at DESC
        """,
        {"id": g.user["id"]},
    )
    return jsonify(seller=seller_rating(g.user["id"]), reviews=reviews)


@bp.post("/orders/<int:order_id>/fulfill")
def fulfill_order(order_id):
    """Mark every unfulfilled line of mine in this order as fulfilled."""
    rows = query(
        """
        UPDATE line_items li SET fulfilled_at = NOW()
        FROM items i, orders o
        WHERE li.order_id = %s AND i.id = li.item_id AND o.id = li.order_id
          AND i.seller_id = %s AND o.placed_at IS NOT NULL AND li.fulfilled_at IS NULL
        RETURNING li.id
        """,
        (order_id, g.user["id"]),
    )
    if not rows:
        mine = query_one(
            """
            SELECT COUNT(*) AS lines FROM line_items li
            JOIN items i ON i.id = li.item_id JOIN orders o ON o.id = li.order_id
            WHERE li.order_id = %s AND i.seller_id = %s AND o.placed_at IS NOT NULL
            """,
            (order_id, g.user["id"]),
        )
        if mine["lines"] == 0:
            raise ApiError("order not found", 404)
        raise ApiError("already fulfilled", 409)
    done = query_one(
        "SELECT COUNT(*) = COUNT(fulfilled_at) AS done FROM line_items WHERE order_id = %s",
        (order_id,),
    )
    return jsonify(
        order_id=order_id,
        fulfilled_line_ids=[row["id"] for row in rows],
        order_complete=done["done"],
    )


@bp.post("/listings/<int:item_id>/restock")
def restock(item_id):
    """Add to (or with a negative amount, take away from) a listing's stock."""
    amount = int_field(body(), "amount", min_value=-1000000, max_value=1000000)
    if amount == 0:
        raise ApiError("amount can't be 0")
    item = query_one(
        "SELECT id FROM items WHERE id = %s AND seller_id = %s",
        (item_id, g.user["id"]),
    )
    if item is None:
        raise ApiError("listing not found", 404)
    try:
        row = query_one(
            "UPDATE items SET quantity = quantity + %s WHERE id = %s RETURNING id, quantity",
            (amount, item_id),
        )
    except CheckViolation:
        raise ApiError("stock can't go below zero", 409)
    return jsonify(row)
