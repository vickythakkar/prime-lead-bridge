const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  const { data: contacts, error: e1 } = await supabaseAdmin.from('contacts').select('*');
  console.log('Contacts:', contacts);

  const { data: logs, error: e2 } = await supabaseAdmin.from('call_logs').select('*').order('created_at', { ascending: false }).limit(2);
  console.log('Logs:', logs);
}
check();
