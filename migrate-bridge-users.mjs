import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.migration' });

const oldSupabase = createClient(process.env.OLD_SUPABASE_URL, process.env.OLD_SUPABASE_KEY, { auth: { persistSession: false } });
const newSupabase = createClient(process.env.NEW_SUPABASE_URL, process.env.NEW_SUPABASE_KEY, { auth: { persistSession: false } });

async function migrateUsers() {
  console.log('Migrating Bridge Users...');
  const { data: { users }, error: usersErr } = await oldSupabase.auth.admin.listUsers();
  if (usersErr) {
    console.error('Error fetching users:', usersErr);
    return;
  }
  
  for (const user of users) {
    console.log('Recreating user: ' + user.email);
    // Explicitly set the same UUID if possible, or just let Supabase generate one.
    // Wait, if I don't set the same UUID, the gents table and organizations might break!
    // Let's pass the exact ID!
    const { error: createErr } = await newSupabase.auth.admin.createUser({
      id: user.id, // Explicitly preserve the UUID!
      email: user.email,
      password: 'TemporaryPassword123!',
      email_confirm: true
    });
    if (createErr) console.error('Failed to create user ' + user.email, createErr);
    else console.log('Successfully recreated: ' + user.email);
  }
  console.log('\nBridge Users Migration complete!');
}

migrateUsers().catch(console.error);
