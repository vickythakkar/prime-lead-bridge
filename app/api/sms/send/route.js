import twilio from 'twilio';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function POST(request) {
  try {
    const { to, text, orgId } = await request.json();

    if (!to || !text || !orgId) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), { status: 400 });
    }

    // Get the org's Twilio phone number
    const { data: numData } = await supabaseAdmin
      .from('organization_numbers')
      .select('phone_number')
      .eq('organization_id', orgId)
      .eq('status', 'active')
      .single();

    if (!numData) {
      return new Response(JSON.stringify({ error: 'No active phone number found for organization' }), { status: 404 });
    }

    const from = numData.phone_number;

    // Send SMS via Twilio
    const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    const message = await client.messages.create({
      body: text,
      from,
      to,
    });

    // Check if conversation exists
    let { data: conversation } = await supabaseAdmin
      .from('conversations')
      .select('id')
      .eq('organization_id', orgId)
      .eq('contact_phone', to)
      .single();

    if (!conversation) {
      // Find or create contact first if possible
      let contactId = null;
      const { data: contact } = await supabaseAdmin
        .from('contacts')
        .select('id')
        .eq('organization_id', orgId)
        .eq('phone', to)
        .single();
        
      if (contact) {
        contactId = contact.id;
      } else {
        const { data: newContact } = await supabaseAdmin
          .from('contacts')
          .insert({ organization_id: orgId, phone: to, name: 'Unknown Contact' })
          .select('id')
          .single();
        if (newContact) contactId = newContact.id;
      }

      const { data: newConv } = await supabaseAdmin
        .from('conversations')
        .insert({
          organization_id: orgId,
          contact_phone: to,
          contact_id: contactId,
          last_message_at: new Date().toISOString(),
          last_message_body: text
        })
        .select('id')
        .single();
        
      conversation = newConv;
    } else {
      // Update last message timestamp
      await supabaseAdmin
        .from('conversations')
        .update({ last_message_at: new Date().toISOString(), last_message_body: text })
        .eq('id', conversation.id);
    }

    // Insert message
    if (conversation) {
      await supabaseAdmin.from('messages').insert({
        conversation_id: conversation.id,
        direction: 'outbound',
        body: text,
        message_sid: message.sid
      });
    }

    return new Response(JSON.stringify({ success: true, messageSid: message.sid }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Error sending SMS:', err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}
