-- WARNING: drops every table first so the schema can be rebuilt from scratch.
-- Run db/seed.sql afterwards to load sample data.
DROP TABLE IF EXISTS rentals, certifications, maintenance_records, seller_reviews,
    item_reviews, line_items, orders, items, manufacturers, categories, users CASCADE;

-- btree_gist lets the rentals EXCLUDE constraint mix "=" on ints with "&&" on ranges.
-- pg_trgm lets ILIKE '%keyword%' searches use an index.
CREATE EXTENSION IF NOT EXISTS btree_gist;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    organization VARCHAR(255),
    address VARCHAR(500) NOT NULL,
    balance DECIMAL(12, 2) NOT NULL DEFAULT 0 CHECK (balance >= 0),
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX users_email_unique ON users (LOWER(email));

CREATE TABLE categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE
);

CREATE TABLE manufacturers (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE
);

-- A listing. Anyone who has listings is a seller.
-- quantity is stock for sale; rental_units is a separate pool of units for rent.
-- Removed listings are soft-deleted (is_active = FALSE) so past orders keep their items.
CREATE TABLE items (
    id SERIAL PRIMARY KEY,
    seller_id INT NOT NULL REFERENCES users(id),
    category_id INT NOT NULL REFERENCES categories(id),
    manufacturer_id INT NOT NULL REFERENCES manufacturers(id),
    name VARCHAR(255) NOT NULL,
    model VARCHAR(100),
    description TEXT NOT NULL,
    specifications TEXT NOT NULL DEFAULT '',
    condition VARCHAR(20) NOT NULL
        CHECK (condition IN ('New', 'Like New', 'Good', 'Fair', 'Refurbished')),
    location VARCHAR(100) NOT NULL,
    price DECIMAL(12, 2) NOT NULL CHECK (price >= 0),
    quantity INT NOT NULL CHECK (quantity >= 0),
    rental_rate DECIMAL(12, 2) CHECK (rental_rate > 0),
    rental_units INT NOT NULL DEFAULT 0 CHECK (rental_units >= 0),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    CHECK (rental_units = 0 OR rental_rate IS NOT NULL)
);

CREATE INDEX items_name_trgm ON items USING GIN (name gin_trgm_ops);
CREATE INDEX items_description_trgm ON items USING GIN (description gin_trgm_ops);
CREATE INDEX items_category_idx ON items (category_id);
CREATE INDEX items_manufacturer_idx ON items (manufacturer_id);
CREATE INDEX items_location_idx ON items (location);
CREATE INDEX items_seller_idx ON items (seller_id);

-- placed_at NULL = the buyer's cart; set to a timestamp at checkout.
CREATE TABLE orders (
    id SERIAL PRIMARY KEY,
    buyer_id INT NOT NULL REFERENCES users(id),
    placed_at TIMESTAMP
);

-- At most one open cart per buyer.
CREATE UNIQUE INDEX orders_one_cart_per_buyer ON orders (buyer_id) WHERE placed_at IS NULL;

-- unit_price is NULL while in a cart and frozen at checkout.
-- fulfilled_at is set by the seller; an order is complete once every line has one.
CREATE TABLE line_items (
    id SERIAL PRIMARY KEY,
    order_id INT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    item_id INT NOT NULL REFERENCES items(id),
    quantity INT NOT NULL CHECK (quantity > 0),
    unit_price DECIMAL(12, 2) CHECK (unit_price >= 0),
    fulfilled_at TIMESTAMP,
    UNIQUE (order_id, item_id)
);

CREATE INDEX line_items_item_idx ON line_items (item_id);

-- One review per buyer per item and per seller (purchase is checked by the app).
CREATE TABLE item_reviews (
    id SERIAL PRIMARY KEY,
    reviewer_id INT NOT NULL REFERENCES users(id),
    item_id INT NOT NULL REFERENCES items(id),
    rating INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
    comment TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE (reviewer_id, item_id)
);

CREATE TABLE seller_reviews (
    id SERIAL PRIMARY KEY,
    reviewer_id INT NOT NULL REFERENCES users(id),
    seller_id INT NOT NULL REFERENCES users(id),
    rating INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
    comment TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE (reviewer_id, seller_id),
    CHECK (reviewer_id <> seller_id)
);

CREATE TABLE maintenance_records (
    id SERIAL PRIMARY KEY,
    item_id INT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    performed_on DATE NOT NULL,
    description TEXT NOT NULL,
    performed_by VARCHAR(255),
    next_due DATE,
    CHECK (next_due IS NULL OR next_due > performed_on)
);

CREATE TABLE certifications (
    id SERIAL PRIMARY KEY,
    item_id INT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    issuer VARCHAR(255) NOT NULL,
    issued_on DATE NOT NULL,
    expires_on DATE NOT NULL,
    CHECK (expires_on > issued_on)
);

-- Each rentable item has units numbered 1..rental_units. The EXCLUDE constraint
-- makes the database itself reject two rentals of the same unit on overlapping
-- dates (both dates inclusive).
CREATE TABLE rentals (
    id SERIAL PRIMARY KEY,
    item_id INT NOT NULL REFERENCES items(id),
    renter_id INT NOT NULL REFERENCES users(id),
    unit_no INT NOT NULL CHECK (unit_no >= 1),
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    daily_rate DECIMAL(12, 2) NOT NULL CHECK (daily_rate > 0),
    total_price DECIMAL(12, 2) NOT NULL CHECK (total_price >= 0),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    CHECK (end_date >= start_date),
    EXCLUDE USING GIST (
        item_id WITH =,
        unit_no WITH =,
        daterange(start_date, end_date, '[]') WITH &&
    )
);
