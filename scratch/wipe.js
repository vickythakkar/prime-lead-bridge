const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function wipeDatabase() {
  const adminOrgId = '8a564ec4-9544-4b63-ac58-98ec66d69a76';
  const adminUserId = '3b8cf038-a00d-4e3f-b3b6-6ec0e5f1972b';

  console.log('Starting wipe...');

  // 1. Delete all users except admin
  const { data: users } = await sb.auth.admin.listUsers();
  for (const u of users.users) {
    if (u.id !== adminUserId) {
      await sb.auth.admin.deleteUser(u.id);
      console.log('Deleted user:', u.email);
    }
  }

  // 2. Delete all non-admin organizations
  const { data: orgs } = await sb.from('organizations').select('id');
  if (orgs) {
    for (const org of orgs) {
      if (org.id !== adminOrgId) {
        await sb.from('organizations').delete().eq('id', org.id);
        console.log('Deleted org:', org.id);
      }
    }
  }

  // 3. Clear all CRM data (Admin doesn't need CRM data)
  const tablesToClear = ['properties', 'contacts', 'leads', 'messages', 'voicemails', 'call_logs'];
  for (const table of tablesToClear) {
    await sb.from(table).delete().neq('id', 'dummy'); // Deletes all rows safely
    console.log(`Cleared ${table}`);
  }

  // 4. Delete agents (except admin if they exist)
  await sb.from('agents').delete().neq('id', adminUserId);
  console.log('Cleared agents');

  // 5. Delete organization numbers (except Admin's)
  await sb.from('organization_numbers').delete().neq('organization_id', adminOrgId);
  console.log('Cleared broker numbers');

  console.log('Wipe complete.');
}

wipeDatabase().catch(console.error);
