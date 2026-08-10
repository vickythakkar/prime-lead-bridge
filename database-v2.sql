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
