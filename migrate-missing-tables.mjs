import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.migration' });

const oldSupabase = createClient(process.env.OLD_SUPABASE_URL, process.env.OLD_SUPABASE_KEY, { auth: { persistSession: false } });
const newSupabase = createClient(process.env.NEW_SUPABASE_URL, process.env.NEW_SUPABASE_KEY, { auth: { persistSession: false } });

const TABLES = [
  'admin_settings',
  'agents',
  'leads',
  'tasks'
];

async function migrate() {
  console.log('Starting missing tables migration...');
  
  for (const table of TABLES) {
    console.log('\nMigrating table: ' + table);
    
    // Fetch all records
    const { data: records, error: fetchErr } = await oldSupabase.from(table).select('*');
    if (fetchErr) {
      console.error('Error fetching ' + table + ':', fetchErr);
      continue;
    }
    
    console.log('Found ' + records.length + ' records in ' + table);
    
    if (records.length === 0) continue;

    // Insert into new database
    const { error: insertErr } = await newSupabase.from(table).insert(records);
    if (insertErr) {
      console.error('Error inserting into ' + table + ':', insertErr);
    } else {
      console.log('Successfully migrated ' + records.length + ' records to ' + table);
    }
  }
  
  console.log('\nMigration complete!');
}

migrate().catch(console.error);
