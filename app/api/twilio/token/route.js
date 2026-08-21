import twilio from 'twilio';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { verifyAdminToken } from '@/lib/admin-auth';

export async function POST(request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader) return new Response('Unauthorized', { status: 401 });

    const token = authHeader.split(' ')[1];
    
    // Check if it's an Admin token first
    const adminPayload = verifyAdminToken(request);
    let identity = 'unknown';
    let isAuthorized = false;

    if (adminPayload) {
      const { data: adminOrg } = await supabaseAdmin
        .from('organizations')
        .select('id')
        .eq('contact_email', adminPayload.email)
        .maybeSingle();

      if (adminOrg) {
        identity = `org_${adminOrg.id}`;
      } else {
        identity = 'admin';
      }
      isAuthorized = true;
    } else {
      // Check if it's a Supabase Agent token
      const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
      
      if (!error && user) {
        const { data: agentData } = await supabaseAdmin
          .from('agents')
          .select('organization_id')
          .eq('id', user.id)
          .single();
        
        identity = agentData?.organization_id ? `org_${agentData.organization_id}` : user.id;
        isAuthorized = true;
      }
    }

    if (!isAuthorized) return new Response('Unauthorized', { status: 401 });

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
      { identity: identity }
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
