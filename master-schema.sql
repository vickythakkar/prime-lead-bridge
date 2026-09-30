-- ============================================================
-- PRIME REAL OPS PLATFORM — Database Setup
-- Run this entire file in Supabase SQL Editor
-- ============================================================

-- ORGANIZATIONS (Brokerages / Real Estate Teams)
CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  main_office_number TEXT,
  twilio_ivr_number TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- AGENTS (The individuals who get calls routed to them)
CREATE TABLE IF NOT EXISTS agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  cell_phone TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- PROPERTIES
CREATE TABLE IF NOT EXISTS properties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  agent_id UUID REFERENCES agents(id) ON DELETE SET NULL,
  address TEXT NOT NULL,
  street_number TEXT,
  zip_code TEXT,
  seller_phone TEXT,
  route_to TEXT DEFAULT 'seller', -- 'seller' or 'agent'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- LEADS
CREATE TABLE IF NOT EXISTS leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  property_id UUID REFERENCES properties(id) ON DELETE SET NULL,
  caller_phone TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- CALL LOGS
CREATE TABLE IF NOT EXISTS call_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
  from_number TEXT NOT NULL,
  to_number TEXT NOT NULL,
  duration INTEGER DEFAULT 0,
  status TEXT DEFAULT 'completed',
  twilio_call_sid TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Disable Row Level Security (since this is an MVP private app)
ALTER TABLE organizations DISABLE ROW LEVEL SECURITY;
ALTER TABLE agents DISABLE ROW LEVEL SECURITY;
ALTER TABLE properties DISABLE ROW LEVEL SECURITY;
ALTER TABLE leads DISABLE ROW LEVEL SECURITY;
ALTER TABLE call_logs DISABLE ROW LEVEL SECURITY;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_agents_org ON agents(organization_id);
CREATE INDEX IF NOT EXISTS idx_properties_org ON properties(organization_id);
CREATE INDEX IF NOT EXISTS idx_properties_zip ON properties(zip_code);
CREATE INDEX IF NOT EXISTS idx_properties_street ON properties(street_number);
CREATE INDEX IF NOT EXISTS idx_leads_org ON leads(organization_id);
CREATE INDEX IF NOT EXISTS idx_call_logs_org ON call_logs(organization_id);
-- ============================================================
-- PRIME LEAD BRIDGE — Database Setup (V2 - Homelystic Upgrade)
-- ============================================================
-- NOTE: This script drops existing tables to recreate them with the new schema. 
-- Do not run in production if you have real data!

DROP TABLE IF EXISTS call_logs CASCADE;
DROP TABLE IF EXISTS leads CASCADE;
DROP TABLE IF EXISTS properties CASCADE;
DROP TABLE IF EXISTS organization_numbers CASCADE;
DROP TABLE IF EXISTS agents CASCADE;
DROP TABLE IF EXISTS organizations CASCADE;
DROP TABLE IF EXISTS admin_settings CASCADE;

