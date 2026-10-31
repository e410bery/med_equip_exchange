"""Seller side: B4 listings, B7 fulfillment, B8 maintenance/certification records,
X2 alerts, X4 analytics. Every route acts on the logged-in user's own listings."""
from datetime import date
from decimal import Decimal

from flask import Blueprint, g, jsonify, request
from psycopg.errors import CheckViolation, ForeignKeyViolation

from db import execute, query, query_one, transaction
from helpers import (
    ApiError,
    body,
    choice_field,
    date_field,
    int_field,
    login_required,
    money_field,
    text_field,
)
from routes.catalog import CERT_STATUS_SQL, CONDITIONS, ITEM_CARD_SQL, seller_rating

bp = Blueprint("seller", __name__, url_prefix="/api/seller")


@bp.before_request
@login_required
def require_login():
    pass


def own_item(item_id):
    item = query_one(
        "SELECT id, seller_id, is_active FROM items WHERE id = %s AND seller_id = %s",
        (item_id, g.user["id"]),
    )
    if item is None:
        raise ApiError("listing not found", 404)
    return item


# ---------- B4: listings ----------

def manufacturer_id_from(data):
    """Use manufacturer_id, or create/find one by manufacturer_name."""
    name = text_field(data, "manufacturer_name", required=False, max_len=100)
    if name:
        return query_one(
            """
            INSERT INTO manufacturers (name) VALUES (%s)
            ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
            RETURNING id
            """,
            (name,),
        )["id"]
    return int_field(data, "manufacturer_id")


def listing_fields(data, partial):
    """Validated column values from the request. With partial=True (edits),
    only the fields that were sent are returned."""
    parsers = {
        "name": lambda: text_field(data, "name", max_len=255),
        "model": lambda: text_field(data, "model", required=False, max_len=100),
        "description": lambda: text_field(data, "description"),
        "specifications": lambda: text_field(data, "specifications", required=False) or "",
        "category_id": lambda: int_field(data, "category_id"),
        "condition": lambda: choice_field(data, "condition", CONDITIONS),
        "location": lambda: text_field(data, "location", max_len=100),
        "price": lambda: money_field(data, "price"),
        "quantity": lambda: int_field(data, "quantity", min_value=0, max_value=1000000),
        "rental_rate": lambda: money_field(data, "rental_rate", required=False, min_value=Decimal("0.01")),
        "rental_units": lambda: int_field(data, "rental_units", required=False, min_value=0, max_value=1000) or 0,
    }
    fields = {key: parse() for key, parse in parsers.items() if not partial or key in data}
    if not partial or "manufacturer_id" in data or "manufacturer_name" in data:
        fields["manufacturer_id"] = manufacturer_id_from(data)
    if partial and "is_active" in data:
        fields["is_active"] = str(data["is_active"]).lower() in ("1", "true")
    return fields


def save_listing(sql, params):
    try:
        return query_one(sql, params)
    except ForeignKeyViolation:
        raise ApiError("category_id or manufacturer_id does not exist")
    except CheckViolation:
        raise ApiError("invalid values: quantity can't be negative, and rentable items need a rental_rate")


@bp.get("/listings")
def my_listings():
    """Active and removed listings, with units sold and any pending fulfillment."""
    return jsonify(
        query(
            f"""
            SELECT card.*,
                   COALESCE(s.units_sold, 0) AS units_sold,
                   COALESCE(s.pending_lines, 0) AS pending_lines
            FROM ({ITEM_CARD_SQL} WHERE i.seller_id = %s) card
            LEFT JOIN (
                SELECT li.item_id, SUM(li.quantity) AS units_sold,
                       COUNT(*) FILTER (WHERE li.fulfilled_at IS NULL) AS pending_lines
                FROM line_items li JOIN orders o ON o.id = li.order_id
                WHERE o.placed_at IS NOT NULL
                GROUP BY li.item_id
            ) s ON s.item_id = card.id
            ORDER BY card.is_active DESC, card.name
            """,
            (g.user["id"],),
        )
    )


@bp.post("/listings")
def create_listing():
    fields = listing_fields(body(), partial=False)
    columns = ", ".join(fields)
    values = ", ".join(f"%({key})s" for key in fields)
    item = save_listing(
        f"INSERT INTO items (seller_id, {columns}) VALUES (%(seller_id)s, {values}) RETURNING id",
        {**fields, "seller_id": g.user["id"]},
    )
    return jsonify(id=item["id"]), 201


