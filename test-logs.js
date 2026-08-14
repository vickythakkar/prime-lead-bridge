require('dotenv').config({ path: '.env.local' });
async function check() {
  const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/`, {
    headers: { apikey: process.env.SUPABASE_SERVICE_ROLE_KEY }
  });
  const json = await res.json();
  console.log('Contacts columns:', Object.keys(json.definitions.contacts.properties));
}
check();
