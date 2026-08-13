import { supabaseAdmin } from '@/lib/supabase-admin';

export async function POST(request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader) return new Response('Unauthorized', { status: 401 });

    const token = authHeader.split(' ')[1];
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
    const orgId = agentData.organization_id;

    const formData = await request.formData();
    const file = formData.get('file');
    const callSid = formData.get('callSid');

    if (!file || !callSid) {
      return new Response('Missing file or callSid', { status: 400 });
    }

    const filePath = `${orgId}/${callSid}_client.webm`;

    const { error: uploadError } = await supabaseAdmin.storage
      .from('recordings')
      .upload(filePath, file, {
        contentType: 'audio/webm',
        upsert: true
      });

    if (uploadError) throw uploadError;

    // Update the call log with the recording URL (which is just the path in this case)
    await supabaseAdmin
      .from('call_logs')
      .update({ recording_url: filePath })
      .eq('call_sid', callSid)
      .eq('organization_id', orgId);

    return Response.json({ success: true, path: filePath });
  } catch (err) {
    console.error('Error uploading recording:', err);
    return new Response('Internal Server Error', { status: 500 });
  }
}