@bp.patch("/listings/<int:item_id>")
def edit_listing(item_id):
    own_item(item_id)
    fields = listing_fields(body(), partial=True)
    if not fields:
        raise ApiError("nothing to update")
    assignments = ", ".join(f"{key} = %({key})s" for key in fields)
    save_listing(
        f"UPDATE items SET {assignments} WHERE id = %(id)s RETURNING id",
        {**fields, "id": item_id},
    )
    return jsonify(query_one(f"{ITEM_CARD_SQL} WHERE i.id = %s", (item_id,)))


@bp.delete("/listings/<int:item_id>")
def remove_listing(item_id):
    """Soft delete: past orders and reviews still point at the item.
    It is hidden from search and taken out of everyone's carts."""
    own_item(item_id)
    with transaction():
        execute("UPDATE items SET is_active = FALSE WHERE id = %s", (item_id,))
        execute(
            """
            DELETE FROM line_items li USING orders o
            WHERE li.order_id = o.id AND o.placed_at IS NULL AND li.item_id = %s
            """,
            (item_id,),
        )
    return jsonify(ok=True)


# ---------- B8: maintenance and certification records ----------

def maintenance_fields(data):
    performed_on = date_field(data, "performed_on")
    next_due = date_field(data, "next_due", required=False)
    if performed_on > date.today():
        raise ApiError("performed_on cannot be in the future")
    if next_due is not None and next_due <= performed_on:
        raise ApiError("next_due must be after performed_on")
    return {
        "performed_on": performed_on,
        "next_due": next_due,
        "description": text_field(data, "description"),
        "performed_by": text_field(data, "performed_by", required=False, max_len=255),
    }


def certification_fields(data):
    issued_on = date_field(data, "issued_on")
    expires_on = date_field(data, "expires_on")
    if issued_on > date.today():
        raise ApiError("issued_on cannot be in the future")
    if expires_on <= issued_on:
        raise ApiError("expires_on must be after issued_on")
    return {
        "issued_on": issued_on,
        "expires_on": expires_on,
        "name": text_field(data, "name", max_len=255),
        "issuer": text_field(data, "issuer", max_len=255),
    }


RECORD_TABLES = {
    "maintenance": ("maintenance_records", maintenance_fields),
    "certifications": ("certifications", certification_fields),
}


def record_table(kind):
    if kind not in RECORD_TABLES:
        raise ApiError("not found", 404)
    return RECORD_TABLES[kind]


@bp.get("/listings/<int:item_id>/records")
def list_records(item_id):
    own_item(item_id)
    return jsonify(
        maintenance=query(
            "SELECT * FROM maintenance_records WHERE item_id = %s ORDER BY performed_on DESC", (item_id,)
        ),
        certifications=query(
            f"SELECT *, {CERT_STATUS_SQL} FROM certifications WHERE item_id = %s ORDER BY expires_on",
            (item_id,),
        ),
    )


@bp.post("/listings/<int:item_id>/<kind>")
def add_record(item_id, kind):
    """kind is "maintenance" or "certifications"."""
    table, parse = record_table(kind)
    own_item(item_id)
    fields = parse(body())
    columns = ", ".join(fields)
    values = ", ".join(f"%({key})s" for key in fields)
    record = query_one(
        f"INSERT INTO {table} (item_id, {columns}) VALUES (%(item_id)s, {values}) RETURNING *",
        {**fields, "item_id": item_id},
    )
    return jsonify(record), 201


@bp.put("/<kind>/<int:record_id>")
def correct_record(kind, record_id):
    table, parse = record_table(kind)
    fields = parse(body())
    assignments = ", ".join(f"{key} = %({key})s" for key in fields)
    record = query_one(
        f"""
        UPDATE {table} r SET {assignments}
        FROM items i
        WHERE r.id = %(id)s AND i.id = r.item_id AND i.seller_id = %(seller_id)s
        RETURNING r.*
        """,
        {**fields, "id": record_id, "seller_id": g.user["id"]},
    )
    if record is None:
        raise ApiError("record not found", 404)
    return jsonify(record)


@bp.delete("/<kind>/<int:record_id>")
def delete_record(kind, record_id):
    table, _ = record_table(kind)
    row = query_one(
        f"""
        DELETE FROM {table} r USING items i
        WHERE r.id = %s AND i.id = r.item_id AND i.seller_id = %s
        RETURNING r.id
        """,
        (record_id, g.user["id"]),
    )
    if row is None:
        raise ApiError("record not found", 404)
    return jsonify(ok=True)


# ---------- B7: incoming orders and fulfillment ----------

