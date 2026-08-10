import twilio from 'twilio';
import { supabase } from '@/lib/supabase'; // We need a service role key for backend operations

const VoiceResponse = twilio.twiml.VoiceResponse;

export async function POST(request) {
  const formData = await request.formData();
  const to = formData.get('To'); // The Twilio number that was called
  const callSid = formData.get('CallSid');

  let companyName = "our office";
  let orgId = null;

  // Lookup the organization based on the Twilio Number dialed
  if (to) {
    const { data: numData } = await supabase
      .from('organization_numbers')
      .select('organization_id')
      .eq('phone_number', to)
      .eq('status', 'active')
      .single();

    if (numData) {
      orgId = numData.organization_id;
      const { data: orgData } = await supabase
        .from('organizations')
        .select('company_name')
        .eq('id', orgId)
        .single();
      
      if (orgData && orgData.company_name) {
        companyName = orgData.company_name;
      }
    }
  }

  const twiml = new VoiceResponse();
  
  // Create a gather verb to collect 1 digit
  const gather = twiml.gather({
    numDigits: 1,
    action: '/api/ivr/handle-menu',
    method: 'POST',
  });

  gather.say(
    { voice: 'Polly.Matthew-Neural' },
    `Welcome to ${companyName}. To connect with the office, press 1. If you are a buyer inquiring about a property, press 2.`
  );

  // If the user doesn't enter input, loop back to the same menu
  twiml.redirect('/api/ivr/incoming');

  return new Response(twiml.toString(), {
    headers: {
      'Content-Type': 'text/xml',
    },
  });
}
