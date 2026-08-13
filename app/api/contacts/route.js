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

    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q');

    let query = supabaseAdmin
      .from('contacts')
      .select('*')
      .eq('organization_id', orgId)
      .order('created_at', { ascending: false });

    if (q) {
      query = query.or(`name.ilike.%${q}%,phone.ilike.%${q}%,email.ilike.%${q}%`);
    }

    const { data, error } = await query;
    if (error) throw error;

    return Response.json({ contacts: data });
  } catch (err) {
    console.error('Error fetching contacts:', err);
    return new Response('Internal Server Error', { status: 500 });
  }
}

export async function POST(request) {
  try {
    const orgId = await getOrgId(request);
    if (!orgId) return new Response('Unauthorized', { status: 401 });

    const body = await request.json();
    const { name, phone, email, type } = body;

    if (!name || !phone) {
      return new Response('Name and phone are required', { status: 400 });
    }

    const { data: contact, error } = await supabaseAdmin
      .from('contacts')
      .insert({
        organization_id: orgId,
        name,
        phone,
        email,
        type: type || 'lead'
      })
      .select()
      .single();

    if (error) throw error;

    // Retroactively link call logs
    await supabaseAdmin
      .from('call_logs')
      .update({ contact_id: contact.id })
      .eq('organization_id', orgId)
      .or(`from_number.eq.${phone},to_number.eq.${phone}`)
      .is('contact_id', null);

    // Retroactively link messages
    await supabaseAdmin
      .from('messages')
      .update({ contact_id: contact.id })
      .eq('organization_id', orgId)
      .or(`from_number.eq.${phone},to_number.eq.${phone}`)
      .is('contact_id', null);

    return Response.json({ contact });
  } catch (err) {
    console.error('Error creating contact:', err);
    return new Response('Internal Server Error', { status: 500 });
  }
}
