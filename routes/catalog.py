"""B2 browse/search, B3 item detail, X3 comparison, and seller profiles."""
from flask import Blueprint, g, jsonify, request

from db import query, query_one
from helpers import ApiError, choice_field, int_field, money_field, text_field

bp = Blueprint("catalog", __name__, url_prefix="/api")

CONDITIONS = ("New", "Like New", "Good", "Fair", "Refurbished")

SORTS = {
    "name": "i.name, i.id",
    "price_asc": "i.price, i.id",
    "price_desc": "i.price DESC, i.id",
    "newest": "i.created_at DESC, i.id DESC",
    "rating": "r.avg_rating DESC NULLS LAST, i.id",
}

# Summary columns used for listing cards (browse, related items, seller profile).
ITEM_CARD_SQL = """
    SELECT i.id, i.name, i.model, i.condition, i.location, i.price, i.quantity,
           i.rental_rate, i.rental_units, i.is_active,
           i.category_id, c.name AS category,
           i.manufacturer_id, m.name AS manufacturer,
           i.seller_id, u.full_name AS seller_name,
           r.avg_rating, COALESCE(r.review_count, 0) AS review_count
    FROM items i
    JOIN categories c ON c.id = i.category_id
    JOIN manufacturers m ON m.id = i.manufacturer_id
    JOIN users u ON u.id = i.seller_id
    LEFT JOIN (
        SELECT item_id, ROUND(AVG(rating), 2) AS avg_rating, COUNT(*) AS review_count
        FROM item_reviews GROUP BY item_id
    ) r ON r.item_id = i.id
"""

CERT_STATUS_SQL = """
    CASE WHEN expires_on < CURRENT_DATE THEN 'expired'
         WHEN expires_on <= CURRENT_DATE + 30 THEN 'expiring_soon'
         ELSE 'valid' END AS status
"""


@bp.get("/categories")
def categories():
    return jsonify(query("SELECT id, name FROM categories ORDER BY name"))


@bp.get("/manufacturers")
def manufacturers():
    return jsonify(query("SELECT id, name FROM manufacturers ORDER BY name"))


@bp.get("/filters")
def filters():
    """Everything a browse page needs to fill its filter dropdowns."""
    return jsonify(
        categories=query("SELECT id, name FROM categories ORDER BY name"),
        manufacturers=query("SELECT id, name FROM manufacturers ORDER BY name"),
        conditions=CONDITIONS,
        locations=[
            row["location"]
            for row in query("SELECT DISTINCT location FROM items WHERE is_active ORDER BY location")
        ],
        sorts=list(SORTS),
    )


def search_items(args):
    """Filtered, sorted, paginated listings. Returns (rows, total, page, per_page)."""
    where = ["i.is_active"]
    params = {}
    q = text_field(args, "q", required=False, max_len=200)
    if q:
        where.append("(i.name ILIKE %(q)s OR i.description ILIKE %(q)s)")
        params["q"] = f"%{q}%"
    for key, column in (
        ("category_id", "i.category_id"),
        ("manufacturer_id", "i.manufacturer_id"),
        ("seller_id", "i.seller_id"),
    ):
        value = int_field(args, key, required=False)
        if value is not None:
            where.append(f"{column} = %({key})s")
            params[key] = value
    condition = choice_field(args, "condition", CONDITIONS, required=False)
    if condition:
        where.append("i.condition = %(condition)s")
        params["condition"] = condition
    location = text_field(args, "location", required=False)
    if location:
        where.append("i.location = %(location)s")
        params["location"] = location
    for key, op in (("min_price", ">="), ("max_price", "<=")):
        value = money_field(args, key, required=False)
        if value is not None:
            where.append(f"i.price {op} %({key})s")
            params[key] = value
    if args.get("in_stock") in ("1", "true"):
        where.append("i.quantity > 0")
    if args.get("rentable") in ("1", "true"):
        where.append("i.rental_units > 0")

    sort = choice_field(args, "sort", list(SORTS), required=False) or "name"
    page = int_field(args, "page", required=False, min_value=1) or 1
    per_page = int_field(args, "per_page", required=False, min_value=1, max_value=50) or 12
    where_sql = " AND ".join(where)

    total = query_one(f"SELECT COUNT(*) AS n FROM items i WHERE {where_sql}", params)["n"]
    rows = query(
        f"{ITEM_CARD_SQL} WHERE {where_sql} ORDER BY {SORTS[sort]} LIMIT %(limit)s OFFSET %(offset)s",
        {**params, "limit": per_page, "offset": (page - 1) * per_page},
    )
    return rows, total, page, per_page


@bp.get("/items")
def items():
    """Query params: q, category_id, manufacturer_id, seller_id, condition, location,
    min_price, max_price, in_stock=1, rentable=1, sort, page, per_page."""
    rows, total, page, per_page = search_items(request.args)
    return jsonify(
        items=rows,
        page=page,
        per_page=per_page,
        total=total,
        total_pages=(total + per_page - 1) // per_page,
    )


def get_item_or_404(item_id):
    item = query_one(f"{ITEM_CARD_SQL} WHERE i.id = %s", (item_id,))
    if item is None:
        raise ApiError("item not found", 404)
    return item


def has_purchased_item(user_id, item_id):
    return query_one(
        """
        SELECT 1 FROM line_items li JOIN orders o ON o.id = li.order_id
        WHERE o.buyer_id = %s AND o.placed_at IS NOT NULL AND li.item_id = %s
        LIMIT 1
        """,
        (user_id, item_id),
    ) is not None


