-- ============================================================
-- KVU ERP — Normalized Supabase Schema
-- Migrated from single-table JSON blob (appdata) to row-level
-- ============================================================

-- 1. CUSTOMERS
CREATE TABLE IF NOT EXISTS customers (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  gender        TEXT CHECK (gender IN ('male', 'female')),
  father        TEXT,
  address       TEXT,
  post          TEXT,
  district      TEXT,
  state         TEXT,
  pincode       TEXT,
  mobile        TEXT,
  aadhar        TEXT,
  gstin         TEXT,
  saved_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at    TIMESTAMPTZ,
  UNIQUE (name, mobile)
);

CREATE INDEX IF NOT EXISTS idx_customers_lookup ON customers (LOWER(TRIM(name)), mobile);

-- 2. QUOTATIONS
CREATE TABLE IF NOT EXISTS quotations (
  ref           TEXT PRIMARY KEY,
  date          TEXT NOT NULL,
  date_val      TEXT,
  cust_name     TEXT NOT NULL,
  gender        TEXT CHECK (gender IN ('male', 'female')),
  relation      TEXT,
  father_name   TEXT,
  address       TEXT,
  post          TEXT,
  district      TEXT,
  state         TEXT,
  pincode       TEXT,
  mobile        TEXT,
  aadhar        TEXT,
  heading       TEXT NOT NULL,
  hsn           TEXT,
  capacity      TEXT,
  power         TEXT,
  discount      NUMERIC(12,2) DEFAULT 0,
  gst_rate      NUMERIC(5,2) DEFAULT 0,
  inc_inst      BOOLEAN DEFAULT FALSE,
  grand_total   NUMERIC(12,2) DEFAULT 0,
  grand_total_fmt TEXT,
  saved_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at    TIMESTAMPTZ
);

