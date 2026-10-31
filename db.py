import os

import psycopg
from dotenv import load_dotenv
from flask import g
from psycopg.rows import dict_row

load_dotenv()


def get_connection():
    """A fresh connection, for scripts outside Flask (see run_sql.py)."""
    url = os.environ.get("DATABASE_URL")
    if not url:
        raise RuntimeError("DATABASE_URL is not set")
    return psycopg.connect(url, row_factory=dict_row)


def get_db():
    """One connection per request, reused by every query in that request.

    Autocommit is on, so each statement commits by itself. Anything that must
    be all-or-nothing (checkout, rentals) goes inside `with transaction():`.
    """
    if "db" not in g:
        g.db = get_connection()
        g.db.autocommit = True
    return g.db


def close_db(exc=None):
    conn = g.pop("db", None)
    if conn is not None:
        conn.close()


def query(sql, params=None):
    return get_db().execute(sql, params).fetchall()


def query_one(sql, params=None):
    return get_db().execute(sql, params).fetchone()


def execute(sql, params=None):
    get_db().execute(sql, params)


def transaction():
    """BEGIN ... COMMIT; rolls back if the block raises."""
    return get_db().transaction()
