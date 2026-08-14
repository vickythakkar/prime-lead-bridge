const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function fix() {
  const { data: contacts } = await supabaseAdmin.from('contacts').select('*');
  if (contacts) {
    for (const c of contacts) {
      if (!c.custom_fields || !c.custom_fields.role) {
        let role = 'Seller';
        if (c.name.toLowerCase().includes('darrell') || c.name.toLowerCase().includes('vicky')) {
          role = 'Agent';
        }
        await supabaseAdmin.from('contacts').update({ custom_fields: { role } }).eq('id', c.id);
        console.log('Tagged', c.name, 'as', role);
      }
    }
  }
}
fix();
