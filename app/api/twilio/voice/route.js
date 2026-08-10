import twilio from 'twilio';

const VoiceResponse = twilio.twiml.VoiceResponse;

export async function POST(request) {
  const formData = await request.formData();
  
  // The phone number we want to call is passed from the Voice SDK
  const to = formData.get('To');
  
  // In a real production app, we would look up the agent's assigned Twilio Number
  // and use it as the callerId to ensure compliant routing.
  // For MVP, we'll extract it if passed, or fallback to a hardcoded/env var.
  const callerId = formData.get('callerId') || process.env.TWILIO_PHONE_NUMBER; 

  const twiml = new VoiceResponse();
  
  if (!to) {
    twiml.say({ voice: 'Polly.Matthew-Neural' }, "Congratulations! You have successfully connected to the Twilio web dialer. No destination number was provided.");
  } else {
    // Record the outbound call as well, from answer
    twiml.dial({ 
      callerId: callerId,
      record: 'record-from-answer'
      // You could also add the recordingStatusCallback here if you want to log outbound calls
    }, to);
  }

  return new Response(twiml.toString(), {
    headers: { 'Content-Type': 'text/xml' }
  });
}
