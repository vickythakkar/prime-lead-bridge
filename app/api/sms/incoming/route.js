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
    const { data: numData, error: numErr } = await supabaseAdmin
      .from('organization_numbers')
      .select('organization_id')
      .eq('phone_number', to)
      .maybeSingle();

    if (numErr) console.error('Org number fetch error:', numErr);

    if (numData) {
      const orgId = numData.organization_id;

      // ENFORCE SERVICE SUSPENSION
      const { data: orgData } = await supabaseAdmin.from('organizations').select('service_active').eq('id', orgId).maybeSingle();
      if (orgData && orgData.service_active === false) {
        return new Response('<Response></Response>', { status: 200, headers: { 'Content-Type': 'text/xml' } });
      }

      // Find or create conversation
      let { data: conversation, error: convErr } = await supabaseAdmin
        .from('conversations')
        .select('id')
        .eq('organization_id', orgId)
        .eq('contact_phone', from)
        .maybeSingle();

      if (convErr) console.error('Conversation fetch error:', convErr);

      if (!conversation) {
        let contactId = null;
        
        const digitsOnly = from.replace(/\D/g, '');
        const last10 = digitsOnly.slice(-10);
        
        let contact = null;
        if (last10.length === 10) {
          const { data, error } = await supabaseAdmin
            .from('contacts')
            .select('id')
            .eq('organization_id', orgId)
            .ilike('phone', `%${last10}%`)
            .maybeSingle();
          if (data) contact = data;
        } else {
          const { data, error } = await supabaseAdmin
            .from('contacts')
            .select('id')
            .eq('organization_id', orgId)
            .eq('phone', from)
            .maybeSingle();
          if (data) contact = data;
        }
          
        if (contact) {
          contactId = contact.id;
        } else {
          const { data: newContact, error: insertErr } = await supabaseAdmin
            .from('contacts')
            .insert([{
              organization_id: orgId,
              phone: from,
              name: 'Unknown ' + from,
              avatar_color: '#' + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0')
            }])
            .select()
            .single();
            
          if (insertErr) console.error('Contact insert error:', insertErr);
          if (newContact) contactId = newContact.id;
        }

        const { data: newConv, error: newConvErr } = await supabaseAdmin
          .from('conversations')
          .insert({
            organization_id: orgId,
            contact_phone: from,
            contact_id: contactId,
            last_message_at: new Date().toISOString(),
            last_message_body: body
          })
          .select('id')
          .maybeSingle();
          
        if (newConvErr) console.error('Conversation insert error:', newConvErr);
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

        // Broadcast notification to active dashboards
        await supabaseAdmin.channel(`org_${orgId}_notifications`).send({
          type: 'broadcast',
          event: 'new_sms',
          payload: {
            from: from,
            body: body
          }
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
