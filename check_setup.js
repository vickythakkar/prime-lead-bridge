require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkSupabase() {
  console.log("Checking Supabase Setup...");

  // 1. Check Bucket
  const { data: buckets, error: bucketError } = await supabase.storage.listBuckets();
  if (bucketError) {
    console.error("Failed to fetch buckets:", bucketError);
  } else {
    const recordingsBucket = buckets.find(b => b.name === 'call_recordings');
    if (recordingsBucket) {
      console.log(`✅ Bucket 'call_recordings' exists. Is Public: ${recordingsBucket.public}`);
    } else {
      console.log("❌ Bucket 'call_recordings' DOES NOT EXIST!");
    }
  }

  // 2. Check Auth Users
  const { data: usersData, error: usersError } = await supabase.auth.admin.listUsers();
  if (usersError) {
    console.error("Failed to fetch users:", usersError);
  } else {
    console.log(`✅ Total Users Found: ${usersData.users.length}`);
    usersData.users.forEach(u => console.log(`   - ${u.email}`));
  }

  // 3. Check Properties
  const { data: properties, error: propsError } = await supabase.from('properties').select('id, address');
  if (propsError) {
    console.error("Failed to fetch properties:", propsError);
  } else {
    console.log(`✅ Total Properties Found: ${properties.length}`);
    properties.forEach(p => console.log(`   - ${p.address}`));
  }

  // 4. Check Organization Numbers
  const { data: numbers, error: numbersError } = await supabase.from('organization_numbers').select('phone_number');
  if (numbersError) {
    console.error("Failed to fetch numbers:", numbersError);
  } else {
    console.log(`✅ Total Numbers Configured: ${numbers.length}`);
    numbers.forEach(n => console.log(`   - ${n.phone_number}`));
  }
}

checkSupabase();
