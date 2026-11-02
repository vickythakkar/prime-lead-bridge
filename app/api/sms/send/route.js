import twilio from 'twilio';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function POST(request) {
  try {
    const payload = await request.json();
    const to = payload.to;
    const text = payload.text || payload.body;
    let orgId = payload.orgId || payload.organization_id;
    const conversationId = payload.conversationId;

    if (!to || !text) {
      return new Response(JSON.stringify({ error: 'Missing required fields (to, text)' }), { status: 400 });
    }

    // If orgId wasn't passed directly, resolve it from conversation or contact
    if (!orgId && conversationId) {
      const { data: conv } = await supabaseAdmin
        .from('conversations')
        .select('organization_id')
        .eq('id', conversationId)
        .maybeSingle();
      if (conv?.organization_id) orgId = conv.organization_id;
    }

    if (!orgId) {
      const { data: conv } = await supabaseAdmin
        .from('conversations')
        .select('organization_id')
        .eq('contact_phone', to)
        .order('last_message_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (conv?.organization_id) orgId = conv.organization_id;
    }

    if (!orgId) {
      return new Response(JSON.stringify({ error: 'Organization ID is required to send SMS' }), { status: 400 });
    }

    // Get the org's active Twilio phone number
    const { data: numData } = await supabaseAdmin
      .from('organization_numbers')
      .select('phone_number')
      .eq('organization_id', orgId)
      .eq('status', 'active')
      .maybeSingle();

    if (!numData || !numData.phone_number) {
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
      .maybeSingle();

    if (!conversation) {
      // Find or create contact first if possible
      let contactId = null;
      const { data: contact } = await supabaseAdmin
        .from('contacts')
        .select('id')
        .eq('organization_id', orgId)
        .eq('phone', to)
        .maybeSingle();
        
      if (contact) {
        contactId = contact.id;
      } else {
        const { data: newContact } = await supabaseAdmin
          .from('contacts')
          .insert({ organization_id: orgId, phone: to, name: 'Unknown ' + to })
          .select('id')
          .maybeSingle();
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

    // Insert outbound message
    let insertedMessage = null;
    if (conversation) {
      const { data: newMsg } = await supabaseAdmin
        .from('messages')
        .insert({
          conversation_id: conversation.id,
          direction: 'outbound',
          body: text,
          message_sid: message.sid,
          is_read: true
        })
        .select('*')
        .maybeSingle();
      insertedMessage = newMsg;
    }

    return new Response(JSON.stringify({ 
      success: true, 
      messageSid: message.sid,
      message: insertedMessage
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Error sending SMS:', err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}
