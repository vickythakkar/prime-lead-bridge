import twilio from 'twilio';

const VoiceResponse = twilio.twiml.VoiceResponse;

export async function POST(request) {
  const formData = await request.formData();
  
  // Custom param from JS client, fallback to Twilio's standard To
  let to = formData.get('targetNumber') || formData.get('To');
  if (to) to = decodeURIComponent(to);
  
  // In a real production app, we would look up the agent's assigned Twilio Number
  // and use it as the callerId to ensure compliant routing.
  // For MVP, we'll extract it if passed, or fallback to a hardcoded/env var.
  let callerId = formData.get('callerId');
  if (callerId) {
    callerId = decodeURIComponent(callerId);
  } else {
    callerId = process.env.TWILIO_PHONE_NUMBER;
  }

  const twiml = new VoiceResponse();
  
  if (!to) {
    twiml.say({ voice: 'Polly.Matthew-Neural' }, "Congratulations! You have successfully connected to the Twilio web dialer. No destination number was provided.");
  } else {
    // Record the outbound call as well, from answer
    let orgId = formData.get('orgId');
    if (!orgId || orgId === 'undefined') {
      // Default to Master Org ID for Admin calls
      orgId = '8a564ec4-9544-4b63-ac58-98ec66d69a76';
    }
    const actionUrl = `/api/calls/status?org_id=${orgId}&real_direction=outbound&real_to=${encodeURIComponent(to)}&real_from=${encodeURIComponent(callerId)}`;
    const dialAttributes = { 
      record: 'record-from-answer',
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
