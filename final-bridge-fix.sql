ALTER TABLE admins ADD COLUMN IF NOT EXISTS name TEXT;

ALTER TABLE billing_rates RENAME COLUMN tier_name TO name;
ALTER TABLE billing_rates ADD COLUMN IF NOT EXISTS rate_per_minute NUMERIC(10,4);
ALTER TABLE billing_rates ADD COLUMN IF NOT EXISTS overage_multiplier NUMERIC(10,2);
ALTER TABLE billing_rates ADD COLUMN IF NOT EXISTS payment_window_days INTEGER;
ALTER TABLE billing_rates ADD COLUMN IF NOT EXISTS overage_period TEXT;
ALTER TABLE billing_rates DROP COLUMN IF EXISTS monthly_fee;
ALTER TABLE billing_rates DROP COLUMN IF EXISTS included_minutes;
ALTER TABLE billing_rates DROP COLUMN IF EXISTS overage_rate;

ALTER TABLE properties ADD COLUMN IF NOT EXISTS organization_number_id UUID;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS agent_id UUID;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS street_number TEXT;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS zip_code TEXT;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS seller_name TEXT;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS seller_email TEXT;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS seller_phone TEXT;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS route_to TEXT;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS is_active BOOLEAN;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN;

ALTER TABLE voicemails ADD COLUMN IF NOT EXISTS contact_id UUID;
ALTER TABLE voicemails ADD COLUMN IF NOT EXISTS recording_sid TEXT;
ALTER TABLE voicemails ADD COLUMN IF NOT EXISTS listened BOOLEAN;
ALTER TABLE voicemails DROP COLUMN IF EXISTS status;