def has_purchased_from_seller(user_id, seller_id):
    return query_one(
        """
        SELECT 1 FROM line_items li
        JOIN orders o ON o.id = li.order_id
        JOIN items i ON i.id = li.item_id
        WHERE o.buyer_id = %s AND o.placed_at IS NOT NULL AND i.seller_id = %s
        LIMIT 1
        """,
        (user_id, seller_id),
    ) is not None


def seller_rating(seller_id):
    return query_one(
        """
        SELECT ROUND(AVG(rating), 2) AS avg_rating, COUNT(*) AS review_count
        FROM seller_reviews WHERE seller_id = %s
        """,
        (seller_id,),
    )


@bp.get("/items/<int:item_id>")
def item_detail(item_id):
    item = get_item_or_404(item_id)
    is_owner = g.user is not None and g.user["id"] == item["seller_id"]
    if not item["is_active"] and not is_owner:
        raise ApiError("item not found", 404)

    extra = query_one("SELECT description, specifications, created_at FROM items WHERE id = %s", (item_id,))
    seller = query_one(
        "SELECT id, full_name, organization, email, created_at FROM users WHERE id = %s",
        (item["seller_id"],),
    )
    seller.update(seller_rating(item["seller_id"]))
    reviews = query(
        """
        SELECT r.id, r.rating, r.comment, r.created_at, r.updated_at,
               r.reviewer_id, u.full_name AS reviewer_name
        FROM item_reviews r JOIN users u ON u.id = r.reviewer_id
        WHERE r.item_id = %s ORDER BY r.updated_at DESC
        """,
        (item_id,),
    )
    maintenance = query(
        """
        SELECT id, performed_on, description, performed_by, next_due,
               -- only the latest record's due date matters; newer work supersedes it
               (next_due < CURRENT_DATE AND performed_on = MAX(performed_on) OVER ()) IS TRUE AS overdue
        FROM maintenance_records WHERE item_id = %s ORDER BY performed_on DESC
        """,
        (item_id,),
    )
    certifications = query(
        f"""
        SELECT id, name, issuer, issued_on, expires_on, {CERT_STATUS_SQL}
        FROM certifications WHERE item_id = %s ORDER BY expires_on
        """,
        (item_id,),
    )
    related = query(
        f"""
        {ITEM_CARD_SQL}
        WHERE i.is_active AND i.id <> %(id)s
          AND (i.category_id = %(category_id)s OR (i.model IS NOT NULL AND i.model = %(model)s))
        ORDER BY (i.model = %(model)s) DESC, i.name LIMIT 4
        """,
        {"id": item_id, "category_id": item["category_id"], "model": item["model"]},
    )

    viewer = None
    if g.user is not None:
        my_review = next((r for r in reviews if r["reviewer_id"] == g.user["id"]), None)
        viewer = {
            "is_owner": is_owner,
            "can_review": has_purchased_item(g.user["id"], item_id),
            "my_review_id": my_review["id"] if my_review else None,
        }

    return jsonify(
        **item,
        **extra,
        seller=seller,
        reviews=reviews,
        maintenance=maintenance,
        certifications=certifications,
        related=related,
        viewer=viewer,
    )


@bp.get("/compare")
def compare():
    """X3: ?ids=1,2,3 (or ids=1&ids=2) — 2 to 4 items side by side, in the order given."""
    raw = ",".join(request.args.getlist("ids"))
    try:
        ids = list(dict.fromkeys(int(part) for part in raw.split(",") if part.strip()))
    except ValueError:
        raise ApiError("ids must be integers")
    if not 2 <= len(ids) <= 4:
        raise ApiError("choose between 2 and 4 different items to compare")
    rows = query(
        f"""
        SELECT card.*, i.description, i.specifications,
               (SELECT COUNT(*) FROM certifications ce
                 WHERE ce.item_id = card.id AND ce.expires_on >= CURRENT_DATE) AS valid_certifications,
               (SELECT MAX(performed_on) FROM maintenance_records mr
                 WHERE mr.item_id = card.id) AS last_maintenance
        FROM ({ITEM_CARD_SQL} WHERE i.id = ANY(%s) AND i.is_active) card
        JOIN items i ON i.id = card.id
        """,
        (ids,),
    )
    by_id = {row["id"]: row for row in rows}
    missing = [i for i in ids if i not in by_id]
    if missing:
        raise ApiError(f"items not found: {', '.join(map(str, missing))}", 404)
    return jsonify([by_id[i] for i in ids])


@bp.get("/sellers/<int:seller_id>")
def seller_profile(seller_id):
    seller = query_one(
        "SELECT id, full_name, organization, created_at FROM users WHERE id = %s",
        (seller_id,),
    )
    if seller is None:
        raise ApiError("seller not found", 404)
    seller.update(seller_rating(seller_id))
    reviews = query(
        """
        SELECT r.id, r.rating, r.comment, r.created_at, r.updated_at,
               r.reviewer_id, u.full_name AS reviewer_name
        FROM seller_reviews r JOIN users u ON u.id = r.reviewer_id
        WHERE r.seller_id = %s ORDER BY r.updated_at DESC
        """,
        (seller_id,),
    )
    listings = query(f"{ITEM_CARD_SQL} WHERE i.seller_id = %s AND i.is_active ORDER BY i.name", (seller_id,))
    viewer = None
    if g.user is not None and g.user["id"] != seller_id:
        my_review = next((r for r in reviews if r["reviewer_id"] == g.user["id"]), None)
        viewer = {
            "can_review": has_purchased_from_seller(g.user["id"], seller_id),
            "my_review_id": my_review["id"] if my_review else None,
        }
    return jsonify(**seller, reviews=reviews, listings=listings, viewer=viewer)
