# med_equip_exchange
CompSci316 Project
GitHub: https://github.com/e410bery/med_equip_exchange

# Zhong Zhao
Designed page-by-page visuals for "Home", "Log In", "Register", "Profile and Organization Settings", "Browse Equipment / Search Results", "Equipment Listing Detail", "Seller Profile", "Shopping Cart", and "Checkout".

# Ella Fortenbery
Designed page-by-page visuals for "Order Confirmation", "My Orders", "Order Details", "Write / Edit Review", "Seller Dashboard", "My Listings", "Create / Edit Listing", "Maintenance and Certification Management", "Seller Orders / Fulfillment".

# Colin Zeng
- Implemented equipment search and browsing, including keyword search
  across equipment names and descriptions and filtering by category,
  manufacturer, condition, and location.
- Created seed.sql to populate the database with synthetic data
  (users, sellers, equipment listings, categories, manufacturers, etc.)
  for development and testing.
- Expanded the database schema by adding tables/attributes to support
  additional features.

# Ben Goihman
- Set up the team's hosted PostgreSQL database on Neon and shared access
  with the team (credentials kept out of the repository).
- Created the database schema by adding tables/attributes to support
  basic features (user, items, etc.).

# Running locally
```
source .venv/bin/activate
pip install -r requirements.txt
python run_sql.py db/create.sql
python run_sql.py db/seed.sql
python app.py
```
`.env` needs `DATABASE_URL` and `SECRET_KEY` (see `.env.example`).
`db/create.sql` drops and rebuilds every table, and `db/seed.sql` wipes and reloads
the sample data, so both reset the shared database for the whole team.
Every seeded user's password is `password123` (e.g. `alice@example.com`, `dukeclinic@example.com`).

# API
All routes return JSON. Logging in sets a session cookie, so requests that need
a user (marked 🔒) must send cookies (`fetch(url, {credentials: "include"})`).
Request bodies can be JSON or form data. Errors look like `{"error": "..."}`.
Money is returned as strings like `"189.99"`; dates as `"2026-11-03"`.
`GET /` lists every route.

| Feature | Route |
|---|---|
| B1 accounts | `POST /api/register` `{email, password, full_name, address, organization?}` · `POST /api/login` `{email, password}` · `POST /api/logout` · 🔒 `GET /api/me` · 🔒 `PATCH /api/me` `{full_name?, email?, address?, organization?}` · 🔒 `POST /api/me/password` `{current_password, new_password}` · 🔒 `POST /api/me/balance` `{amount}` |
| B2 browse | `GET /api/items?q=&category_id=&manufacturer_id=&seller_id=&condition=&location=&min_price=&max_price=&in_stock=1&rentable=1&sort=name\|price_asc\|price_desc\|newest\|rating&page=&per_page=` · `GET /api/filters` (dropdown options) |
| B3 detail | `GET /api/items/<id>` (specs, seller, avg rating, reviews, maintenance, certifications, related) · `GET /api/sellers/<id>` |
| B4 listings | 🔒 `GET /api/seller/listings` · 🔒 `POST /api/seller/listings` · 🔒 `PATCH /api/seller/listings/<id>` · 🔒 `DELETE /api/seller/listings/<id>` |
| B5 cart | 🔒 `GET /api/cart` · 🔒 `POST /api/cart/items` `{item_id, quantity}` · 🔒 `PATCH /api/cart/items/<item_id>` `{quantity}` · 🔒 `DELETE /api/cart/items/<item_id>` · 🔒 `POST /api/checkout` |
| B6 reviews | 🔒 `PUT`/`DELETE /api/items/<id>/review` `{rating, comment}` · 🔒 `PUT`/`DELETE /api/sellers/<id>/review` |
| B7 orders | 🔒 `GET /api/orders` · 🔒 `GET /api/orders/<id>` · 🔒 `GET /api/seller/orders?status=pending\|fulfilled\|all` · 🔒 `POST /api/seller/line-items/<id>/fulfill` |
| B8 records | 🔒 `GET /api/seller/listings/<id>/records` · 🔒 `POST /api/seller/listings/<id>/maintenance` `{performed_on, description, performed_by?, next_due?}` · 🔒 `POST /api/seller/listings/<id>/certifications` `{name, issuer, issued_on, expires_on}` · 🔒 `PUT`/`DELETE /api/seller/maintenance/<id>` and `/api/seller/certifications/<id>` |
| X1 rentals | `GET /api/items/<id>/availability?start_date=&end_date=` · 🔒 `POST /api/items/<id>/rentals` `{start_date, end_date}` · 🔒 `GET /api/rentals` · 🔒 `GET /api/seller/rentals` |
| X2 alerts | 🔒 `GET /api/seller/alerts` · 🔒 `GET /api/seller/dashboard` |
| X3 compare | `GET /api/compare?ids=1,2,3` (2–4 items) |
| X4 analytics | 🔒 `GET /api/seller/analytics?months=12` (monthly sales, top items, turnover) |
