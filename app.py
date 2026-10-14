from flask import Flask, jsonify, request

from db import query

app = Flask(__name__)


@app.route("/users")
def users():
    rows = query("SELECT id, email, full_name, address, balance FROM users ORDER BY id")
    return jsonify(rows)


@app.route("/orders")
def orders():
    buyer_id = request.args.get("buyer_id")
    if buyer_id is not None and not buyer_id.isdigit():
        return jsonify(error="buyer_id must be an integer"), 400
    sql = """
        SELECT o.id, o.buyer_id, o.placed_at,
               SUM(li.quantity * li.unit_price) AS total,
               SUM(li.quantity) AS item_count
        FROM orders o
        JOIN line_items li ON li.order_id = o.id
        WHERE o.placed_at IS NOT NULL
    """
    params = {}
    if buyer_id is not None:
        sql += " AND o.buyer_id = %(buyer_id)s"
        params["buyer_id"] = buyer_id
    sql += " GROUP BY o.id ORDER BY o.placed_at DESC"
    return jsonify(query(sql, params))


if __name__ == "__main__":
    app.run(debug=True)
