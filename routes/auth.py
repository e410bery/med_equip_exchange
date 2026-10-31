"""B1: register, log in/out, profile, and balance."""
from decimal import Decimal

from flask import Blueprint, g, jsonify, request, session
from psycopg.errors import UniqueViolation
from werkzeug.security import check_password_hash, generate_password_hash

from db import execute, query_one
from helpers import ApiError, body, login_required, money_field, text_field

bp = Blueprint("auth", __name__, url_prefix="/api")

PROFILE_COLUMNS = "id, email, full_name, organization, address, balance, created_at"


@bp.before_app_request
def load_user():
    g.user = None
    user_id = session.get("user_id")
    if user_id is not None and request.endpoint != "static":
        g.user = query_one(f"SELECT {PROFILE_COLUMNS} FROM users WHERE id = %s", (user_id,))
        if g.user is None:
            session.clear()


def check_password(password):
    if password is None or len(password) < 8:
        raise ApiError("password must be at least 8 characters")
    return password


@bp.post("/register")
def register():
    data = body()
    email = text_field(data, "email", max_len=255).lower()
    if "@" not in email:
        raise ApiError("email is not valid")
    password = check_password(data.get("password"))
    try:
        user = query_one(
            f"""
            INSERT INTO users (email, password_hash, full_name, organization, address)
            VALUES (%s, %s, %s, %s, %s)
            RETURNING {PROFILE_COLUMNS}
            """,
            (
                email,
                generate_password_hash(password),
                text_field(data, "full_name", max_len=255),
                text_field(data, "organization", required=False, max_len=255),
                text_field(data, "address", max_len=500),
            ),
        )
    except UniqueViolation:
        raise ApiError("an account with that email already exists", 409)
    session.clear()
    session["user_id"] = user["id"]
    return jsonify(user), 201


@bp.post("/login")
def login():
    data = body()
    email = text_field(data, "email")
    password = text_field(data, "password")
    row = query_one("SELECT id, password_hash FROM users WHERE LOWER(email) = LOWER(%s)", (email,))
    if row is None or not check_password_hash(row["password_hash"], password):
        raise ApiError("incorrect email or password", 401)
    session.clear()
    session["user_id"] = row["id"]
    return jsonify(query_one(f"SELECT {PROFILE_COLUMNS} FROM users WHERE id = %s", (row["id"],)))


@bp.post("/logout")
def logout():
    session.clear()
    return jsonify(ok=True)


@bp.get("/me")
@login_required
def me():
    return jsonify(g.user)


@bp.patch("/me")
@login_required
def update_profile():
    data = body()
    fields = {}
    for key, max_len in (("full_name", 255), ("address", 500), ("email", 255)):
        if key in data:
            fields[key] = text_field(data, key, max_len=max_len)
    if "organization" in data:
        fields["organization"] = text_field(data, "organization", required=False, max_len=255)
    if "email" in fields:
        fields["email"] = fields["email"].lower()
        if "@" not in fields["email"]:
            raise ApiError("email is not valid")
    if not fields:
        raise ApiError("nothing to update")
    assignments = ", ".join(f"{key} = %({key})s" for key in fields)
    try:
        user = query_one(
            f"UPDATE users SET {assignments} WHERE id = %(id)s RETURNING {PROFILE_COLUMNS}",
            {**fields, "id": g.user["id"]},
        )
    except UniqueViolation:
        raise ApiError("an account with that email already exists", 409)
    return jsonify(user)


@bp.post("/me/password")
@login_required
def change_password():
    data = body()
    current = text_field(data, "current_password")
    new = check_password(data.get("new_password"))
    row = query_one("SELECT password_hash FROM users WHERE id = %s", (g.user["id"],))
    if not check_password_hash(row["password_hash"], current):
        raise ApiError("current password is incorrect", 403)
    execute(
        "UPDATE users SET password_hash = %s WHERE id = %s",
        (generate_password_hash(new), g.user["id"]),
    )
    return jsonify(ok=True)


@bp.post("/me/balance")
@login_required
def add_funds():
    amount = money_field(body(), "amount", min_value=Decimal("0.01"), max_value=Decimal("100000"))
    row = query_one(
        "UPDATE users SET balance = balance + %s WHERE id = %s RETURNING balance",
        (amount, g.user["id"]),
    )
    return jsonify(balance=row["balance"])
