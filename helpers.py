"""Shared pieces for the API routes: errors, request parsing, and login checks."""
from datetime import date
from decimal import Decimal, InvalidOperation
from functools import wraps

from flask import g, request


class ApiError(Exception):
    """Raise anywhere in a route to return {"error": message} with this status."""

    def __init__(self, message, status=400):
        super().__init__(message)
        self.message = message
        self.status = status


def body():
    """Request fields from a JSON body or an HTML form, whichever was sent."""
    return request.get_json(silent=True) or request.form.to_dict()


def login_required(view):
    @wraps(view)
    def wrapped(*args, **kwargs):
        if g.user is None:
            raise ApiError("login required", 401)
        return view(*args, **kwargs)

    return wrapped


def _missing(value):
    return value is None or (isinstance(value, str) and value.strip() == "")


def text_field(data, key, required=True, max_len=None):
    value = data.get(key)
    if _missing(value):
        if required:
            raise ApiError(f"{key} is required")
        return None
    value = str(value).strip()
    if max_len and len(value) > max_len:
        raise ApiError(f"{key} must be at most {max_len} characters")
    return value


def int_field(data, key, required=True, min_value=None, max_value=None):
    value = data.get(key)
    if _missing(value):
        if required:
            raise ApiError(f"{key} is required")
        return None
    try:
        value = int(value)
    except (TypeError, ValueError):
        raise ApiError(f"{key} must be an integer")
    if min_value is not None and value < min_value:
        raise ApiError(f"{key} must be at least {min_value}")
    if max_value is not None and value > max_value:
        raise ApiError(f"{key} must be at most {max_value}")
    return value


def money_field(data, key, required=True, min_value=Decimal("0"), max_value=Decimal("9999999999")):
    value = data.get(key)
    if _missing(value):
        if required:
            raise ApiError(f"{key} is required")
        return None
    try:
        value = Decimal(str(value))
    except InvalidOperation:
        raise ApiError(f"{key} must be a number")
    if not value.is_finite() or value.as_tuple().exponent < -2:
        raise ApiError(f"{key} must be a number with at most 2 decimal places")
    if value < min_value:
        raise ApiError(f"{key} must be at least {min_value}")
    if value > max_value:
        raise ApiError(f"{key} must be at most {max_value}")
    return value


def date_field(data, key, required=True):
    value = data.get(key)
    if _missing(value):
        if required:
            raise ApiError(f"{key} is required")
        return None
    try:
        return date.fromisoformat(str(value))
    except ValueError:
        raise ApiError(f"{key} must be a date like 2026-11-30")


def choice_field(data, key, choices, required=True):
    value = text_field(data, key, required)
    if value is not None and value not in choices:
        raise ApiError(f"{key} must be one of: {', '.join(choices)}")
    return value
