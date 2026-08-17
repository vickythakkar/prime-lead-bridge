const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const ADMIN_ORG_ID = '8a564ec4-9544-4b63-ac58-98ec66d69a76';

async function run() {
  // 1. Restore Admin org name
  await supabase.from('organizations').update({
    name: 'Prime Real Ops Admin',
    company_name: 'Prime Real Ops'
  }).eq('id', ADMIN_ORG_ID);
  console.log("Restored Admin Org Name.");

  // 2. Create a new Organization for the broker
  const { data: newOrg, error: orgErr } = await supabase.from('organizations').insert({
    name: 'DIY Realty',
    company_name: 'DIY Realty',
    subscription_plan: 'basic'
  }).select().single();
  
  if (orgErr || !newOrg) {
    console.error("Failed to create new org:", orgErr);
    return;
  }
  console.log("Created new Broker Organization:", newOrg.id);

  // 3. Move Darrell and VPThakkar to the new organization
  const { data: agents, error: agentsErr } = await supabase.from('agents').select('id, name');
  
  for (const agent of agents) {
    if (agent.name !== 'Vicky') {
      await supabase.from('agents').update({
        organization_id: newOrg.id
      }).eq('id', agent.id);
      console.log(`Moved agent ${agent.name} to DIY Realty.`);
    }
  }
  
  console.log("Done! You now have two isolated organizations.");
}

run();
