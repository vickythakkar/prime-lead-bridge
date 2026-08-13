-- ============================================================
-- PRIME LEAD BRIDGE — Database Update V3 (Advanced Settings & Billing)
-- ============================================================

-- 1. Add new columns to the organizations table for IVR configuration
ALTER TABLE organizations
ADD COLUMN IF NOT EXISTS play_ivr_greeting BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS ivr_greeting TEXT,
ADD COLUMN IF NOT EXISTS enable_listing_lookup BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS receive_office_calls BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS fallback_when_unavailable TEXT DEFAULT 'voicemail',
ADD COLUMN IF NOT EXISTS fallback_phone_number TEXT;

-- 2. Create the invoices table for monthly billing
CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  month_year TEXT NOT NULL, -- e.g. 'August 2026'
  total_minutes INTEGER DEFAULT 0,
  amount_due NUMERIC(10, 2) DEFAULT 0.00,
  status TEXT DEFAULT 'due', -- 'due', 'overdue', 'paid'
  due_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Disable Row Level Security on the new table (for MVP)
ALTER TABLE invoices DISABLE ROW LEVEL SECURITY;

-- Add index for faster queries
CREATE INDEX IF NOT EXISTS idx_invoices_org ON invoices(organization_id);
