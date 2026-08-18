import twilio from 'twilio';

const VoiceResponse = twilio.twiml.VoiceResponse;

export async function POST(request) {
  const formData = await request.formData();
  
  function formatE164(number) {
    if (!number) return '';
    let cleaned = number.replace(/[^\d+]/g, '');
    if (cleaned.startsWith('+')) return cleaned;
    if (cleaned.length === 10) return '+1' + cleaned;
    if (cleaned.length === 11 && cleaned.startsWith('1')) return '+' + cleaned;
    return cleaned;
  }

  let toRaw = formData.get('targetNumber') || formData.get('To');
  let to = toRaw ? formatE164(decodeURIComponent(toRaw)) : '';
  
  // In a real production app, we would look up the agent's assigned Twilio Number
  // and use it as the callerId to ensure compliant routing.
  // For MVP, we'll extract it if passed, or fallback to a hardcoded/env var.
  let callerIdRaw = formData.get('callerId');
  let callerId = '';
  if (callerIdRaw && callerIdRaw !== 'undefined' && callerIdRaw.trim() !== '') {
    callerId = formatE164(decodeURIComponent(callerIdRaw));
  } else {
    callerId = process.env.TWILIO_PHONE_NUMBER || '';
  }

  // FAILSAFE: If callerId is missing, or it is the known typo number (+19298338186),
  // fetch the corrected active number directly from the database to prevent Twilio Error 13214.
  if (!callerId || callerId === '+19298338186' || callerId === '19298338186') {
    try {
      const { createClient } = require('@supabase/supabase-js');
      const supabaseAdmin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
      );
      const { data } = await supabaseAdmin
        .from('organization_numbers')
        .select('phone_number')
        .eq('status', 'active')
        .limit(1)
        .single();
      
      if (data && data.phone_number) {
        callerId = data.phone_number;
      }
    } catch (e) {
      console.error('Failed to fetch fallback callerId from DB:', e);
    }
  }

  const twiml = new VoiceResponse();
  
  if (!to) {
    twiml.say({ voice: 'Polly.Matthew-Neural' }, "Congratulations! You have successfully connected to the Twilio web dialer. No destination number was provided.");
  } else {
    // Record the outbound call as well, from answer
    let orgId = formData.get('orgId');
    if (!orgId || orgId === 'undefined') {
      orgId = '8a564ec4-9544-4b63-ac58-98ec66d69a76';
    }
    
    const actionUrl = `/api/calls/status?org_id=${orgId}&real_direction=outbound&real_to=${encodeURIComponent(to)}&real_from=${encodeURIComponent(callerId)}`;
    const dialAttributes = { 
      record: 'record-from-ringing',
      action: actionUrl,
      recordingStatusCallback: actionUrl,
      recordingStatusCallbackEvent: 'in-progress completed absent'
    };
    
    // Only pass callerId if it exists and is a valid string, otherwise Twilio will throw an Application Error
    if (callerId && callerId !== 'undefined' && callerId.trim() !== '') {
      dialAttributes.callerId = callerId.trim();
    }
    
    twiml.dial(dialAttributes, to);
  }

  return new Response(twiml.toString(), {
    headers: { 'Content-Type': 'text/xml' }
  });
}
