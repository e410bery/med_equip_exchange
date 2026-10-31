-- Sample data for development. Every user's password is "password123".
-- WARNING: wipes all existing rows first so the script can be re-run.
-- Dates assume "today" is around 2026-10-31, so some certifications are
-- expired or expiring soon and some maintenance is overdue.
TRUNCATE rentals, certifications, maintenance_records, seller_reviews, item_reviews,
    line_items, orders, items, manufacturers, categories, users RESTART IDENTITY CASCADE;

-- Users 4, 5, 6 are organizations that sell; user 8 is a buyer who also sells.
INSERT INTO users (email, password_hash, full_name, organization, address, balance) VALUES
('alice@example.com', 'scrypt:32768:8:1$TJEPHq42qMlZ5voI$1f556cffd76c84413cb15e51a3e9e450e0ee531a9e5bd26721b4d16f33895499d144c278f30d5d5523dd32fbe4fe4aa8b4a94e06e430b252706e3c130b8fc1bb', 'Alice Chen', NULL, '101 Main St, Durham, NC', 5000.00),
('bob@example.com', 'scrypt:32768:8:1$TJEPHq42qMlZ5voI$1f556cffd76c84413cb15e51a3e9e450e0ee531a9e5bd26721b4d16f33895499d144c278f30d5d5523dd32fbe4fe4aa8b4a94e06e430b252706e3c130b8fc1bb', 'Bob Patel', NULL, '22 Oak Ave, Raleigh, NC', 1200.00),
('carol@example.com', 'scrypt:32768:8:1$TJEPHq42qMlZ5voI$1f556cffd76c84413cb15e51a3e9e450e0ee531a9e5bd26721b4d16f33895499d144c278f30d5d5523dd32fbe4fe4aa8b4a94e06e430b252706e3c130b8fc1bb', 'Carol Diaz', NULL, '7 Pine Rd, Chapel Hill, NC', 300.00),
('dukeclinic@example.com', 'scrypt:32768:8:1$TJEPHq42qMlZ5voI$1f556cffd76c84413cb15e51a3e9e450e0ee531a9e5bd26721b4d16f33895499d144c278f30d5d5523dd32fbe4fe4aa8b4a94e06e430b252706e3c130b8fc1bb', 'Durham Community Clinic', 'Durham Community Clinic', '500 Erwin Rd, Durham, NC', 20000.00),
('labsupply@example.com', 'scrypt:32768:8:1$TJEPHq42qMlZ5voI$1f556cffd76c84413cb15e51a3e9e450e0ee531a9e5bd26721b4d16f33895499d144c278f30d5d5523dd32fbe4fe4aa8b4a94e06e430b252706e3c130b8fc1bb', 'Triangle Lab Supply', 'Triangle Lab Supply LLC', '88 Research Dr, RTP, NC', 1500.00),
('rehab@example.com', 'scrypt:32768:8:1$TJEPHq42qMlZ5voI$1f556cffd76c84413cb15e51a3e9e450e0ee531a9e5bd26721b4d16f33895499d144c278f30d5d5523dd32fbe4fe4aa8b4a94e06e430b252706e3c130b8fc1bb', 'Raleigh Rehab Partners', 'Raleigh Rehab Partners', '410 Glenwood Ave, Raleigh, NC', 800.00),
('dan@example.com', 'scrypt:32768:8:1$TJEPHq42qMlZ5voI$1f556cffd76c84413cb15e51a3e9e450e0ee531a9e5bd26721b4d16f33895499d144c278f30d5d5523dd32fbe4fe4aa8b4a94e06e430b252706e3c130b8fc1bb', 'Dan Kim', NULL, '15 Kildaire Farm Rd, Cary, NC', 2500.00),
('eve@example.com', 'scrypt:32768:8:1$TJEPHq42qMlZ5voI$1f556cffd76c84413cb15e51a3e9e450e0ee531a9e5bd26721b4d16f33895499d144c278f30d5d5523dd32fbe4fe4aa8b4a94e06e430b252706e3c130b8fc1bb', 'Eve Johnson', NULL, '9 Ninth St, Durham, NC', 950.00);

