"""Run a .sql file against DATABASE_URL, e.g. `python run_sql.py db/seed.sql`."""
import sys

from db import get_connection


def main():
    if len(sys.argv) != 2:
        sys.exit("usage: python run_sql.py <file.sql>")
    with open(sys.argv[1]) as f:
        sql = f.read()
    with get_connection() as conn:
        conn.execute(sql)
    print(f"ran {sys.argv[1]}")


if __name__ == "__main__":
    main()
