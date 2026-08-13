const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://alvfyayrabxzxthcjphx.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFsdmZ5YXlyYWJ4enh0aGNqcGh4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NjE4OTY5NywiZXhwIjoyMTAxNzY1Njk3fQ.EE8nuKqml3FzkCmpmlzhEQVQDylH0KUx1-A-j3Klo_w'
);

async function checkData() {
  const { data: orgs } = await supabase.from('organizations').select('*');
  const { data: agents } = await supabase.from('agents').select('*');
  
  console.log('Organizations in DB:');
  console.dir(orgs, {depth: null});
  
  console.log('\nAgents in DB:');
  console.dir(agents, {depth: null});
}

checkData();
