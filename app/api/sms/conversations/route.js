import { supabaseAdmin } from '@/lib/supabase-admin';
import { verifyAdminToken } from '@/lib/admin-auth';

export async function GET(request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader) return new Response('Unauthorized', { status: 401 });

    const token = authHeader.split(' ')[1];
    
    const adminPayload = verifyAdminToken(request);
    let orgId = null;
    let isAdmin = false;

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
    }

    let query = supabaseAdmin
      .from('messages')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(500);
      
    if (!isAdmin && orgId) {
      query = query.eq('organization_id', orgId);
    }

    const { data: messages, error: messagesError } = await query;

    if (messagesError) throw messagesError;

    // Mark messages as read for this org (or all if admin)
    const unreadIds = messages.filter(m => !m.is_read).map(m => m.id);
    if (unreadIds.length > 0) {
      // Split into chunks of 100 to avoid request URL length limits in some cases, though .in() usually handles it
      await supabaseAdmin.from('messages').update({ is_read: true }).in('id', unreadIds);
    }

    const conversations = {};
    const contactNumbers = new Set();

    messages.forEach(msg => {
      const contactNumber = msg.direction === 'inbound' ? msg.from_number : msg.to_number;
      if (!conversations[contactNumber]) {
        conversations[contactNumber] = {
          contact_number: contactNumber,
          messages: [],
          last_message_at: msg.created_at,
          last_message_body: msg.body
        };
        contactNumbers.add(contactNumber);
      }
      conversations[contactNumber].messages.push(msg);
    });

    if (contactNumbers.size > 0) {
      const { data: contactsData } = await supabaseAdmin
        .from('contacts')
        .select('*')
        .eq('organization_id', orgId)
        .in('phone', Array.from(contactNumbers));
      
      if (contactsData) {
        contactsData.forEach(contact => {
          if (conversations[contact.phone]) {
            conversations[contact.phone].contact = contact;
          }
        });
      }
    }

    const conversationsArray = Object.values(conversations).sort(
      (a, b) => new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime()
    );

    return Response.json({ conversations: conversationsArray });
  } catch (err) {
    console.error('Error fetching conversations:', err);
    return new Response('Internal Server Error', { status: 500 });
  }
}
