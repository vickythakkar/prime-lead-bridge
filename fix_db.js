const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

function formatE164(number) {
  if (!number) return '';
  let cleaned = number.replace(/[^\d+]/g, '');
  if (cleaned.startsWith('+')) return cleaned;
  if (cleaned.length === 10) return '+1' + cleaned;
  if (cleaned.length === 11 && cleaned.startsWith('1')) return '+' + cleaned;
  return cleaned;
}

async function fix() {
  const { data: agents } = await supabaseAdmin.from('agents').select('*');
  if (agents) {
    for (const a of agents) {
      if (a.cell_phone) {
        const e164 = formatE164(a.cell_phone);
        // Ensure in contacts
        const { data: c } = await supabaseAdmin.from('contacts').select('id').eq('phone', e164).maybeSingle();
        if (!c) {
          await supabaseAdmin.from('contacts').insert({
            organization_id: a.organization_id,
            name: a.name,
            phone: e164
          });
          console.log('Added agent to contacts:', a.name, e164);
        }
        // Update agent to e164
        await supabaseAdmin.from('agents').update({ cell_phone: e164 }).eq('id', a.id);
      }
    }
  }

  // Also fix any logs that missed contact ID
  const { data: logs } = await supabaseAdmin.from('call_logs').select('*');
  if (logs) {
    for (const l of logs) {
      if (!l.contact_id) {
        const cNum = l.call_type === 'outbound' ? l.to_number : l.from_number;
        const { data: c } = await supabaseAdmin.from('contacts').select('id').eq('phone', cNum).maybeSingle();
        if (c) {
          await supabaseAdmin.from('call_logs').update({ contact_id: c.id }).eq('id', l.id);
          console.log('Fixed contact ID for log:', l.id);
        }
      }
    }
  }

  // Fix the duration of the current bugged log if it is 0
  await supabaseAdmin.from('call_logs').update({ duration: 9 }).eq('twilio_call_sid', 'CAf7624d7844f9de9ea63db7b24495165a');

  console.log('Fix script complete');
}
fix();
