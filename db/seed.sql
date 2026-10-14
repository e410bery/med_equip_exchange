-- Sample data for development. Every user's password is "password123".
-- WARNING: wipes all existing rows first so the script can be re-run.
TRUNCATE line_items, orders, items, users RESTART IDENTITY CASCADE;

INSERT INTO users (email, password_hash, full_name, address, balance) VALUES
('alice@example.com', 'scrypt:32768:8:1$TJEPHq42qMlZ5voI$1f556cffd76c84413cb15e51a3e9e450e0ee531a9e5bd26721b4d16f33895499d144c278f30d5d5523dd32fbe4fe4aa8b4a94e06e430b252706e3c130b8fc1bb', 'Alice Chen', '101 Main St, Durham, NC', 5000.00),
('bob@example.com', 'scrypt:32768:8:1$TJEPHq42qMlZ5voI$1f556cffd76c84413cb15e51a3e9e450e0ee531a9e5bd26721b4d16f33895499d144c278f30d5d5523dd32fbe4fe4aa8b4a94e06e430b252706e3c130b8fc1bb', 'Bob Patel', '22 Oak Ave, Raleigh, NC', 1200.00),
('carol@example.com', 'scrypt:32768:8:1$TJEPHq42qMlZ5voI$1f556cffd76c84413cb15e51a3e9e450e0ee531a9e5bd26721b4d16f33895499d144c278f30d5d5523dd32fbe4fe4aa8b4a94e06e430b252706e3c130b8fc1bb', 'Carol Diaz', '7 Pine Rd, Chapel Hill, NC', 300.00),
('dukeclinic@example.com', 'scrypt:32768:8:1$TJEPHq42qMlZ5voI$1f556cffd76c84413cb15e51a3e9e450e0ee531a9e5bd26721b4d16f33895499d144c278f30d5d5523dd32fbe4fe4aa8b4a94e06e430b252706e3c130b8fc1bb', 'Durham Community Clinic', '500 Erwin Rd, Durham, NC', 20000.00),
('labsupply@example.com', 'scrypt:32768:8:1$TJEPHq42qMlZ5voI$1f556cffd76c84413cb15e51a3e9e450e0ee531a9e5bd26721b4d16f33895499d144c278f30d5d5523dd32fbe4fe4aa8b4a94e06e430b252706e3c130b8fc1bb', 'Triangle Lab Supply', '88 Research Dr, RTP, NC', 0.00);

-- Sellers: user 4 (clinic) and user 5 (lab supply)
INSERT INTO items (seller_id, name, description, price, quantity) VALUES
(4, 'Standard Manual Wheelchair', 'Folding steel-frame wheelchair, 18" seat, swing-away footrests. Lightly used.', 189.99, 6),
(4, 'Portable Ultrasound Scanner', 'Handheld linear probe ultrasound, 7.5 MHz, calibrated 2026-03. Includes case.', 2450.00, 2),
(4, 'Adjustable Hospital Bed', 'Semi-electric bed with side rails and mattress. Sanitized.', 875.00, 3),
(4, 'Below-Knee Prosthetic Pylon', 'Titanium pylon, 30mm, compatible with standard pyramid adapters.', 320.00, 4),
(5, 'Benchtop Centrifuge', '6-place centrifuge, up to 4000 RPM, digital timer.', 640.00, 5),
(5, 'Digital Micropipette Set', 'Set of 3 adjustable pipettes (2-20, 20-200, 100-1000 uL).', 155.50, 10),
(5, 'Surgical Instrument Kit', 'Stainless steel basic kit: scalpel handles, forceps, scissors, needle holder. Autoclavable.', 210.00, 8),
(5, 'N95 Respirator Masks (Box of 50)', 'NIOSH-approved N95 respirators, sealed boxes.', 45.00, 40),
(5, 'Pulse Oximeter', 'Fingertip pulse oximeter with OLED display.', 29.99, 25),
(4, 'Aluminum Walker', 'Two-wheel folding walker, height adjustable.', 59.00, 0);

-- Orders 1-3 are placed; orders 4-5 have placed_at NULL, so they are carts.
INSERT INTO orders (buyer_id, placed_at) VALUES
(1, '2026-09-20 14:05:00'),
(2, '2026-09-28 09:30:00'),
(1, '2026-10-05 16:45:00'),
(3, NULL),
(2, NULL);

-- Placed orders store unit_price at checkout; cart lines leave it NULL.
INSERT INTO line_items (order_id, item_id, quantity, unit_price, fulfilled_at) VALUES
(1, 1, 1, 189.99, '2026-09-22 10:00:00'),
(1, 8, 2, 45.00, '2026-09-21 11:00:00'),
(2, 5, 1, 640.00, '2026-09-30 13:00:00'),
(2, 6, 1, 155.50, NULL),
(3, 2, 1, 2450.00, NULL),
(4, 9, 1, NULL, NULL),
(4, 8, 1, NULL, NULL),
(5, 7, 1, NULL, NULL);
