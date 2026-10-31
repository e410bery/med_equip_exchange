"""B6: item and seller reviews. Only past buyers may review, once each.

PUT creates the review or edits the existing one; DELETE removes it.
Average ratings are computed with AVG() when read, so they are always current.
"""
from flask import Blueprint, g, jsonify

from db import execute, query_one
from helpers import ApiError, body, int_field, login_required, text_field
from routes.catalog import has_purchased_from_seller, has_purchased_item

bp = Blueprint("reviews", __name__, url_prefix="/api")


def review_fields():
    data = body()
    return (
        int_field(data, "rating", min_value=1, max_value=5),
        text_field(data, "comment", required=False, max_len=2000) or "",
    )


@bp.put("/items/<int:item_id>/review")
@login_required
def review_item(item_id):
    rating, comment = review_fields()
    if query_one("SELECT 1 FROM items WHERE id = %s", (item_id,)) is None:
        raise ApiError("item not found", 404)
    if not has_purchased_item(g.user["id"], item_id):
        raise ApiError("only buyers who purchased this item can review it", 403)
    review = query_one(
        """
        INSERT INTO item_reviews (reviewer_id, item_id, rating, comment) VALUES (%s, %s, %s, %s)
        ON CONFLICT (reviewer_id, item_id)
        DO UPDATE SET rating = EXCLUDED.rating, comment = EXCLUDED.comment, updated_at = NOW()
        RETURNING id, item_id, rating, comment, created_at, updated_at
        """,
        (g.user["id"], item_id, rating, comment),
    )
    return jsonify(review)


@bp.delete("/items/<int:item_id>/review")
@login_required
def delete_item_review(item_id):
    execute(
        "DELETE FROM item_reviews WHERE reviewer_id = %s AND item_id = %s",
        (g.user["id"], item_id),
    )
    return jsonify(ok=True)


@bp.put("/sellers/<int:seller_id>/review")
@login_required
def review_seller(seller_id):
    rating, comment = review_fields()
    if seller_id == g.user["id"]:
        raise ApiError("you cannot review yourself")
    if not has_purchased_from_seller(g.user["id"], seller_id):
        raise ApiError("only buyers who purchased from this seller can review them", 403)
    review = query_one(
        """
        INSERT INTO seller_reviews (reviewer_id, seller_id, rating, comment) VALUES (%s, %s, %s, %s)
        ON CONFLICT (reviewer_id, seller_id)
        DO UPDATE SET rating = EXCLUDED.rating, comment = EXCLUDED.comment, updated_at = NOW()
        RETURNING id, seller_id, rating, comment, created_at, updated_at
        """,
        (g.user["id"], seller_id, rating, comment),
    )
    return jsonify(review)


@bp.delete("/sellers/<int:seller_id>/review")
@login_required
def delete_seller_review(seller_id):
    execute(
        "DELETE FROM seller_reviews WHERE reviewer_id = %s AND seller_id = %s",
        (g.user["id"], seller_id),
    )
    return jsonify(ok=True)
