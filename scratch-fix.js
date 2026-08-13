const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://alvfyayrabxzxthcjphx.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFsdmZ5YXlyYWJ4enh0aGNqcGh4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NjE4OTY5NywiZXhwIjoyMTAxNzY1Njk3fQ.EE8nuKqml3FzkCmpmlzhEQVQDylH0KUx1-A-j3Klo_w'
);

async function fixNumber() {
  const { data, error } = await supabase
    .from('organization_numbers')
    .update({ phone_number: '+18886013771' })
    .eq('phone_number', '+19298338166');
    
  console.log('Update error:', error);
  console.log('Update data:', data);
  
  const { data: num } = await supabase.from('organization_numbers').select('*');
  console.log('Numbers now:', num);
}

fixNumber();