@bp.get("/orders")
def incoming_orders():
    """?status=pending (default) | fulfilled | all"""
    status = choice_field(request.args, "status", ("pending", "fulfilled", "all"), required=False) or "pending"
    status_sql = {
        "pending": "AND li.fulfilled_at IS NULL",
        "fulfilled": "AND li.fulfilled_at IS NOT NULL",
        "all": "",
    }[status]
    return jsonify(
        query(
            f"""
            SELECT li.id AS line_item_id, o.id AS order_id, o.placed_at,
                   o.buyer_id, u.full_name AS buyer_name, u.address AS ship_to,
                   li.item_id, i.name, li.quantity, li.unit_price,
                   li.quantity * li.unit_price AS line_total, li.fulfilled_at,
                   NOT EXISTS (SELECT 1 FROM line_items x
                               WHERE x.order_id = o.id AND x.fulfilled_at IS NULL) AS order_complete
            FROM line_items li
            JOIN orders o ON o.id = li.order_id
            JOIN items i ON i.id = li.item_id
            JOIN users u ON u.id = o.buyer_id
            WHERE i.seller_id = %s AND o.placed_at IS NOT NULL {status_sql}
            ORDER BY o.placed_at DESC, li.id
            """,
            (g.user["id"],),
        )
    )


@bp.post("/line-items/<int:line_item_id>/fulfill")
def fulfill(line_item_id):
    row = query_one(
        """
        UPDATE line_items li SET fulfilled_at = NOW()
        FROM items i, orders o
        WHERE li.id = %s AND i.id = li.item_id AND o.id = li.order_id
          AND i.seller_id = %s AND o.placed_at IS NOT NULL AND li.fulfilled_at IS NULL
        RETURNING li.id, li.order_id, li.fulfilled_at
        """,
        (line_item_id, g.user["id"]),
    )
    if row is None:
        exists = query_one(
            """
            SELECT li.fulfilled_at FROM line_items li
            JOIN items i ON i.id = li.item_id JOIN orders o ON o.id = li.order_id
            WHERE li.id = %s AND i.seller_id = %s AND o.placed_at IS NOT NULL
            """,
            (line_item_id, g.user["id"]),
        )
        if exists is None:
            raise ApiError("order line not found", 404)
        raise ApiError("already fulfilled", 409)
    row["order_complete"] = query_one(
        "SELECT COUNT(*) = COUNT(fulfilled_at) AS done FROM line_items WHERE order_id = %s",
        (row["order_id"],),
    )["done"]
    return jsonify(row)


@bp.get("/rentals")
def rentals_of_my_items():
    return jsonify(
        query(
            """
            SELECT r.id, r.item_id, i.name, r.unit_no, r.start_date, r.end_date,
                   r.total_price, r.renter_id, u.full_name AS renter_name
            FROM rentals r
            JOIN items i ON i.id = r.item_id
            JOIN users u ON u.id = r.renter_id
            WHERE i.seller_id = %s
            ORDER BY r.start_date DESC
            """,
            (g.user["id"],),
        )
    )


# ---------- X2: certification and maintenance alerts ----------

def alerts_for(seller_id):
    certifications = query(
        f"""
        SELECT c.id, c.item_id, i.name AS item_name, c.name, c.issuer, c.expires_on,
               c.expires_on - CURRENT_DATE AS days_left, {CERT_STATUS_SQL}
        FROM certifications c JOIN items i ON i.id = c.item_id
        WHERE i.seller_id = %s AND i.is_active AND c.expires_on <= CURRENT_DATE + 30
        ORDER BY c.expires_on
        """,
        (seller_id,),
    )
    # Only each item's latest maintenance record counts; newer work supersedes older due dates.
    maintenance = query(
        """
        SELECT * FROM (
            SELECT DISTINCT ON (m.item_id)
                   m.id, m.item_id, i.name AS item_name, m.description,
                   m.performed_on, m.next_due, CURRENT_DATE - m.next_due AS days_overdue
            FROM maintenance_records m JOIN items i ON i.id = m.item_id
            WHERE i.seller_id = %s AND i.is_active
            ORDER BY m.item_id, m.performed_on DESC, m.id DESC
        ) latest
        WHERE next_due < CURRENT_DATE
        ORDER BY next_due
        """,
        (seller_id,),
    )
    return {"certifications": certifications, "overdue_maintenance": maintenance}


@bp.get("/alerts")
def alerts():
    """Certifications expired or expiring within 30 days, and overdue maintenance."""
    return jsonify(alerts_for(g.user["id"]))


