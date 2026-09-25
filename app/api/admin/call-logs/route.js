import { supabaseAdmin } from '@/lib/supabase-admin';
import { verifyAdminToken } from '@/lib/admin-auth';

export async function GET(request) {
  const admin = verifyAdminToken(request);
  if (!admin) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get('org_id'); // optional filter

    let query = supabaseAdmin
      .from('call_logs')
      .select('id, created_at, from_number, to_number, direction, status, duration, recording_url, seen, organizations(name, company_name), contacts(name)')
      .order('created_at', { ascending: false })
      .limit(200);

    if (orgId) query = query.eq('organization_id', orgId);

    const { data, error } = await query;
    if (error) throw error;

    // Resolve audio URLs
    const logs = (data || []).map(call => {
      if (call.recording_url) {
        if (call.recording_url.includes('api.twilio.com')) {
          return { ...call, audio_link: `/api/twilio/recording?url=${encodeURIComponent(call.recording_url)}` };
        } else {
          const { data: urlData } = supabaseAdmin.storage.from('call_recordings').getPublicUrl(call.recording_url);
          return { ...call, audio_link: urlData.publicUrl };
        }
      }
      return call;
    });

    return Response.json({ logs });
  } catch (err) {
    console.error('Admin call-logs error:', err);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request) {
  const admin = verifyAdminToken(request);
  if (!admin) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    await supabaseAdmin.from('call_logs').update({ seen: true }).eq('seen', false);
    return Response.json({ success: true });
  } catch (err) {
    console.error('Admin call-logs PUT error:', err);
    return Response.json({ error: 'Internal error' }, { status: 500 });
  }
}
