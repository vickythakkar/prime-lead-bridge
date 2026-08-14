import { supabaseAdmin } from '@/lib/supabase-admin';
import twilio from 'twilio';

const MessagingResponse = twilio.twiml.MessagingResponse;

export async function POST(request) {
  try {
    const formData = await request.formData();
    const from = formData.get('From');
    const to = formData.get('To');
    const body = formData.get('Body');
    const messageSid = formData.get('MessageSid');

    if (!from || !to || !body) {
      return new Response('Missing fields', { status: 400 });
    }

    // Get the org by phone number
    const { data: numData } = await supabaseAdmin
      .from('organization_numbers')
      .select('organization_id')
      .eq('phone_number', to)
      .eq('status', 'active')
      .single();

    if (numData) {
      const orgId = numData.organization_id;

      // Find or create conversation
      let { data: conversation } = await supabaseAdmin
        .from('conversations')
        .select('id')
        .eq('organization_id', orgId)
        .eq('contact_phone', from)
        .single();

      if (!conversation) {
        let contactId = null;
        const { data: contact } = await supabaseAdmin
          .from('contacts')
          .select('id')
          .eq('organization_id', orgId)
          .eq('phone', from)
          .single();
          
        if (contact) {
          contactId = contact.id;
        } else {
          const { data: newContact } = await supabaseAdmin
            .from('contacts')
            .insert({ organization_id: orgId, phone: from, name: 'Unknown Contact' })
            .select('id')
            .single();
          if (newContact) contactId = newContact.id;
        }

        const { data: newConv } = await supabaseAdmin
          .from('conversations')
          .insert({
            organization_id: orgId,
            contact_phone: from,
            contact_id: contactId,
            last_message_at: new Date().toISOString(),
            last_message_body: body
          })
          .select('id')
          .single();
          
        conversation = newConv;
      } else {
        await supabaseAdmin
          .from('conversations')
          .update({ last_message_at: new Date().toISOString(), last_message_body: body })
          .eq('id', conversation.id);
      }

      if (conversation) {
        await supabaseAdmin.from('messages').insert({
          conversation_id: conversation.id,
          direction: 'inbound',
          body: body,
          message_sid: messageSid
        });
      }
    }

    const twiml = new MessagingResponse();
    return new Response(twiml.toString(), {
      status: 200,
      headers: { 'Content-Type': 'text/xml' }
    });

  } catch (err) {
    console.error('Error handling inbound SMS:', err);
    return new Response('Error', { status: 500 });
  }
}
