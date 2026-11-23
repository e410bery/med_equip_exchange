MedEquip Exchange - CompSci 316 Open Project, Milestone 3

Team: Zhong Zhao, Ella Fortenbery, Colin Zeng, Ben Goihman
GitHub: https://github.com/e410bery/med_equip_exchange
Video: https://drive.google.com/file/d/1YdAe6o2kRMBZMZPWuEQ7FyEuWx5KVpFd/view?usp=drive_link


What each of us did since Milestone 2, and where to find it
------------------------------------------------------------

Colin Zeng - Cart, checkout, order details, and maintenance/certification records
  Expanded the schema and seed data and built the Flask API for the
  project's features. Built these pages:
  - Shopping cart: change quantities, remove items, and see stock and
    balance warnings before checkout.
  - Checkout and order confirmation: review the shipping address, items,
    and balance, then place the order. Checkout is all-or-nothing, and
    the page explains why it's blocked (stock problems or low balance).
  - Order details: each item's price paid and fulfillment status,
    linked from the previous orders page.
  - Maintenance and certification management for sellers: add, edit,
    and delete records for each listing, with alerts for expired or
    expiring certifications and overdue maintenance. Open it for a
    listing with docs/records.html?item_id=<id>.
  Endpoints: routes/shop.py
    GET    /api/cart                   (view_cart)
    PATCH  /api/cart/items/<item_id>   (update_cart_line)
    DELETE /api/cart/items/<item_id>   (remove_from_cart)
    POST   /api/checkout               (checkout)
    GET    /api/orders/<order_id>      (order_detail)
  Endpoints: routes/seller.py
    GET    /api/seller/listings/<id>/records          (list_records)
    POST   /api/seller/listings/<id>/maintenance      (add_record)
    POST   /api/seller/listings/<id>/certifications   (add_record)
    PUT    /api/seller/maintenance/<id>               (correct_record)
    PUT    /api/seller/certifications/<id>            (correct_record)
    DELETE /api/seller/maintenance/<id>               (delete_record)
    DELETE /api/seller/certifications/<id>            (delete_record)
    GET    /api/seller/alerts                         (alerts)
  Frontend: docs/cart.html, docs/js/cart.js, docs/checkout.html,
            docs/js/checkout.js, docs/order.html, docs/js/order.js,
            docs/records.html, docs/js/records.js, docs/js/api.js,
            docs/css/style.css

Zhong Zhao - Browse and search equipment
  Built equipment browsing with keyword search, filters (category,
  manufacturer, condition, location, price), sorting, and pagination,
  and connected listings to the cart.
  Endpoint: routes/products.py
    GET    /api/items
  Frontend: docs/products.html, docs/js/products.js, docs/css/products.css

Ella Fortenbery - User profile, funds, order history, and account deletion
  Built pages to view and edit a user's profile, add funds to their
  balance, see past orders, and delete their account (password
  confirmed, past orders kept).
  Endpoints: routes/auth.py, routes/shop.py
    DELETE /api/me                     (delete_account)
    GET    /api/me
    PATCH  /api/me
    POST   /api/me/balance
    GET    /api/orders
  Frontend: docs/user.html, docs/js/user.js, docs/add_funds.html,
            docs/js/add_funds.js, docs/orders.html, docs/js/orders.js

Ben Goihman - Seller dashboard
  Built a seller dashboard to restock listings, fulfill whole orders,
  and see customers and reviews.
  Endpoints: routes/seller_tools.py
    GET    /api/seller/customers                 (my_customers)
    GET    /api/seller/reviews                   (reviews_received)
    POST   /api/seller/orders/<order_id>/fulfill (fulfill_order)
    POST   /api/seller/listings/<id>/restock     (restock)
  Frontend: docs/seller.html, docs/js/seller.js


Running locally
---------------
  pip install -r requirements.txt
  python app.py      (run from the project root, not docs/)
  Then open http://127.0.0.1:5000/ - Flask serves both the API and the pages.
  .env needs DATABASE_URL and SECRET_KEY (see .env.example).
  Sample login: labsupply@example.com / password123
