import { supabaseAdmin } from '@/lib/supabase-admin';

export async function POST(request) {
  try {
    const body = await request.json();
    const { callSid, id, orgId, disposition, notes } = body;

    if (!orgId) {
      return new Response('Missing organization_id', { status: 400 });
    }

    if (callSid) {
      const { data: callLog } = await supabaseAdmin
        .from('call_logs')
        .select('id')
        .eq('twilio_call_sid', callSid)
        .maybeSingle();

      if (callLog) {
        await supabaseAdmin.from('call_logs').update({
          disposition,
          notes
        }).eq('id', callLog.id);
      } else {
        await supabaseAdmin.from('call_logs').insert({
          twilio_call_sid: callSid,
          organization_id: orgId,
          disposition,
          notes,
          call_type: 'outbound' // default if not exists
        });
      }
    } else if (id) {
      await supabaseAdmin.from('call_logs').update({
        disposition,
        notes
      }).eq('id', id);
    } else {
      return new Response('Missing callSid or id', { status: 400 });
    }

    return Response.json({ success: true });
  } catch (err) {
    console.error('Error in wrapup:', err);
    return new Response('Internal Server Error', { status: 500 });
  }
}