INSERT INTO categories (name) VALUES
('Mobility'),                -- 1
('Diagnostic Imaging'),      -- 2
('Patient Care'),            -- 3
('Prosthetics & Orthotics'), -- 4
('Laboratory'),              -- 5
('Surgical'),                -- 6
('PPE & Disposables'),       -- 7
('Patient Monitoring'),      -- 8
('Respiratory'),             -- 9
('Rehabilitation');          -- 10

INSERT INTO manufacturers (name) VALUES
('Invacare'),          -- 1
('Drive Medical'),     -- 2
('GE Healthcare'),     -- 3
('Philips'),           -- 4
('Hill-Rom'),          -- 5
('Ottobock'),          -- 6
('Eppendorf'),         -- 7
('Thermo Fisher'),     -- 8
('Medline'),           -- 9
('3M'),                -- 10
('Masimo'),            -- 11
('ResMed'),            -- 12
('Butterfly Network'), -- 13
('Stryker'),           -- 14
('Welch Allyn'),       -- 15
('Omron');             -- 16

-- Items with rental_rate/rental_units can also be rented (bonus feature X1).
INSERT INTO items (seller_id, category_id, manufacturer_id, name, model, description, specifications, condition, location, price, quantity, rental_rate, rental_units) VALUES
(4, 1, 2, 'Standard Manual Wheelchair', 'Cruiser III', 'Folding steel-frame wheelchair with swing-away footrests. Lightly used.', E'Seat width: 18 in\nWeight capacity: 300 lb\nFrame: carbon steel\nWeight: 36 lb', 'Good', 'Durham, NC', 189.99, 6, 12.00, 2),
(4, 2, 13, 'Portable Ultrasound Scanner', 'iQ3', 'Handheld whole-body ultrasound probe that pairs with a phone or tablet. Includes case.', E'Transducer: single-probe ultrasound-on-chip\nDepth: up to 30 cm\nBattery: 2 hr scanning', 'Like New', 'Durham, NC', 2450.00, 2, 95.00, 1),
(4, 3, 5, 'Adjustable Hospital Bed', 'Centra', 'Semi-electric bed with side rails and pressure-relief mattress. Sanitized.', E'Height range: 15-23 in\nWeight capacity: 450 lb\nPower: 120 V', 'Good', 'Durham, NC', 875.00, 3, 30.00, 2),
(4, 4, 6, 'Below-Knee Prosthetic Pylon', '2R77', 'Titanium pylon compatible with standard pyramid adapters.', E'Diameter: 30 mm\nMaterial: titanium\nMax user weight: 275 lb', 'New', 'Durham, NC', 320.00, 4, NULL, 0),
(5, 5, 8, 'Benchtop Centrifuge', 'Sorvall ST8', 'Compact 6-place centrifuge with digital timer. Factory refurbished.', E'Max speed: 4000 RPM\nCapacity: 6 x 50 mL\nTimer: 1-99 min', 'Refurbished', 'RTP, NC', 640.00, 5, NULL, 0),
(5, 5, 7, 'Digital Micropipette Set', 'Research plus', 'Set of 3 adjustable single-channel pipettes with stand.', E'Ranges: 2-20 uL, 20-200 uL, 100-1000 uL\nAutoclavable: yes', 'Like New', 'RTP, NC', 155.50, 10, NULL, 0),
(5, 6, 9, 'Surgical Instrument Kit', 'Basic Minor', 'Stainless steel kit: scalpel handles, forceps, scissors, needle holder. Autoclavable.', E'Pieces: 12\nMaterial: surgical stainless steel\nCase: aluminum tray', 'New', 'RTP, NC', 210.00, 8, NULL, 0),
(5, 7, 10, 'N95 Respirator Masks (Box of 50)', '1860', 'NIOSH-approved N95 respirators in sealed boxes.', E'Filtration: 95% (NIOSH N95)\nCount: 50\nSizes: regular', 'New', 'RTP, NC', 45.00, 40, NULL, 0),
(5, 8, 11, 'Pulse Oximeter', 'MightySat', 'Fingertip pulse oximeter with OLED display.', E'SpO2 range: 70-100%\nBattery: 2 x AAA', 'New', 'RTP, NC', 29.99, 25, NULL, 0),
(4, 1, 2, 'Aluminum Walker', '10210-1', 'Two-wheel folding walker, height adjustable.', E'Height range: 32-39 in\nWeight capacity: 350 lb', 'Good', 'Durham, NC', 59.00, 0, NULL, 0),
(6, 1, 1, 'Lightweight Transport Chair', 'TC-19', 'Aluminum transport chair with hand brakes, folds flat for travel.', E'Seat width: 19 in\nWeight: 19 lb\nWeight capacity: 250 lb', 'Like New', 'Raleigh, NC', 145.00, 4, 8.00, 2),
(6, 10, 2, 'Exercise Peddler', 'Deluxe', 'Arm and leg peddler with adjustable resistance and digital display.', E'Resistance: adjustable knob\nDisplay: time, count, calories', 'Good', 'Raleigh, NC', 49.99, 7, NULL, 0),
(6, 10, 16, 'TENS Unit', 'PM3030', 'Dual-channel electrical nerve stimulator for pain relief.', E'Modes: 6\nIntensity levels: 15\nPads included: 4', 'New', 'Raleigh, NC', 39.95, 12, NULL, 0),
(6, 1, 1, 'Power Wheelchair', 'TDX SP2', 'Mid-wheel drive power chair with new batteries and joystick controller.', E'Top speed: 6 mph\nRange: 15 mi\nWeight capacity: 300 lb', 'Refurbished', 'Raleigh, NC', 3200.00, 1, 60.00, 1),
(6, 4, 6, 'Hinged Knee Brace', 'Genu Arexa', 'Post-operative knee brace with adjustable flexion and extension stops.', E'Sizes: S-XL (adjustable)\nRange of motion: 0-120 degrees', 'New', 'Raleigh, NC', 260.00, 5, NULL, 0),
(4, 8, 4, 'Patient Vital Signs Monitor', 'IntelliVue MX450', 'Bedside monitor for ECG, SpO2, NIBP, and temperature.', E'Display: 12 in touchscreen\nParameters: ECG, SpO2, NIBP, Temp\nBattery: 4 hr', 'Refurbished', 'Durham, NC', 1850.00, 2, 70.00, 1),
(4, 9, 12, 'CPAP Machine', 'AirSense 11', 'Auto-adjusting CPAP with heated humidifier. New mask and tubing included.', E'Pressure range: 4-20 cm H2O\nHumidifier: integrated\nNoise: 26 dBA', 'Like New', 'Durham, NC', 690.00, 3, 25.00, 2),
(4, 9, 4, 'Portable Oxygen Concentrator', 'SimplyGo Mini', 'Pulse-dose concentrator with two batteries and carry bag.', E'Flow settings: 1-5 pulse\nWeight: 5 lb\nBattery: up to 9 hr', 'Good', 'Durham, NC', 1450.00, 2, 45.00, 2),
(5, 5, 8, 'Laboratory Refrigerator', 'TSX505', 'Upright lab refrigerator with temperature alarm and glass door.', E'Capacity: 23 cu ft\nRange: 1-10 C\nAlarm: audible and visual', 'Refurbished', 'RTP, NC', 2100.00, 1, NULL, 0),
(5, 5, 8, 'Vortex Mixer', 'LP Vortex', 'Variable-speed vortex mixer with touch and continuous modes.', E'Speed: 300-3000 RPM\nModes: touch, continuous', 'Good', 'RTP, NC', 85.00, 6, NULL, 0),
(5, 6, 14, 'Electrosurgical Generator', 'System 8', 'Monopolar and bipolar electrosurgical unit, service-checked.', E'Modes: cut, coag, blend\nMax output: 300 W', 'Refurbished', 'RTP, NC', 2800.00, 1, NULL, 0),
(5, 7, 9, 'Nitrile Exam Gloves (Case of 1000)', 'SensiCare', 'Powder-free nitrile exam gloves, size medium.', E'Count: 10 boxes x 100\nSize: M\nLatex-free: yes', 'New', 'RTP, NC', 89.00, 30, NULL, 0),
(8, 8, 15, 'Digital Blood Pressure Monitor', 'ProBP 3400', 'Clinical-grade automatic blood pressure monitor with two cuffs.', E'Cuffs: adult, large adult\nMemory: 99 readings', 'Good', 'Durham, NC', 210.00, 2, NULL, 0),
(8, 2, 15, 'Otoscope and Ophthalmoscope Set', '3.5V Diagnostic', 'Diagnostic set with rechargeable handle. Some wear on case.', E'Voltage: 3.5 V\nHandle: rechargeable lithium-ion', 'Fair', 'Durham, NC', 340.00, 1, NULL, 0),
(4, 3, 9, 'Bedside Commode', 'Elongated 3-in-1', 'Steel bedside commode, also usable as a toilet safety frame.', E'Weight capacity: 350 lb\nHeight: 7 settings', 'New', 'Chapel Hill, NC', 65.00, 9, NULL, 0),
(6, 3, 5, 'Patient Lift', 'Liko Viking', 'Mobile electric patient lift with sling.', E'Lifting capacity: 440 lb\nBattery: rechargeable', 'Good', 'Cary, NC', 1650.00, 1, 40.00, 1),
(5, 8, 3, 'ECG Machine', 'MAC 2000', '12-lead resting ECG with interpretation and printer.', E'Leads: 12\nDisplay: 7 in color\nPrinter: thermal', 'Refurbished', 'RTP, NC', 2650.00, 1, NULL, 0),
(4, 2, 3, 'Handheld Ultrasound', 'Vscan Air', 'Wireless dual-probe pocket ultrasound.', E'Probes: linear and curved/phased\nBattery: 50 min scanning', 'Like New', 'Chapel Hill, NC', 3900.00, 1, NULL, 0),
(6, 10, 9, 'Parallel Bars', '7 ft Adjustable', 'Floor-mounted parallel bars for gait training. Some scuffs.', E'Length: 7 ft\nHeight range: 26-42 in', 'Fair', 'Cary, NC', 480.00, 1, NULL, 0),
(8, 1, 2, 'Forearm Crutches (Pair)', 'Adult', 'Aluminum forearm crutches with ergonomic grips.', E'User height: 5 ft - 6 ft 2 in\nWeight capacity: 300 lb', 'Like New', 'Durham, NC', 35.00, 3, NULL, 0);

