MedEquip Exchange - CompSci 316 Open Project, Milestone 3

Team: Zhong Zhao, Ella Fortenbery, Colin Zeng, Ben Goihman
GitHub: https://github.com/e410bery/med_equip_exchange
Video: https://drive.google.com/file/d/1YdAe6o2kRMBZMZPWuEQ7FyEuWx5KVpFd/view?usp=drive_link


What each of us did since Milestone 2, and where to find it
------------------------------------------------------------

Colin Zeng - Cart
  Expanded the schema and seed data and built the Flask API for the
  project's features. Built the shopping cart page.
  Endpoints: routes/shop.py
    GET    /api/cart                   (view_cart)
    PATCH  /api/cart/items/<item_id>   (update_cart_line)
    DELETE /api/cart/items/<item_id>   (remove_from_cart)
  Frontend: docs/cart.html, docs/js/cart.js, docs/js/api.js, docs/css/style.css

Zhong Zhao - Browse and search equipment
  Built equipment browsing with keyword search, filters (category,
  manufacturer, condition, location, price), sorting, and pagination,
  and connected listings to the cart.
  Endpoint: routes/products.py
    GET    /api/products
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
  python app.py
  .env needs DATABASE_URL and SECRET_KEY (see .env.example).
  Sample login: labsupply@example.com / password123