-- 1. ADMIN SETTINGS (Global billing rates)
CREATE TABLE admin_settings (
  id INTEGER PRIMARY KEY DEFAULT 1,
  one_time_number_charge NUMERIC(10, 2) DEFAULT 2.00,
  monthly_number_charge NUMERIC(10, 2) DEFAULT 2.00,
  twilio_per_minute_cost NUMERIC(10, 4) DEFAULT 0.0125,
  broker_per_minute_charge NUMERIC(10, 4) DEFAULT 0.0500,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default admin settings
INSERT INTO admin_settings (id) VALUES (1);

-- 2. ORGANIZATIONS (Brokerages / Real Estate Teams)
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  company_name TEXT, -- Used for IVR Greetings
  subscription_plan TEXT DEFAULT 'basic', -- 'basic' or 'pro'
  available_minutes INTEGER DEFAULT 0,
  billing_cycle_start TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. AGENTS (The individuals who get calls routed to them)
CREATE TABLE agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  cell_phone TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. ORGANIZATION NUMBERS (Twilio Numbers purchased by a Broker)
CREATE TABLE organization_numbers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  phone_number TEXT NOT NULL,
  twilio_sid TEXT NOT NULL,
  status TEXT DEFAULT 'active',
  purchased_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. PROPERTIES
CREATE TABLE properties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  organization_number_id UUID REFERENCES organization_numbers(id) ON DELETE SET NULL, -- The number assigned to this property
  agent_id UUID REFERENCES agents(id) ON DELETE SET NULL,
  address TEXT NOT NULL,
  street_number TEXT,
  zip_code TEXT,
  seller_name TEXT,
  seller_email TEXT,
  seller_phone TEXT,
  route_to TEXT DEFAULT 'seller', -- 'seller' or 'agent'
  is_active BOOLEAN DEFAULT true,
  is_deleted BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. LEADS
CREATE TABLE leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  property_id UUID REFERENCES properties(id) ON DELETE SET NULL,
  caller_phone TEXT NOT NULL,
  status TEXT DEFAULT 'new',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. CALL LOGS
CREATE TABLE call_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  property_id UUID REFERENCES properties(id) ON DELETE SET NULL,
  agent_id UUID REFERENCES agents(id) ON DELETE SET NULL,
  organization_number_id UUID REFERENCES organization_numbers(id) ON DELETE SET NULL,
  
  call_type TEXT NOT NULL, -- 'inbound' or 'outbound'
  from_number TEXT NOT NULL,
  to_number TEXT NOT NULL,
  forwarded_to TEXT, -- Where the call was ultimately sent
  
  duration INTEGER DEFAULT 0,
  status TEXT DEFAULT 'completed',
  twilio_call_sid TEXT,
  recording_url TEXT, -- URL in Supabase Storage
  
  cost_twilio NUMERIC(10, 4) DEFAULT 0,
  cost_broker NUMERIC(10, 4) DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Disable Row Level Security (since this is an MVP private app)
ALTER TABLE admin_settings DISABLE ROW LEVEL SECURITY;
ALTER TABLE organizations DISABLE ROW LEVEL SECURITY;
ALTER TABLE agents DISABLE ROW LEVEL SECURITY;
ALTER TABLE organization_numbers DISABLE ROW LEVEL SECURITY;
ALTER TABLE properties DISABLE ROW LEVEL SECURITY;
ALTER TABLE leads DISABLE ROW LEVEL SECURITY;
ALTER TABLE call_logs DISABLE ROW LEVEL SECURITY;

-- Indexes for performance
CREATE INDEX idx_agents_org ON agents(organization_id);
CREATE INDEX idx_org_numbers_org ON organization_numbers(organization_id);
CREATE INDEX idx_properties_org ON properties(organization_id);
CREATE INDEX idx_properties_zip ON properties(zip_code);
CREATE INDEX idx_properties_street ON properties(street_number);
CREATE INDEX idx_leads_org ON leads(organization_id);
CREATE INDEX idx_call_logs_org ON call_logs(organization_id);
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
-- ============================================================
-- PRIME LEAD BRIDGE — Schema Update V5 (Finalization)
-- ============================================================

-- 1. Add IVR Configuration to Organizations
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS ivr_flow_config JSONB DEFAULT '{}'::jsonb;

-- 2. Contacts Table (CRM)
CREATE TABLE IF NOT EXISTS contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Voicemails Table
CREATE TABLE IF NOT EXISTS voicemails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  from_number TEXT NOT NULL,
  recording_url TEXT NOT NULL,
  duration INTEGER DEFAULT 0,
  status TEXT DEFAULT 'new', -- 'new' or 'listened'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

DROP TABLE IF EXISTS messages CASCADE;
DROP TABLE IF EXISTS conversations CASCADE;
-- 4. SMS Conversations
CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  contact_phone TEXT NOT NULL,
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  last_message TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organization_id, contact_phone)
);

-- 5. SMS Messages
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  sender_type TEXT NOT NULL, -- 'agent' or 'contact'
  text TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Disable Row Level Security (since this is an MVP private app)
ALTER TABLE contacts DISABLE ROW LEVEL SECURITY;
ALTER TABLE voicemails DISABLE ROW LEVEL SECURITY;
ALTER TABLE conversations DISABLE ROW LEVEL SECURITY;
ALTER TABLE messages DISABLE ROW LEVEL SECURITY;

-- Create Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_contacts_org ON contacts(organization_id);
CREATE INDEX IF NOT EXISTS idx_contacts_phone ON contacts(phone);
CREATE INDEX IF NOT EXISTS idx_voicemails_org ON voicemails(organization_id);
CREATE INDEX IF NOT EXISTS idx_conversations_org ON conversations(organization_id);
CREATE INDEX IF NOT EXISTS idx_messages_conv ON messages(conversation_id);

-- FINAL FIXES
ALTER TABLE conversations RENAME COLUMN last_message TO last_message_body;
ALTER TABLE conversations RENAME COLUMN updated_at TO last_message_at;
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE;

ALTER TABLE messages RENAME COLUMN sender_type TO direction;
ALTER TABLE messages RENAME COLUMN text TO body;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS message_sid TEXT;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS is_read BOOLEAN DEFAULT FALSE;

