-- ============================================================
-- Hotel Maintenance Request System — Database Schema
-- Run this in Supabase SQL Editor
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- ENUMS
-- ============================================================
CREATE TYPE user_role AS ENUM ('admin', 'manager', 'staff', 'technician');
CREATE TYPE request_status AS ENUM ('pending', 'assigned', 'in_progress', 'completed', 'cancelled');
CREATE TYPE priority_level AS ENUM ('low', 'medium', 'high', 'urgent');
CREATE TYPE request_category AS ENUM (
  'electrical', 'plumbing', 'air_conditioning', 'furniture',
  'cleaning', 'it', 'security', 'other'
);

-- ============================================================
-- PROFILES (extends auth.users)
-- ============================================================
CREATE TABLE profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email       TEXT NOT NULL,
  full_name   TEXT,
  role        user_role NOT NULL DEFAULT 'staff',
  department  TEXT,
  phone       TEXT,
  avatar_url  TEXT,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- LOCATIONS (buildings / floors / rooms)
-- ============================================================
CREATE TABLE locations (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        TEXT NOT NULL,          -- e.g. "ห้อง 101", "ล็อบบี้", "สระว่ายน้ำ"
  floor       TEXT,
  building    TEXT DEFAULT 'Main',
  description TEXT,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- MAINTENANCE REQUESTS
-- ============================================================
CREATE TABLE maintenance_requests (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  request_number  TEXT UNIQUE NOT NULL,  -- e.g. MNT-2024-0001
  title           TEXT NOT NULL,
  description     TEXT,
  category        request_category NOT NULL DEFAULT 'other',
  priority        priority_level NOT NULL DEFAULT 'medium',
  status          request_status NOT NULL DEFAULT 'pending',

  location_id     UUID REFERENCES locations(id),
  location_note   TEXT,                  -- free-text if no structured location

  reported_by     UUID NOT NULL REFERENCES profiles(id),
  assigned_to     UUID REFERENCES profiles(id),

  estimated_cost  NUMERIC(10,2),
  actual_cost     NUMERIC(10,2),

  notes           TEXT,                  -- internal notes from technician
  resolution      TEXT,                  -- how it was resolved

  due_date        TIMESTAMPTZ,
  started_at      TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Auto-generate request number: MNT-YYYY-NNNN
CREATE SEQUENCE IF NOT EXISTS maintenance_request_seq;

CREATE OR REPLACE FUNCTION generate_request_number()
RETURNS TRIGGER AS $$
BEGIN
  NEW.request_number := 'MNT-' || to_char(now(), 'YYYY') || '-' ||
    LPAD(nextval('maintenance_request_seq')::TEXT, 4, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_request_number
  BEFORE INSERT ON maintenance_requests
  FOR EACH ROW EXECUTE FUNCTION generate_request_number();

-- ============================================================
-- ATTACHMENTS (photos / documents)
-- ============================================================
CREATE TABLE attachments (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  request_id  UUID NOT NULL REFERENCES maintenance_requests(id) ON DELETE CASCADE,
  file_name   TEXT NOT NULL,
  file_url    TEXT NOT NULL,
  file_type   TEXT,
  file_size   INTEGER,
  uploaded_by UUID NOT NULL REFERENCES profiles(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- ACTIVITY LOG (status history)
-- ============================================================
CREATE TABLE activity_logs (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  request_id  UUID NOT NULL REFERENCES maintenance_requests(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES profiles(id),
  action      TEXT NOT NULL,           -- e.g. "status_changed", "assigned", "commented"
  old_value   TEXT,
  new_value   TEXT,
  comment     TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- UPDATED_AT TRIGGER
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER requests_updated_at
  BEFORE UPDATE ON maintenance_requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE maintenance_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

-- Helper: get current user role
CREATE OR REPLACE FUNCTION get_my_role()
RETURNS user_role AS $$
  SELECT role FROM profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- PROFILES policies
CREATE POLICY "Users can view all profiles" ON profiles
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE TO authenticated USING (id = auth.uid());

CREATE POLICY "Admins can manage profiles" ON profiles
  FOR ALL TO authenticated USING (get_my_role() = 'admin');

-- LOCATIONS policies
CREATE POLICY "Authenticated users can view locations" ON locations
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins and managers can manage locations" ON locations
  FOR ALL TO authenticated
  USING (get_my_role() IN ('admin', 'manager'));

-- MAINTENANCE REQUESTS policies
CREATE POLICY "Staff can view own requests" ON maintenance_requests
  FOR SELECT TO authenticated
  USING (
    reported_by = auth.uid() OR
    assigned_to = auth.uid() OR
    get_my_role() IN ('admin', 'manager', 'technician')
  );

CREATE POLICY "Authenticated users can create requests" ON maintenance_requests
  FOR INSERT TO authenticated WITH CHECK (reported_by = auth.uid());

CREATE POLICY "Admin/manager can update any request" ON maintenance_requests
  FOR UPDATE TO authenticated
  USING (get_my_role() IN ('admin', 'manager'));

CREATE POLICY "Technician can update assigned requests" ON maintenance_requests
  FOR UPDATE TO authenticated
  USING (assigned_to = auth.uid() AND get_my_role() = 'technician');

CREATE POLICY "Reporter can update own pending requests" ON maintenance_requests
  FOR UPDATE TO authenticated
  USING (reported_by = auth.uid() AND status = 'pending');

-- ATTACHMENTS policies
CREATE POLICY "View attachments of visible requests" ON attachments
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Upload attachments" ON attachments
  FOR INSERT TO authenticated WITH CHECK (uploaded_by = auth.uid());

-- ACTIVITY LOGS policies
CREATE POLICY "View logs" ON activity_logs
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Insert logs" ON activity_logs
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- ============================================================
-- AUTO-CREATE PROFILE ON SIGNUP
-- ============================================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'staff')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================================
-- SEED: Default locations
-- ============================================================
INSERT INTO locations (name, floor, building) VALUES
  ('ล็อบบี้', 'G', 'Main'),
  ('ห้อง 101', '1', 'Main'),
  ('ห้อง 102', '1', 'Main'),
  ('ห้อง 201', '2', 'Main'),
  ('ห้อง 202', '2', 'Main'),
  ('ห้อง 301', '3', 'Main'),
  ('ห้องอาหาร', 'G', 'Main'),
  ('สระว่ายน้ำ', 'G', 'Main'),
  ('ฟิตเนส', '1', 'Main'),
  ('ห้องประชุม A', '2', 'Main'),
  ('ที่จอดรถ', 'B1', 'Main'),
  ('ครัว', 'G', 'Main');

-- ============================================================
-- STORAGE BUCKET for attachments
-- ============================================================
-- Run this separately in Supabase Dashboard > Storage, or via API:
-- INSERT INTO storage.buckets (id, name, public) VALUES ('maintenance-attachments', 'maintenance-attachments', false);