@bp.get("/dashboard")
def dashboard():
    seller_id = g.user["id"]
    stats = query_one(
        """
        SELECT
          (SELECT COUNT(*) FROM items WHERE seller_id = %(id)s AND is_active) AS active_listings,
          (SELECT COUNT(*) FROM items WHERE seller_id = %(id)s AND is_active AND quantity = 0) AS out_of_stock,
          (SELECT COUNT(*) FROM line_items li
             JOIN items i ON i.id = li.item_id JOIN orders o ON o.id = li.order_id
            WHERE i.seller_id = %(id)s AND o.placed_at IS NOT NULL AND li.fulfilled_at IS NULL) AS awaiting_fulfillment,
          (SELECT COUNT(*) FROM rentals r JOIN items i ON i.id = r.item_id
            WHERE i.seller_id = %(id)s AND r.end_date >= CURRENT_DATE) AS current_and_upcoming_rentals
        """,
        {"id": seller_id},
    )
    alert_lists = alerts_for(seller_id)
    stats["alert_count"] = len(alert_lists["certifications"]) + len(alert_lists["overdue_maintenance"])
    stats["balance"] = g.user["balance"]
    stats.update(seller_rating(seller_id))
    return jsonify(stats)


# ---------- X4: analytics ----------

@bp.get("/analytics")
def analytics():
    """Chart-ready data. ?months=12 sets the window (1-36).

    - sales_by_month: one row per month (including empty months) for a line/bar chart.
    - top_items: best sellers by units in the window.
    - turnover: per listing, units sold in the window / average inventory, where
      average inventory is approximated as current stock + units_sold / 2
      (the midpoint of start-of-window stock and current stock).
    """
    months = int_field(request.args, "months", required=False, min_value=1, max_value=36) or 12
    params = {"id": g.user["id"], "months": months}
    window_start = "(date_trunc('month', CURRENT_DATE)::timestamp - make_interval(months => %(months)s - 1))"
    window_sql = f"o.placed_at IS NOT NULL AND o.placed_at >= {window_start}"

    sales_by_month = query(
        f"""
        SELECT to_char(m.month, 'YYYY-MM') AS month,
               COALESCE(SUM(li.quantity * li.unit_price), 0.00) AS revenue,
               COALESCE(SUM(li.quantity), 0) AS units,
               COUNT(DISTINCT li.order_id) AS orders
        FROM generate_series({window_start}, date_trunc('month', CURRENT_DATE)::timestamp,
                             interval '1 month') AS m(month)
        LEFT JOIN orders o ON date_trunc('month', o.placed_at) = m.month AND {window_sql}
        LEFT JOIN line_items li ON li.order_id = o.id
            AND li.item_id IN (SELECT id FROM items WHERE seller_id = %(id)s)
        GROUP BY m.month ORDER BY m.month
        """,
        params,
    )
    top_items = query(
        f"""
        SELECT i.id, i.name, SUM(li.quantity) AS units, SUM(li.quantity * li.unit_price) AS revenue
        FROM line_items li
        JOIN orders o ON o.id = li.order_id
        JOIN items i ON i.id = li.item_id
        WHERE i.seller_id = %(id)s AND {window_sql}
        GROUP BY i.id ORDER BY units DESC, revenue DESC LIMIT 5
        """,
        params,
    )

    turnover = query(
        f"""
        SELECT i.id, i.name, i.quantity AS current_stock,
               COALESCE(s.units_sold, 0) AS units_sold,
               ROUND(COALESCE(s.units_sold, 0) / NULLIF(i.quantity + COALESCE(s.units_sold, 0) / 2.0, 0), 2)
                   AS turnover_ratio
        FROM items i
        LEFT JOIN (
            SELECT li.item_id, SUM(li.quantity) AS units_sold
            FROM line_items li JOIN orders o ON o.id = li.order_id
            WHERE {window_sql}
            GROUP BY li.item_id
        ) s ON s.item_id = i.id
        WHERE i.seller_id = %(id)s AND i.is_active
        ORDER BY turnover_ratio DESC NULLS LAST, i.name
        """,
        params,
    )

    totals = query_one(
        f"""
        SELECT COALESCE(SUM(li.quantity * li.unit_price), 0.00) AS revenue,
               COALESCE(SUM(li.quantity), 0) AS units,
               COUNT(DISTINCT o.id) AS orders
        FROM line_items li
        JOIN orders o ON o.id = li.order_id
        JOIN items i ON i.id = li.item_id
        WHERE i.seller_id = %(id)s AND {window_sql}
        """,
        params,
    )
    totals["rental_revenue"] = query_one(
        f"""
        SELECT COALESCE(SUM(r.total_price), 0.00) AS revenue
        FROM rentals r JOIN items i ON i.id = r.item_id
        WHERE i.seller_id = %(id)s
          AND r.created_at >= {window_start}
        """,
        params,
    )["revenue"]

    return jsonify(
        months=months,
        totals=totals,
        sales_by_month=sales_by_month,
        top_items=top_items,
        turnover=turnover,
    )
