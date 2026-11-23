"""MS3 product browsing. Existing catalog routes remain unchanged."""
from pathlib import Path

from flask import Blueprint, send_from_directory


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