-- Orders 1-14 are placed (spread over six months for seller analytics).
-- Orders 15-16 have placed_at NULL, so they are carts.
INSERT INTO orders (buyer_id, placed_at) VALUES
(1, '2026-04-12 14:05:00'),
(2, '2026-05-03 09:30:00'),
(1, '2026-05-20 16:45:00'),
(7, '2026-06-08 11:15:00'),
(3, '2026-06-22 19:00:00'),
(8, '2026-07-04 10:20:00'),
(7, '2026-07-19 13:40:00'),
(1, '2026-08-02 08:55:00'),
(2, '2026-08-25 17:10:00'),
(8, '2026-09-10 12:00:00'),
(7, '2026-09-28 15:30:00'),
(1, '2026-10-05 16:45:00'),
(3, '2026-10-18 09:05:00'),
(2, '2026-10-27 14:25:00'),
(3, NULL),
(2, NULL);

-- Placed orders store unit_price at checkout; cart lines leave it NULL.
-- Orders 11-14 are not fully fulfilled yet.
INSERT INTO line_items (order_id, item_id, quantity, unit_price, fulfilled_at) VALUES
(1, 1, 1, 189.99, '2026-04-14 10:00:00'),
(1, 8, 2, 45.00, '2026-04-13 11:00:00'),
(2, 5, 1, 640.00, '2026-05-05 13:00:00'),
(2, 6, 1, 155.50, '2026-05-06 09:00:00'),
(3, 2, 1, 2450.00, '2026-05-22 15:00:00'),
(4, 17, 1, 690.00, '2026-06-10 10:00:00'),
(4, 9, 2, 29.99, '2026-06-09 12:00:00'),
(5, 13, 1, 39.95, '2026-06-24 10:00:00'),
(5, 12, 1, 49.99, '2026-06-25 14:00:00'),
(6, 8, 3, 45.00, '2026-07-06 10:00:00'),
(6, 22, 1, 89.00, '2026-07-06 10:00:00'),
(7, 11, 1, 145.00, '2026-07-21 10:00:00'),
(7, 15, 1, 260.00, '2026-07-22 10:00:00'),
(8, 16, 1, 1850.00, '2026-08-05 10:00:00'),
(9, 9, 3, 29.99, '2026-08-27 10:00:00'),
(9, 13, 2, 39.95, '2026-08-27 16:00:00'),
(10, 1, 1, 189.99, '2026-09-12 10:00:00'),
(10, 3, 1, 875.00, '2026-09-13 10:00:00'),
(11, 6, 2, 155.50, '2026-09-30 10:00:00'),
(11, 20, 1, 85.00, NULL),
(12, 23, 1, 210.00, NULL),
(12, 8, 1, 45.00, '2026-10-07 10:00:00'),
(13, 9, 1, 29.99, NULL),
(14, 18, 1, 1450.00, NULL),
(14, 25, 2, 65.00, NULL),
(15, 9, 1, NULL, NULL),
(15, 8, 1, NULL, NULL),
(16, 7, 1, NULL, NULL);

