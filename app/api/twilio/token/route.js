import twilio from 'twilio';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function POST(request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader) return new Response('Unauthorized', { status: 401 });

    const token = authHeader.split(' ')[1];
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
    
    if (error || !user) return new Response('Unauthorized', { status: 401 });

    const AccessToken = twilio.jwt.AccessToken;
    const VoiceGrant = AccessToken.VoiceGrant;

    // Use specific Twilio API Key and Secret (NOT Auth Token)
    const twilioAccountSid = process.env.TWILIO_ACCOUNT_SID;
    const twilioApiKey = process.env.TWILIO_API_KEY;
    const twilioApiSecret = process.env.TWILIO_API_SECRET;
    const twimlAppSid = process.env.TWILIO_TWIML_APP_SID;

    if (!twilioApiKey || !twilioApiSecret || !twimlAppSid) {
      return new Response('Twilio Voice SDK credentials not configured', { status: 500 });
    }

    const accessToken = new AccessToken(
      twilioAccountSid,
      twilioApiKey,
      twilioApiSecret,
      { identity: user.id }
    );

    const voiceGrant = new VoiceGrant({
      outgoingApplicationSid: twimlAppSid,
      incomingAllow: true, 
    });

    accessToken.addGrant(voiceGrant);

    return Response.json({ token: accessToken.toJwt() });
  } catch (err) {
    console.error(err);
    return new Response('Internal Server Error', { status: 500 });
  }
}