-- 3. QUOTATION LINE ITEMS
CREATE TABLE IF NOT EXISTS quotation_line_items (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quotation_ref TEXT NOT NULL REFERENCES quotations(ref) ON DELETE CASCADE,
  sort_order    SMALLINT NOT NULL DEFAULT 0,
  name          TEXT NOT NULL,
  description   TEXT,
  qty           NUMERIC(10,2) DEFAULT 1,
  rate          NUMERIC(12,2) DEFAULT 0,
  amount        NUMERIC(12,2) DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_qli_ref ON quotation_line_items(quotation_ref);

-- 4. BOOKINGS
CREATE TABLE IF NOT EXISTS bookings (
  booking_id       TEXT PRIMARY KEY,
  booking_date     TEXT NOT NULL,
  delivery_date    TEXT,
  cust_name        TEXT NOT NULL,
  cust_gender      TEXT CHECK (cust_gender IN ('male', 'female')),
  relation         TEXT,
  father_name      TEXT,
  address          TEXT,
  post             TEXT,
  district         TEXT,
  state            TEXT,
  pincode          TEXT,
  mobile           TEXT,
  aadhar           TEXT,
  original_price   NUMERIC(12,2) DEFAULT 0,
  additional_charges NUMERIC(12,2) DEFAULT 0,
  discount         NUMERIC(12,2) DEFAULT 0,
  total_amount     NUMERIC(12,2) DEFAULT 0,
  advance_paid     NUMERIC(12,2) DEFAULT 0,
  payment_mode     TEXT DEFAULT 'None',
  balance_due      NUMERIC(12,2) DEFAULT 0,
  payment_status   TEXT DEFAULT 'No Advance',
  required_advance NUMERIC(12,2) DEFAULT 0,
  cyclone          VARCHAR(10) DEFAULT 'No',
  jhanna           VARCHAR(10) DEFAULT 'No',
  tractor          VARCHAR(100),
  hp               VARCHAR(20),
  pully_size       VARCHAR(50),
  pto_shaft        VARCHAR(50),
  notes            TEXT,
  status           TEXT DEFAULT 'Pending' CHECK (status IN ('Pending', 'Delivered', 'Cancelled')),
  saved_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at       TIMESTAMPTZ
);

-- 5. BOOKING LINE ITEMS
CREATE TABLE IF NOT EXISTS booking_line_items (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id    TEXT NOT NULL REFERENCES bookings(booking_id) ON DELETE CASCADE,
  sort_order    SMALLINT NOT NULL DEFAULT 0,
  name          TEXT NOT NULL,
  description   TEXT,
  qty           NUMERIC(10,2) DEFAULT 1,
  rate          NUMERIC(12,2) DEFAULT 0,
  amount        NUMERIC(12,2) DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_bli_booking ON booking_line_items(booking_id);

-- 6. PAYMENTS
CREATE TABLE IF NOT EXISTS payments (
  id              TEXT PRIMARY KEY,
  booking_id      TEXT NOT NULL REFERENCES bookings(booking_id) ON DELETE CASCADE,
  date            TEXT NOT NULL,
  method          TEXT NOT NULL CHECK (method IN ('Cash', 'UPI', 'NEFT/RTGS', 'Cheque', 'None')),
  amount          NUMERIC(12,2) NOT NULL,
  bank_name       TEXT,
  transaction_no  TEXT,
  cheque_no       TEXT,
  cheque_date     TEXT,
  remarks         TEXT,
  entered_by      TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_payments_booking ON payments(booking_id);

-- 7. AUDIT LOGS
CREATE TABLE IF NOT EXISTS audit_logs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id    TEXT NOT NULL REFERENCES bookings(booking_id) ON DELETE CASCADE,
  timestamp     TIMESTAMPTZ NOT NULL,
  user_name     TEXT NOT NULL,
  action        TEXT NOT NULL,
  details       TEXT
);
CREATE INDEX IF NOT EXISTS idx_audit_booking ON audit_logs(booking_id);

-- 8. SEQUENCES
CREATE TABLE IF NOT EXISTS sequences (
  id            TEXT PRIMARY KEY,
  value         INTEGER NOT NULL DEFAULT 0,
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);
INSERT INTO sequences (id, value) VALUES ('quotation', 0), ('booking', 0)
ON CONFLICT (id) DO NOTHING;

-- Atomic sequence increment function (prevents race conditions)
CREATE OR REPLACE FUNCTION increment_sequence(p_type TEXT)
RETURNS INTEGER LANGUAGE plpgsql AS $$
DECLARE
  v_new_val INTEGER;
BEGIN
  UPDATE sequences SET value = value + 1, updated_at = NOW() WHERE id = p_type
  RETURNING value INTO v_new_val;
  IF NOT FOUND THEN
    INSERT INTO sequences (id, value, updated_at) VALUES (p_type, 1, NOW())
    RETURNING value INTO v_new_val;
  END IF;
  RETURN v_new_val;
END;
$$;

-- 10. APP USERS
CREATE TABLE IF NOT EXISTS app_users (
  user_id       TEXT PRIMARY KEY,
  username      TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  salt          TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'Staff',
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- 9. ROW LEVEL SECURITY
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotation_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE booking_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_users ENABLE ROW LEVEL SECURITY;

-- Recommended: Restrictive policies for production
-- Replace "Allow all" with authenticated-user policies:
-- CREATE POLICY "Authenticated read" ON customers FOR SELECT TO authenticated USING (true);
-- CREATE POLICY "Authenticated write" ON customers FOR INSERT, UPDATE TO authenticated WITH CHECK (true);
-- 
-- CREATE POLICY "Authenticated read" ON quotations FOR SELECT TO authenticated USING (true);
-- CREATE POLICY "Authenticated write" ON quotations FOR INSERT, UPDATE TO authenticated WITH CHECK (true);
-- 
-- (Repeat for other tables...)

-- TEMPORARY: Permissive policies for development (REMOVE IN PRODUCTION)
CREATE POLICY "Allow all" ON customers FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON quotations FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON quotation_line_items FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON bookings FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON booking_line_items FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON payments FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON audit_logs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON sequences FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON app_users FOR ALL USING (true) WITH CHECK (true);
