import { supabaseAdmin } from '@/lib/supabase-admin';

async function getOrgId(request) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader) return null;

  const token = authHeader.split(' ')[1];
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  
  if (error || !user) return null;

  const { data: agentData } = await supabaseAdmin
    .from('agents')
    .select('organization_id')
    .eq('id', user.id)
    .single();

  return agentData?.organization_id || null;
}

export async function GET(request) {
  try {
    const orgId = await getOrgId(request);
    if (!orgId) return new Response('Unauthorized', { status: 401 });

    const { data, error } = await supabaseAdmin
      .from('voicemails')
      .select(`
        *,
        contact:contacts(*)
      `)
      .eq('organization_id', orgId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return Response.json({ voicemails: data });
  } catch (err) {
    console.error('Error fetching voicemails:', err);
    return new Response('Internal Server Error', { status: 500 });
  }
}

export async function PATCH(request) {
  try {
    const orgId = await getOrgId(request);
    if (!orgId) return new Response('Unauthorized', { status: 401 });

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) return new Response('Missing id', { status: 400 });

    const body = await request.json();
    const { is_listened } = body;

    const { error } = await supabaseAdmin
      .from('voicemails')
      .update({ is_listened })
      .eq('id', id)
      .eq('organization_id', orgId);

    if (error) throw error;

    return Response.json({ success: true });
  } catch (err) {
    console.error('Error updating voicemail:', err);
    return new Response('Internal Server Error', { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const orgId = await getOrgId(request);
    if (!orgId) return new Response('Unauthorized', { status: 401 });

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) return new Response('Missing id', { status: 400 });

    const { error } = await supabaseAdmin
      .from('voicemails')
      .delete()
      .eq('id', id)
      .eq('organization_id', orgId);

    if (error) throw error;

    return Response.json({ success: true });
  } catch (err) {
    console.error('Error deleting voicemail:', err);
    return new Response('Internal Server Error', { status: 500 });
  }
}