-- Every review below is from a buyer who actually purchased from that item/seller.
INSERT INTO item_reviews (reviewer_id, item_id, rating, comment, created_at, updated_at) VALUES
(1, 1, 5, 'Sturdy and folds easily into my trunk.', '2026-04-20 10:00:00', '2026-04-20 10:00:00'),
(1, 2, 4, 'Image quality is great; battery life could be better.', '2026-05-30 10:00:00', '2026-05-30 10:00:00'),
(1, 16, 5, 'Works perfectly, arrived calibrated.', '2026-08-10 10:00:00', '2026-08-10 10:00:00'),
(2, 5, 4, 'Quiet and reliable. Lid latch is a little stiff.', '2026-05-12 10:00:00', '2026-05-12 10:00:00'),
(2, 6, 5, 'Accurate and comfortable to use.', '2026-05-12 10:05:00', '2026-05-12 10:05:00'),
(2, 9, 3, 'Readings are fine but the display is dim outdoors.', '2026-09-01 10:00:00', '2026-09-01 10:00:00'),
(7, 17, 5, 'Like new. Humidifier works great.', '2026-06-15 10:00:00', '2026-06-15 10:00:00'),
(7, 11, 4, 'Light and easy to push.', '2026-07-25 10:00:00', '2026-07-25 10:00:00'),
(7, 6, 4, 'Good set for the price.', '2026-10-02 10:00:00', '2026-10-02 10:00:00'),
(3, 13, 4, 'Helps with my back pain. Pads wear out quickly.', '2026-06-30 10:00:00', '2026-06-30 10:00:00'),
(8, 8, 5, 'Genuine 1860s, sealed boxes.', '2026-07-10 10:00:00', '2026-07-10 10:00:00'),
(8, 3, 4, 'Clean and works well. Remote is a bit worn.', '2026-09-20 10:00:00', '2026-09-20 10:00:00'),
(8, 1, 4, 'Solid chair, a few scratches.', '2026-09-20 10:05:00', '2026-09-20 10:05:00');

