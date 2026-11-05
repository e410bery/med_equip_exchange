import os
from datetime import date, datetime

from flask import Flask, jsonify
from flask.json.provider import DefaultJSONProvider

from db import close_db
from helpers import ApiError
from routes import auth, catalog, rentals, reviews, seller, shop, products


class JSONProvider(DefaultJSONProvider):
    """Send dates as ISO strings ("2026-11-03") instead of Flask's HTTP-date format.
    Money (DECIMAL) is sent as a string like "189.99" so no precision is lost."""

    @staticmethod
    def default(o):
        if isinstance(o, (date, datetime)):
            return o.isoformat()
        return DefaultJSONProvider.default(o)


app = Flask(__name__)
app.json = JSONProvider(app)
# Signs the session cookie that keeps users logged in. Set a long random
# SECRET_KEY in .env (and on any deployed server); the fallback is for local dev only.
app.secret_key = os.environ.get("SECRET_KEY", "dev-only-not-secret")
app.teardown_appcontext(close_db)

for module in (auth, catalog, shop, reviews, rentals, seller, products):
    app.register_blueprint(module.bp)


@app.errorhandler(ApiError)
def handle_api_error(err):
    return jsonify(error=err.message), err.status


@app.errorhandler(404)
def not_found(err):
    return jsonify(error="not found"), 404


@app.errorhandler(405)
def method_not_allowed(err):
    return jsonify(error="method not allowed"), 405


@app.route("/")
def index():
    """Lists every API route, so you can see what's available."""
    routes = sorted(
        (rule.rule, sorted(rule.methods - {"HEAD", "OPTIONS"}))
        for rule in app.url_map.iter_rules()
        if rule.endpoint != "static"
    )
    return jsonify([f"{' '.join(methods)} {path}" for path, methods in routes])


if __name__ == "__main__":
    app.run(debug=True)
