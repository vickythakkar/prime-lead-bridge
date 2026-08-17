const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const ADMIN_ORG_ID = '8a564ec4-9544-4b63-ac58-98ec66d69a76';

async function run() {
  const { data: numbers, error } = await supabase.from('organization_numbers').select('*');
  if (error) {
    console.error('Error fetching numbers:', error);
    return;
  }

  console.log(`Found ${numbers.length} numbers total.`);

  // Find numbers that exist more than once or belong to broker but are the same as admin
  const adminNumbers = numbers.filter(n => n.organization_id === ADMIN_ORG_ID).map(n => n.phone_number);
  
  const brokerNumbersToDelete = numbers.filter(n => 
    n.organization_id !== ADMIN_ORG_ID && adminNumbers.includes(n.phone_number)
  );

  console.log(`Found ${brokerNumbersToDelete.length} broker numbers to vanish (they share the same phone_number as Admin).`);

  for (const num of brokerNumbersToDelete) {
    console.log(`Deleting broker mapping for ${num.phone_number} (ID: ${num.id})`);
    const { error: delError } = await supabase.from('organization_numbers').delete().eq('id', num.id);
    if (delError) {
      console.error(`Error deleting ${num.id}:`, delError);
    } else {
      console.log(`Successfully vanished ${num.phone_number} from broker org ${num.organization_id}`);
    }
  }
}

run();