INSERT INTO seller_reviews (reviewer_id, seller_id, rating, comment, created_at, updated_at) VALUES
(1, 4, 5, 'Fast shipping and items exactly as described.', '2026-04-20 10:10:00', '2026-04-20 10:10:00'),
(1, 5, 4, 'Good communication.', '2026-04-20 10:15:00', '2026-04-20 10:15:00'),
(2, 5, 4, 'Well packed.', '2026-05-12 10:10:00', '2026-05-12 10:10:00'),
(2, 6, 5, 'Very helpful staff.', '2026-09-01 10:10:00', '2026-09-01 10:10:00'),
(7, 4, 5, 'Great clinic to buy from.', '2026-06-15 10:10:00', '2026-06-15 10:10:00'),
(7, 6, 4, 'Smooth transaction.', '2026-07-25 10:10:00', '2026-07-25 10:10:00'),
(7, 5, 3, 'Second order is taking a while to ship.', '2026-10-15 10:00:00', '2026-10-15 10:00:00'),
(8, 5, 5, 'Quick delivery.', '2026-07-10 10:10:00', '2026-07-10 10:10:00'),
(8, 4, 4, 'Good condition overall.', '2026-09-20 10:10:00', '2026-09-20 10:10:00'),
(3, 6, 5, 'Friendly and fast.', '2026-06-30 10:10:00', '2026-06-30 10:10:00');

