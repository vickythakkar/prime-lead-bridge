import twilio from 'twilio';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { Resend } from 'resend';

const VoiceResponse = twilio.twiml.VoiceResponse;
// Resend will be instantiated inside the handler to prevent Vercel build errors
export async function POST(request) {
  try {
    const formData = await request.formData();
    
    const to = formData.get('To');
    const from = formData.get('From');
    const body = formData.get('Body');
    const sid = formData.get('MessageSid');
    const status = formData.get('MessageStatus');

    let orgId = null;
    let notifyEmail = process.env.NOTIFY_EMAIL;

    if (to) {
      const { data: numData } = await supabaseAdmin
        .from('organization_numbers')
        .select('organization_id')
        .eq('phone_number', to)
        .eq('status', 'active')
        .single();

      if (numData) {
        orgId = numData.organization_id;
        
        const { data: orgData } = await supabaseAdmin
          .from('organizations')
          .select('notify_email, company_name')
          .eq('id', orgId)
          .single();
          
        if (orgData && orgData.notify_email) {
          notifyEmail = orgData.notify_email;
        }
      }
    }

    if (orgId) {
      await supabaseAdmin.from('messages').insert({
        organization_id: orgId,
        twilio_sid: sid,
        direction: 'inbound',
        from_number: from,
        to_number: to,
        body: body,
        status: status || 'received'
      });

      if (notifyEmail && process.env.RESEND_API_KEY) {
        const resend = new Resend(process.env.RESEND_API_KEY);
        await resend.emails.send({
          from: 'info@primerealops.com',
          to: notifyEmail,
          subject: `New SMS from ${from}`,
          html: `<p>You received a new SMS message from ${from}:</p><p><strong>${body}</strong></p>`
        });
      }
    }

    const twiml = new twilio.twiml.MessagingResponse();
    return new Response(twiml.toString(), {
      headers: { 'Content-Type': 'text/xml' }
    });
  } catch (err) {
    console.error('Error in SMS webhook:', err);
    const twiml = new twilio.twiml.MessagingResponse();
    return new Response(twiml.toString(), {
      headers: { 'Content-Type': 'text/xml' }
    });
  }
}
