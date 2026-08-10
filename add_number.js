const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  const phoneNumber = '+19298338166';
  
  // 1. Get the first organization (assuming it's the client's)
  const { data: orgs, error: orgError } = await supabase.from('organizations').select('*').limit(1);
  if (orgError || !orgs || orgs.length === 0) {
    console.error("Could not find an organization.", orgError);
    return;
  }
  
  const orgId = orgs[0].id;
  
  // 2. Insert the number
  const { data, error } = await supabase.from('organization_numbers').insert([{
    organization_id: orgId,
    phone_number: phoneNumber,
    status: 'active',
    twilio_sid: 'PN_MOCK_SID_IMPORTED_MANUALLY'
  }]);
  
  if (error) {
    console.error("Error inserting number:", error);
  } else {
    console.log("Successfully added Twilio number to organization:", orgs[0].company_name);
  }
}

main();
