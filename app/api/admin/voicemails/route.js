import { supabaseAdmin } from '@/lib/supabase-admin';
import { verifyAdminToken } from '@/lib/admin-auth';
import twilio from 'twilio';

export async function GET(request) {
  const admin = verifyAdminToken(request);
  if (!admin) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get('org_id');

    let query = supabaseAdmin
      .from('voicemails')
      .select('*, organizations(name, company_name)')
      .order('created_at', { ascending: false })
      .limit(200);

    if (orgId) query = query.eq('organization_id', orgId);

    const { data, error } = await query;
    if (error) throw error;

    // Resolve audio URLs
    const voicemails = (data || []).map(vm => {
      if (vm.recording_url) {
        if (vm.recording_url.includes('api.twilio.com')) {
          return { ...vm, audio_link: `/api/twilio/recording?url=${encodeURIComponent(vm.recording_url)}` };
        } else {
          const { data: urlData } = supabaseAdmin.storage.from('call_recordings').getPublicUrl(vm.recording_url);
          return { ...vm, audio_link: urlData.publicUrl };
        }
      }
      return vm;
    });

    return Response.json({ voicemails });
  } catch (err) {
    console.error('Admin voicemails GET error:', err);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(request) {
  const admin = verifyAdminToken(request);
  if (!admin) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { id } = await request.json();
    await supabaseAdmin.from('voicemails').update({ status: 'listened' }).eq('id', id);
    return Response.json({ success: true });
  } catch (err) {
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request) {
  const admin = verifyAdminToken(request);
  if (!admin) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { id } = await request.json();

    const { data: vm } = await supabaseAdmin.from('voicemails').select('recording_url').eq('id', id).single();

    if (vm?.recording_url) {
      if (vm.recording_url.includes('api.twilio.com')) {
        const match = vm.recording_url.match(/Recordings\/(RE[a-zA-Z0-9]+)/);
        if (match?.[1]) {
          const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
          try { await client.recordings(match[1]).remove(); } catch {}
        }
      } else {
        await supabaseAdmin.storage.from('call_recordings').remove([vm.recording_url]);
      }
    }

    await supabaseAdmin.from('voicemails').delete().eq('id', id);
    return Response.json({ success: true });
  } catch (err) {
    console.error('Admin voicemails DELETE error:', err);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
