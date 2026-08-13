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
      .from('call_logs')
      .select(`
        *,
        contact:contacts(*)
      `)
      .eq('organization_id', orgId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return Response.json({ calls: data });
  } catch (err) {
    console.error('Error fetching call logs:', err);
    return new Response('Internal Server Error', { status: 500 });
  }
}

export async function POST(request) {
  try {
    const orgId = await getOrgId(request);
    if (!orgId) return new Response('Unauthorized', { status: 401 });

    const body = await request.json();
    const { direction, from_number, to_number, status, duration, contact_id, notes } = body;

    const { data, error } = await supabaseAdmin
      .from('call_logs')
      .insert({
        organization_id: orgId,
        call_sid: `manual_${Date.now()}`,
        direction,
        from_number,
        to_number,
        status,
        duration,
        contact_id,
        notes
      })
      .select()
      .single();

    if (error) throw error;

    return Response.json({ call: data });
  } catch (err) {
    console.error('Error logging call manually:', err);
    return new Response('Internal Server Error', { status: 500 });
  }
}
