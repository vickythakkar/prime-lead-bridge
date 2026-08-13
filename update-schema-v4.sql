-- ============================================================
-- Prime Lead Bridge — Schema V4: Migration from Twilio-Dialer
-- Run this in the PLB Supabase project SQL Editor
-- ============================================================

-- ── CONTACTS (Multi-Tenant) ─────────────────────────────────
CREATE TABLE IF NOT EXISTS contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  company TEXT,
  notes TEXT,
  custom_fields JSONB DEFAULT '{}'::jsonb,
  avatar_color TEXT DEFAULT '#7c3aed',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contacts_org ON contacts(organization_id);
CREATE INDEX IF NOT EXISTS idx_contacts_phone ON contacts(phone);

-- ── MESSAGES / SMS (Multi-Tenant) ───────────────────────────
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  direction TEXT NOT NULL,
  from_number TEXT NOT NULL,
  to_number TEXT NOT NULL,
  body TEXT NOT NULL,
  twilio_message_sid TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_messages_org ON messages(organization_id);
CREATE INDEX IF NOT EXISTS idx_messages_contact ON messages(contact_id);

-- ── VOICEMAILS (Multi-Tenant) ───────────────────────────────
CREATE TABLE IF NOT EXISTS voicemails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  from_number TEXT NOT NULL,
  recording_url TEXT NOT NULL,
  recording_sid TEXT,
  duration INTEGER DEFAULT 0,
  listened BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_voicemails_org ON voicemails(organization_id);

-- ── UPDATE call_logs — add missing columns ──────────────────
-- Add contact_id if missing
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'call_logs' AND column_name = 'contact_id') THEN
    ALTER TABLE call_logs ADD COLUMN contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Add recording_sid if missing
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'call_logs' AND column_name = 'recording_sid') THEN
    ALTER TABLE call_logs ADD COLUMN recording_sid TEXT;
  END IF;
END $$;

-- Add from_number if missing
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'call_logs' AND column_name = 'from_number') THEN
    ALTER TABLE call_logs ADD COLUMN from_number TEXT;
  END IF;
END $$;

-- Add to_number if missing
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'call_logs' AND column_name = 'to_number') THEN
    ALTER TABLE call_logs ADD COLUMN to_number TEXT;
  END IF;
END $$;

-- Add status if missing
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'call_logs' AND column_name = 'status') THEN
    ALTER TABLE call_logs ADD COLUMN status TEXT DEFAULT 'completed';
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_call_logs_contact ON call_logs(contact_id);

-- ── ADMIN SYSTEM ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS admins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── BILLING RATES ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS billing_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL DEFAULT 'default',
  rate_per_minute NUMERIC(10,4) NOT NULL DEFAULT 0.0250,
  overage_multiplier NUMERIC(5,2) NOT NULL DEFAULT 2.00,
  payment_window_days INTEGER NOT NULL DEFAULT 7,
  overage_period TEXT NOT NULL DEFAULT 'weekly',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default rate: $0.025/min, 2x overage, 7-day window
INSERT INTO billing_rates (name, rate_per_minute, overage_multiplier, payment_window_days)
VALUES ('default', 0.0250, 2.00, 7)
ON CONFLICT DO NOTHING;

-- ── INVOICES ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  billing_period_start DATE NOT NULL,
  billing_period_end DATE NOT NULL,
  total_minutes INTEGER NOT NULL DEFAULT 0,
  total_calls INTEGER NOT NULL DEFAULT 0,
  rate_per_minute NUMERIC(10,4) NOT NULL,
  subtotal NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  overage_amount NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  total_amount NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  status TEXT NOT NULL DEFAULT 'due', -- due, overdue, paid
  due_date DATE NOT NULL,
  paid_date DATE,
  paid_amount NUMERIC(10,2),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invoices_org ON invoices(organization_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);

-- ── ORGANIZATION SETTINGS — add notification preferences ────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'organizations' AND column_name = 'notify_email') THEN
    ALTER TABLE organizations ADD COLUMN notify_email TEXT;
  END IF;
END $$;

-- ── DISABLE RLS for admin tables ────────────────────────────
ALTER TABLE contacts DISABLE ROW LEVEL SECURITY;
ALTER TABLE messages DISABLE ROW LEVEL SECURITY;
ALTER TABLE voicemails DISABLE ROW LEVEL SECURITY;
ALTER TABLE admins DISABLE ROW LEVEL SECURITY;
ALTER TABLE billing_rates DISABLE ROW LEVEL SECURITY;
ALTER TABLE invoices DISABLE ROW LEVEL SECURITY;
