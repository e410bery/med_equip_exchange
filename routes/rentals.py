"""X1: rent equipment by the day. Overlapping rentals of the same unit are rejected."""
from datetime import date

from flask import Blueprint, g, jsonify, request
from psycopg.errors import ExclusionViolation

from db import execute, query, query_one, transaction
from helpers import ApiError, body, date_field, login_required

bp = Blueprint("rentals", __name__, url_prefix="/api")

MAX_RENTAL_DAYS = 365

# Lowest-numbered unit with no rental overlapping [start, end] (both inclusive).
FREE_UNIT_SQL = """
    SELECT u AS unit_no FROM generate_series(1, %(units)s) AS u
    WHERE NOT EXISTS (
        SELECT 1 FROM rentals r
        WHERE r.item_id = %(item_id)s AND r.unit_no = u
          AND daterange(r.start_date, r.end_date, '[]') && daterange(%(start)s, %(end)s, '[]')
    )
    ORDER BY u LIMIT 1
"""


def rental_dates(data):
    start = date_field(data, "start_date")
    end = date_field(data, "end_date")
    if start < date.today():
        raise ApiError("start_date cannot be in the past")
    if end < start:
        raise ApiError("end_date must be on or after start_date")
    days = (end - start).days + 1
    if days > MAX_RENTAL_DAYS:
        raise ApiError(f"rentals can be at most {MAX_RENTAL_DAYS} days")
    return start, end, days


def rentable_item(item_id, lock=False):
    item = query_one(
        "SELECT id, name, seller_id, rental_rate, rental_units, is_active FROM items WHERE id = %s"
        + (" FOR UPDATE" if lock else ""),
        (item_id,),
    )
    if item is None or not item["is_active"]:
        raise ApiError("item not found", 404)
    if item["rental_units"] == 0:
        raise ApiError("this item is not available for rent")
    return item


@bp.get("/items/<int:item_id>/availability")
def availability(item_id):
    """?start_date=&end_date= — is a unit free, and what would it cost?"""
    start, end, days = rental_dates(request.args)
    item = rentable_item(item_id)
    free = query_one(
        FREE_UNIT_SQL,
        {"units": item["rental_units"], "item_id": item_id, "start": start, "end": end},
    )
    return jsonify(
        available=free is not None,
        days=days,
        daily_rate=item["rental_rate"],
        total_price=item["rental_rate"] * days,
    )


@bp.post("/items/<int:item_id>/rentals")
@login_required
def rent(item_id):
    start, end, days = rental_dates(body())
    renter_id = g.user["id"]
    try:
        with transaction():
            # Locking the item row serializes bookings for it, so two renters
            # can't both grab the same free unit.
            item = rentable_item(item_id, lock=True)
            if item["seller_id"] == renter_id:
                raise ApiError("you cannot rent your own listing")
            free = query_one(
                FREE_UNIT_SQL,
                {"units": item["rental_units"], "item_id": item_id, "start": start, "end": end},
            )
            if free is None:
                raise ApiError("no units are available for those dates", 409)
            total = item["rental_rate"] * days
            balances = {
                row["id"]: row["balance"]
                for row in query(
                    "SELECT id, balance FROM users WHERE id = ANY(%s) ORDER BY id FOR UPDATE",
                    ([renter_id, item["seller_id"]],),
                )
            }
            if balances[renter_id] < total:
                raise ApiError(f"insufficient balance: total is {total}, you have {balances[renter_id]}", 409)
            execute("UPDATE users SET balance = balance - %s WHERE id = %s", (total, renter_id))
            execute("UPDATE users SET balance = balance + %s WHERE id = %s", (total, item["seller_id"]))
            rental = query_one(
                """
                INSERT INTO rentals (item_id, renter_id, unit_no, start_date, end_date, daily_rate, total_price)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                RETURNING id, item_id, unit_no, start_date, end_date, daily_rate, total_price, created_at
                """,
                (item_id, renter_id, free["unit_no"], start, end, item["rental_rate"], total),
            )
    except ExclusionViolation:
        # Backstop: the database constraint caught an overlap the app missed.
        raise ApiError("that unit was just booked for overlapping dates; try again", 409)
    return jsonify(rental), 201


@bp.get("/rentals")
@login_required
def my_rentals():
    return jsonify(
        query(
            """
            SELECT r.id, r.item_id, i.name, r.unit_no, r.start_date, r.end_date,
                   r.daily_rate, r.total_price, r.created_at,
                   i.seller_id, u.full_name AS seller_name,
                   CASE WHEN r.end_date < CURRENT_DATE THEN 'past'
                        WHEN r.start_date > CURRENT_DATE THEN 'upcoming'
                        ELSE 'active' END AS status
            FROM rentals r
            JOIN items i ON i.id = r.item_id
            JOIN users u ON u.id = i.seller_id
            WHERE r.renter_id = %s
            ORDER BY r.start_date DESC
            """,
            (g.user["id"],),
        )
    )
