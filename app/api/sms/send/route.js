import { supabaseAdmin } from '@/lib/supabase-admin';
import { verifyAdminToken } from '@/lib/admin-auth';
import twilio from 'twilio';

export async function POST(request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader) return new Response('Unauthorized', { status: 401 });

    const token = authHeader.split(' ')[1];
    
    const adminPayload = verifyAdminToken(request);
    let orgId = null;
    let isAdmin = false;
    let from = process.env.TWILIO_PHONE_NUMBER;

    if (adminPayload) {
      isAdmin = true;
    } else {
      const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
      if (error || !user) return new Response('Unauthorized', { status: 401 });

      const { data: agentData } = await supabaseAdmin
        .from('agents')
        .select('organization_id')
        .eq('id', user.id)
        .single();

      if (!agentData || !agentData.organization_id) {
        return new Response('No organization found', { status: 403 });
      }
      orgId = agentData.organization_id;

      const { data: numData } = await supabaseAdmin
        .from('organization_numbers')
        .select('phone_number')
        .eq('organization_id', orgId)
        .eq('status', 'active')
        .single();

      if (!numData || !numData.phone_number) {
        return new Response('Organization has no active Twilio number', { status: 400 });
      }
      from = numData.phone_number;
    }

    const bodyJson = await request.json();
    const { to, body } = bodyJson;

    if (!to || !body) {
      return new Response('Missing to or body', { status: 400 });
    }

    const twilioAccountSid = process.env.TWILIO_ACCOUNT_SID;
    const twilioApiKey = process.env.TWILIO_API_KEY;
    const twilioApiSecret = process.env.TWILIO_API_SECRET;

    if (!twilioApiKey || !twilioApiSecret || !twilioAccountSid) {
      return new Response('Twilio credentials not configured', { status: 500 });
    }

    const client = twilio(twilioApiKey, twilioApiSecret, { accountSid: twilioAccountSid });

    const message = await client.messages.create({
      body,
      from,
      to
    });

    await supabaseAdmin.from('messages').insert({
      organization_id: orgId,
      twilio_sid: message.sid,
      direction: 'outbound',
      from_number: from,
      to_number: to,
      body: body,
      status: message.status
    });

    return Response.json({ success: true, sid: message.sid });
  } catch (err) {
    console.error('Error sending SMS:', err);
    return new Response('Internal Server Error', { status: 500 });
  }
}