-- Items 3, 18, 27 have overdue maintenance (next_due before 2026-10-31).
INSERT INTO maintenance_records (item_id, performed_on, description, performed_by, next_due) VALUES
(2, '2026-03-10', 'Probe calibration and firmware update', 'BioMed Services Inc.', '2027-03-10'),
(3, '2026-02-15', 'Motor and rail inspection; mattress sanitized', 'Durham Community Clinic', '2026-08-15'),
(16, '2025-11-01', 'Battery replacement', 'Philips Service', NULL),
(16, '2026-05-01', 'Full preventive maintenance and NIBP calibration', 'BioMed Services Inc.', '2026-11-01'),
(17, '2026-09-01', 'Filter replacement and pressure check', 'Durham Community Clinic', '2027-03-01'),
(18, '2026-04-20', 'Sieve bed replacement', 'Philips Service', '2026-10-20'),
(5, '2026-01-10', 'Rotor inspection and speed calibration', 'Triangle Lab Supply', '2027-01-10'),
(21, '2026-06-15', 'Output power verification', 'Stryker Service', '2026-12-15'),
(27, '2025-12-05', 'Lead check and electrical safety test', 'GE Service', '2026-06-05'),
(14, '2026-07-01', 'Battery pack and joystick controller replaced', 'Raleigh Rehab Partners', '2027-01-01');

-- Items 16 and 27 have expired certifications; items 2, 3, 21 expire within 30 days.
INSERT INTO certifications (item_id, name, issuer, issued_on, expires_on) VALUES
(2, 'FDA 510(k) Clearance', 'U.S. FDA', '2024-06-01', '2029-06-01'),
(2, 'Electrical Safety Inspection', 'BioMed Services Inc.', '2026-03-10', '2026-11-20'),
(3, 'Sanitization Certificate', 'Durham Community Clinic', '2026-02-15', '2026-11-25'),
(16, 'Electrical Safety Inspection', 'BioMed Services Inc.', '2025-08-01', '2026-08-01'),
(17, 'Sanitization Certificate', 'Durham Community Clinic', '2026-09-01', '2027-09-01'),
(18, 'FAA Approval for In-Flight Use', 'Federal Aviation Administration', '2023-01-15', '2028-01-15'),
(21, 'IEC 60601-1 Compliance', 'UL Solutions', '2025-06-15', '2026-11-10'),
(27, 'Calibration Certificate', 'GE Service', '2025-09-01', '2026-09-01'),
(8, 'NIOSH Approval', 'NIOSH', '2022-01-01', '2027-01-01');

-- Both wheelchair units (item 1) are booked for overlapping dates in early November.
INSERT INTO rentals (item_id, renter_id, unit_no, start_date, end_date, daily_rate, total_price) VALUES
(11, 1, 1, '2026-09-01', '2026-09-14', 8.00, 112.00),
(17, 2, 1, '2026-10-20', '2026-11-19', 25.00, 775.00),
(1, 3, 1, '2026-11-03', '2026-11-10', 12.00, 96.00),
(1, 7, 2, '2026-11-05', '2026-11-07', 12.00, 36.00),
(14, 8, 1, '2026-11-15', '2026-11-29', 60.00, 900.00);
