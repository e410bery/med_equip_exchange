"""MS3 product browsing. Existing catalog routes remain unchanged."""
from pathlib import Path

from flask import Blueprint, jsonify, request, send_from_directory

from db import query, query_one
from helpers import (
    ApiError,
    choice_field,
    int_field,
    money_field,
    text_field,
)
from routes.catalog import CONDITIONS, ITEM_CARD_SQL, SORTS


bp = Blueprint("products", __name__)

DOCS = Path(__file__).resolve().parent.parent / "docs"


@bp.get("/products")
def products_page():
    """Serve the equipment browsing page."""
    return send_from_directory(DOCS, "products.html")


@bp.get("/products-assets/<path:filename>")
def products_asset(filename):
    """Serve the frontend files from the existing docs directory."""
    return send_from_directory(DOCS, filename)


@bp.get("/api/products")
def products():
    """Search active seller listings with optional certification filtering."""
    args = request.args

    where = ["i.is_active"]
    params = {}

    # Search equipment names and descriptions.
    keyword = text_field(
        args,
        "q",
        required=False,
        max_len=200,
    )

    if keyword:
        where.append(
            "(i.name ILIKE %(q)s OR i.description ILIKE %(q)s)"
        )
        params["q"] = f"%{keyword}%"

    # Filter by category and manufacturer.
    for key in ("category_id", "manufacturer_id"):
        value = int_field(
            args,
            key,
            required=False,
            min_value=1,
        )

        if value is not None:
            where.append(f"i.{key} = %({key})s")
            params[key] = value

    # Filter by condition and location.
    for key in ("condition", "location"):
        if key == "condition":
            value = choice_field(
                args,
                key,
                CONDITIONS,
                required=False,
            )
        else:
            value = text_field(
                args,
                key,
                required=False,
                max_len=100,
            )

        if value:
            where.append(f"i.{key} = %({key})s")
            params[key] = value

    # Filter by price range.
    for key, operator in (
        ("min_price", ">="),
        ("max_price", "<="),
    ):
        value = money_field(
            args,
            key,
            required=False,
        )

        if value is not None:
            where.append(f"i.price {operator} %({key})s")
            params[key] = value

    minimum = params.get("min_price", 0)
    maximum = params.get("max_price", float("inf"))

    if minimum > maximum:
        raise ApiError(
            "Minimum price cannot exceed maximum price"
        )

    # Checkbox filters.
    for key, predicate in (
        (
            "in_stock",
            "i.quantity > 0",
        ),
        (
            "certified",
            """
            EXISTS (
                SELECT 1
                FROM certifications ce
                WHERE ce.item_id = i.id
                  AND ce.issued_on <= CURRENT_DATE
                  AND ce.expires_on >= CURRENT_DATE
            )
            """,
        ),
    ):
        flag = choice_field(
            args,
            key,
            ("0", "1"),
            required=False,
        )

        if flag == "1":
            where.append(predicate)

    # Only allow the existing, predefined SQL sort expressions.
    sort = choice_field(
        args,
        "sort",
        tuple(SORTS),
        required=False,
    ) or "name"

    page = int_field(
        args,
        "page",
        required=False,
        min_value=1,
    ) or 1

    per_page = int_field(
        args,
        "per_page",
        required=False,
        min_value=1,
        max_value=50,
    ) or 12

    where_sql = " AND ".join(where)

    # Count all matches so the frontend can display pagination.
    total = query_one(
        f"""
        SELECT COUNT(*) AS n
        FROM items i
        WHERE {where_sql}
        """,
        params,
    )["n"]

    # Fetch only the requested page.
    rows = query(
        f"""
        {ITEM_CARD_SQL}
        WHERE {where_sql}
        ORDER BY {SORTS[sort]}
        LIMIT %(limit)s
        OFFSET %(offset)s
        """,
        {
            **params,
            "limit": per_page,
            "offset": (page - 1) * per_page,
        },
    )

    return jsonify(
        items=rows,
        total=total,
        page=page,
        per_page=per_page,
        total_pages=(total + per_page - 1) // per_page,
    )