-- ============================================================
-- IT-HR Operational Intelligence Platform — Initial Schema
-- ============================================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- DEPARTMENTS
-- ============================================================
CREATE TABLE departments (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name       TEXT NOT NULL,
  head_id    UUID,                        -- FK to employees (added after employees table)
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- EMPLOYEES
-- ============================================================
CREATE TYPE employee_status AS ENUM ('active', 'inactive', 'offboarding');

CREATE TABLE employees (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  full_name     TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE,
  department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
  job_title     TEXT NOT NULL,
  hire_date     DATE NOT NULL,
  status        employee_status NOT NULL DEFAULT 'active',
  manager_id    UUID REFERENCES employees(id) ON DELETE SET NULL,
  phone         TEXT,
  location      TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Back-fill departments.head_id FK now that employees exists
ALTER TABLE departments
  ADD CONSTRAINT fk_departments_head
  FOREIGN KEY (head_id) REFERENCES employees(id) ON DELETE SET NULL;

-- ============================================================
-- ASSETS
-- ============================================================
CREATE TYPE asset_type AS ENUM (
  'laptop', 'desktop', 'monitor', 'phone', 'tablet',
  'server', 'network', 'other'
);

CREATE TYPE asset_status AS ENUM ('available', 'assigned', 'maintenance', 'retired');

CREATE TABLE assets (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name            TEXT NOT NULL,
  asset_type      asset_type NOT NULL,
  serial_number   TEXT,
  model           TEXT,
  manufacturer    TEXT,
  purchase_date   DATE,
  warranty_expiry DATE,
  status          asset_status NOT NULL DEFAULT 'available',
  notes           TEXT,
  cost            NUMERIC(12, 2),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- ASSET ASSIGNMENTS
-- ============================================================
CREATE TABLE asset_assignments (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  asset_id      UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  employee_id   UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  assigned_date DATE NOT NULL,
  returned_date DATE,
  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TICKETS
-- ============================================================
CREATE TYPE ticket_priority AS ENUM ('critical', 'high', 'medium', 'low');
CREATE TYPE ticket_category AS ENUM ('hardware', 'software', 'network', 'access', 'security', 'other');
CREATE TYPE ticket_status   AS ENUM ('open', 'in_progress', 'pending', 'resolved', 'closed');

CREATE TABLE tickets (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ticket_number  TEXT NOT NULL UNIQUE,
  title          TEXT NOT NULL,
  description    TEXT NOT NULL,
  priority       ticket_priority NOT NULL DEFAULT 'medium',
  category       ticket_category NOT NULL DEFAULT 'other',
  status         ticket_status NOT NULL DEFAULT 'open',
  requester_id   UUID REFERENCES employees(id) ON DELETE SET NULL,
  assignee_id    UUID REFERENCES employees(id) ON DELETE SET NULL,
  sla_due_at     TIMESTAMPTZ,
  resolved_at    TIMESTAMPTZ,
  resolution     TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TICKET COMMENTS
-- ============================================================
CREATE TABLE ticket_comments (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ticket_id   UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  author_id   UUID REFERENCES employees(id) ON DELETE SET NULL,
  content     TEXT NOT NULL,
  is_internal BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- LICENSES
-- ============================================================
CREATE TYPE license_type   AS ENUM ('per_user', 'per_device', 'site', 'concurrent');
CREATE TYPE license_status AS ENUM ('active', 'inactive', 'expired');

CREATE TABLE licenses (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  software_name  TEXT NOT NULL,
  vendor         TEXT,
  license_key    TEXT,
  license_type   license_type NOT NULL DEFAULT 'per_user',
  total_seats    INTEGER NOT NULL CHECK (total_seats > 0),
  expiry_date    DATE,
  cost_per_seat  NUMERIC(10, 2),
  owner_email    TEXT,
  status         license_status NOT NULL DEFAULT 'active',
  last_used_at   TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- SECURITY TRAINING
-- ============================================================
CREATE TABLE security_training (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id   UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  training_name TEXT NOT NULL,
  due_date      DATE NOT NULL,
  completed_at  TIMESTAMPTZ,
  score         NUMERIC(5, 2),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- RISK SCORES
-- ============================================================
CREATE TYPE risk_level AS ENUM ('low', 'medium', 'high', 'critical');

CREATE TABLE risk_scores (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  score       INTEGER NOT NULL CHECK (score >= 0 AND score <= 100),
  risk_level  risk_level NOT NULL,
  factors     JSONB NOT NULL DEFAULT '{}',
  assessed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- AUDIT LOGS
-- ============================================================
CREATE TABLE audit_logs (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  action       TEXT NOT NULL,
  entity_type  TEXT NOT NULL,
  entity_id    UUID,
  details      JSONB NOT NULL DEFAULT '{}',
  performed_by UUID REFERENCES employees(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- UPDATED_AT TRIGGER FUNCTION
-- ============================================================
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_employees_updated_at
  BEFORE UPDATE ON employees
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_assets_updated_at
  BEFORE UPDATE ON assets
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_tickets_updated_at
  BEFORE UPDATE ON tickets
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_licenses_updated_at
  BEFORE UPDATE ON licenses
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- INDEXES
-- ============================================================

-- employees
CREATE INDEX idx_employees_department_id  ON employees(department_id);
CREATE INDEX idx_employees_manager_id     ON employees(manager_id);
CREATE INDEX idx_employees_status         ON employees(status);
CREATE INDEX idx_employees_email          ON employees(email);

-- assets
CREATE INDEX idx_assets_status            ON assets(status);
CREATE INDEX idx_assets_asset_type        ON assets(asset_type);
CREATE INDEX idx_assets_warranty_expiry   ON assets(warranty_expiry);

-- asset_assignments
CREATE INDEX idx_asset_assignments_asset_id    ON asset_assignments(asset_id);
CREATE INDEX idx_asset_assignments_employee_id ON asset_assignments(employee_id);
CREATE INDEX idx_asset_assignments_returned    ON asset_assignments(returned_date);

-- tickets
CREATE INDEX idx_tickets_status        ON tickets(status);
CREATE INDEX idx_tickets_priority      ON tickets(priority);
CREATE INDEX idx_tickets_assignee_id   ON tickets(assignee_id);
CREATE INDEX idx_tickets_requester_id  ON tickets(requester_id);
CREATE INDEX idx_tickets_sla_due_at    ON tickets(sla_due_at);
CREATE INDEX idx_tickets_created_at    ON tickets(created_at DESC);

-- ticket_comments
CREATE INDEX idx_ticket_comments_ticket_id ON ticket_comments(ticket_id);
CREATE INDEX idx_ticket_comments_author_id ON ticket_comments(author_id);

-- licenses
CREATE INDEX idx_licenses_status       ON licenses(status);
CREATE INDEX idx_licenses_last_used_at ON licenses(last_used_at);
CREATE INDEX idx_licenses_expiry_date  ON licenses(expiry_date);

-- security_training
CREATE INDEX idx_security_training_employee_id ON security_training(employee_id);
CREATE INDEX idx_security_training_due_date    ON security_training(due_date);

-- risk_scores
CREATE INDEX idx_risk_scores_employee_id  ON risk_scores(employee_id);
CREATE INDEX idx_risk_scores_risk_level   ON risk_scores(risk_level);
CREATE INDEX idx_risk_scores_assessed_at  ON risk_scores(assessed_at DESC);

-- audit_logs
CREATE INDEX idx_audit_logs_entity_type ON audit_logs(entity_type);
CREATE INDEX idx_audit_logs_entity_id   ON audit_logs(entity_id);
CREATE INDEX idx_audit_logs_created_at  ON audit_logs(created_at DESC);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE departments        ENABLE ROW LEVEL SECURITY;
ALTER TABLE employees          ENABLE ROW LEVEL SECURITY;
ALTER TABLE assets             ENABLE ROW LEVEL SECURITY;
ALTER TABLE asset_assignments  ENABLE ROW LEVEL SECURITY;
ALTER TABLE tickets            ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_comments    ENABLE ROW LEVEL SECURITY;
ALTER TABLE licenses           ENABLE ROW LEVEL SECURITY;
ALTER TABLE security_training  ENABLE ROW LEVEL SECURITY;
ALTER TABLE risk_scores        ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs         ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- RLS POLICIES
-- Principle:
--   • service_role  → full access (bypasses RLS by default in Supabase)
--   • authenticated → SELECT only
--   • anon          → no access
-- ============================================================

-- departments
CREATE POLICY "departments: authenticated read"
  ON departments FOR SELECT TO authenticated USING (true);

-- employees
CREATE POLICY "employees: authenticated read"
  ON employees FOR SELECT TO authenticated USING (true);

-- assets
CREATE POLICY "assets: authenticated read"
  ON assets FOR SELECT TO authenticated USING (true);

-- asset_assignments
CREATE POLICY "asset_assignments: authenticated read"
  ON asset_assignments FOR SELECT TO authenticated USING (true);

-- tickets
CREATE POLICY "tickets: authenticated read"
  ON tickets FOR SELECT TO authenticated USING (true);

-- ticket_comments
CREATE POLICY "ticket_comments: authenticated read"
  ON ticket_comments FOR SELECT TO authenticated USING (true);

-- licenses
CREATE POLICY "licenses: authenticated read"
  ON licenses FOR SELECT TO authenticated USING (true);

-- security_training
CREATE POLICY "security_training: authenticated read"
  ON security_training FOR SELECT TO authenticated USING (true);

-- risk_scores
CREATE POLICY "risk_scores: authenticated read"
  ON risk_scores FOR SELECT TO authenticated USING (true);

-- audit_logs
CREATE POLICY "audit_logs: authenticated read"
  ON audit_logs FOR SELECT TO authenticated USING (true);

-- NOTE: INSERT / UPDATE / DELETE are performed exclusively via the
-- service_role key (used by the backend). The Supabase service_role
-- bypasses RLS entirely, so no explicit write policies are needed.
-- If you ever use the anon/authenticated key for writes, add policies
-- like the example below:
--
-- CREATE POLICY "tickets: authenticated insert"
--   ON tickets FOR INSERT TO authenticated WITH CHECK (true);
