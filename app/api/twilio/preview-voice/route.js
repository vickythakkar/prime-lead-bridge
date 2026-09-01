import twilio from 'twilio';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function POST(request) {
  try {
    const { voice_id, phone_number, preview_text } = await request.json();

    if (!voice_id || !phone_number) {
      return Response.json({ error: 'Missing voice_id or phone_number' }, { status: 400 });
    }

    const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

    // Create a TwiML bin inline for the preview
    const twiml = new twilio.twiml.VoiceResponse();
    twiml.say({ voice: voice_id }, preview_text || 'Hello! This is a preview of your selected AI voice. Have a great day.');

    const call = await client.calls.create({
      twiml: twiml.toString(),
      to: phone_number,
      from: process.env.TWILIO_PHONE_NUMBER // Master Twilio number
    });

    return Response.json({ success: true, callSid: call.sid });
  } catch (err) {
    console.error('Preview voice error:', err);
    return Response.json({ error: 'Failed to initiate preview call' }, { status: 500 });
  }
}
