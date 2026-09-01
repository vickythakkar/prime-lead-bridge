import twilio from 'twilio';
import { supabaseAdmin } from '@/lib/supabase-admin';

const VoiceResponse = twilio.twiml.VoiceResponse;

export async function POST(request) {
  const formData = await request.formData();
  const digits = formData.get('Digits');
  const { searchParams } = new URL(request.url);
  const voiceId = searchParams.get('voice') || 'Polly.Matthew-Neural';
  
  const twiml = new VoiceResponse();

  if (!digits) {
    twiml.say({ voice: voiceId }, 'No input received.');
    twiml.redirect(`/api/ivr/handle-menu?Digits=2&voice=${encodeURIComponent(voiceId)}`);
    return new Response(twiml.toString(), { headers: { 'Content-Type': 'text/xml' } });
  }

  // Query Supabase for properties matching street_number OR zip_code
  const { data: properties, error } = await supabaseAdmin
    .from('properties')
    .select('*')
    .or(`street_number.eq.${digits},zip_code.eq.${digits}`);

  if (error || !properties || properties.length === 0) {
    twiml.say({ voice: voiceId }, 'We could not find a property matching that number. Please try again.');
    twiml.redirect(`/api/ivr/handle-menu?Digits=2&voice=${encodeURIComponent(voiceId)}`);
  } else if (properties.length === 1) {
    // Exact match
    const property = properties[0];
    const gather = twiml.gather({
      numDigits: 1,
      action: `/api/ivr/confirm-property?property_id=${property.id}&voice=${encodeURIComponent(voiceId)}`,
      method: 'POST',
    });
    
    gather.say(
      { voice: voiceId },
      `You are inquiring about ${property.address}. Press 1 to confirm, or 2 to try again.`
    );
    
    // Fallback if no input
    twiml.say({ voice: voiceId }, 'We didn\'t receive your response.');
    twiml.redirect(`/api/ivr/handle-menu?Digits=2&voice=${encodeURIComponent(voiceId)}`);
  } else {
    // Multiple matches (e.g. same zip code)
    // "if there are 1+ properties in a single zip code, let us do it like - for property A, press1, for property B, press2, etc"
    const ids = properties.map(p => p.id).join(',');
    const gather = twiml.gather({
      numDigits: 1,
      action: `/api/ivr/multi-match?ids=${ids}&voice=${encodeURIComponent(voiceId)}`,
      method: 'POST',
    });

    let message = 'We found multiple properties. ';
    // Note: If there are more than 9 properties, DTMF menu will need >1 digit, but keeping it simple for 1 digit right now
    properties.slice(0, 9).forEach((prop, index) => {
      message += `For ${prop.address}, press ${index + 1}. `;
    });
    
    gather.say({ voice: voiceId }, message);
    twiml.redirect(`/api/ivr/handle-menu?Digits=2&voice=${encodeURIComponent(voiceId)}`);
  }

  return new Response(twiml.toString(), {
    headers: {
      'Content-Type': 'text/xml',
    },
  });
}
