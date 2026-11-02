import { supabaseAdmin } from '@/lib/supabase-admin';
import { verifyAdminToken } from '@/lib/admin-auth';

export async function GET(request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader) return new Response('Unauthorized', { status: 401 });

    const token = authHeader.replace(/^Bearer\s+/i, '');
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

    // Query conversations table with related contacts, organizations, and messages
    let query = supabaseAdmin
      .from('conversations')
      .select(`
        id,
        organization_id,
        contact_phone,
        contact_id,
        last_message_at,
        last_message_body,
        is_deleted,
        contacts ( id, name, phone, company ),
        organizations ( id, company_name ),
        messages ( id, body, direction, created_at, is_read, message_sid )
      `)
      .eq('is_deleted', false)
      .order('last_message_at', { ascending: false });

    if (!isAdmin && orgId) {
      query = query.eq('organization_id', orgId);
    }

    const { data: convData, error: convError } = await query;

    if (convError) {
      console.error('Error querying conversations:', convError);
      throw convError;
    }

    const conversations = (convData || []).map(c => {
      const sortedMessages = (c.messages || []).sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );

      const unreadCount = sortedMessages.filter(
        m => !m.is_read && m.direction === 'inbound'
      ).length;

      // Clean up contact name if it is "Unknown +1..."
      let displayName = c.contacts?.name || '';
      if (!displayName || displayName.startsWith('Unknown')) {
        displayName = c.contact_phone;
      }

      return {
        id: c.id,
        organization_id: c.organization_id,
        organization_name: c.organizations?.company_name || 'General',
        contact_id: c.contact_id,
        contact_phone: c.contact_phone,
        contact_name: displayName,
        contact_company: c.contacts?.company || '',
        last_message_at: c.last_message_at,
        last_message_body: c.last_message_body,
        messages: sortedMessages,
        unread_count: unreadCount
      };
    });

    return Response.json({ conversations });
  } catch (err) {
    console.error('Error fetching conversations:', err);
    return new Response('Internal Server Error', { status: 500 });
  }
}

// Mark a conversation's messages as read
export async function PATCH(request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader) return new Response('Unauthorized', { status: 401 });

    const body = await request.json();
    const { conversationId } = body;

    if (!conversationId) {
      return Response.json({ error: 'Missing conversationId' }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from('messages')
      .update({ is_read: true })
      .eq('conversation_id', conversationId)
      .eq('is_read', false);

    if (error) throw error;

    return Response.json({ success: true });
  } catch (err) {
    console.error('Error marking conversation read:', err);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
