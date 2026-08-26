import { supabaseAdmin } from '@/lib/supabase-admin';
import { verifyAdminToken } from '@/lib/admin-auth';

export async function GET(request) {
  const admin = verifyAdminToken(request);
  if (!admin) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const [callsRes, messagesRes, voicemailsRes] = await Promise.all([
      supabaseAdmin.from('call_logs').select('id', { count: 'exact', head: true }).eq('seen', false),
      supabaseAdmin.from('messages').select('id', { count: 'exact', head: true }).eq('is_read', false),
      supabaseAdmin.from('voicemails').select('id', { count: 'exact', head: true }).eq('listened', false)
    ]);

    return Response.json({
      calls: callsRes.count || 0,
      messages: messagesRes.count || 0,
      voicemails: voicemailsRes.count || 0
    });
  } catch (err) {
    console.error('Admin notifications count GET error:', err);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

