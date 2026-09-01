const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  const sql = `
    ALTER TABLE organization_numbers 
    ADD COLUMN IF NOT EXISTS play_ivr_greeting BOOLEAN DEFAULT true,
    ADD COLUMN IF NOT EXISTS ivr_greeting TEXT,
    ADD COLUMN IF NOT EXISTS ivr_offline_message TEXT,
    ADD COLUMN IF NOT EXISTS ivr_flow_config JSONB DEFAULT '{}'::jsonb;
  `;

  const { data, error } = await supabaseAdmin.rpc('exec_sql', {
    sql_query: sql
  });

  if (error) {
    console.error("SQL Error:", error);
  } else {
    console.log("Success:", data);
  }
}

run();
