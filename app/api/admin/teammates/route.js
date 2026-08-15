import { supabaseAdmin } from '@/lib/supabase-admin';
import { verifyAdminToken } from '@/lib/admin-auth';

// GET all teammates, POST new teammate, DELETE teammate
export async function GET(request) {
  const admin = verifyAdminToken(request);
  if (!admin) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get('org_id');
    if (!orgId) return Response.json({ error: 'org_id required' }, { status: 400 });

    const { data, error } = await supabaseAdmin
      .from('agents')
      .select('*')
      .eq('organization_id', orgId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return Response.json({ teammates: data || [] });
  } catch (err) {
    console.error('Admin teammates GET error:', err);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request) {
  const admin = verifyAdminToken(request);
  if (!admin) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { name, email, cell_phone, role, org_id } = await request.json();
    if (!name || !org_id) return Response.json({ error: 'name and org_id required' }, { status: 400 });

    const formatted = cell_phone ? cell_phone.replace(/[^\d+]/g, '').replace(/^(\d{10})$/, '+1$1').replace(/^(1\d{10})$/, '+$1') : cell_phone;

    const { data: teammate, error } = await supabaseAdmin
      .from('agents')
      .insert([{ organization_id: org_id, name, cell_phone: formatted }])
      .select()
      .single();

    if (error) throw error;

    // Sync to contacts
    if (formatted) {
      const { data: existing } = await supabaseAdmin.from('contacts').select('id').eq('organization_id', org_id).eq('phone', formatted).maybeSingle();
      if (existing) {
        await supabaseAdmin.from('contacts').update({ name, email, custom_fields: { role: 'Teammate', teammate_role: role }, updated_at: new Date().toISOString() }).eq('id', existing.id);
      } else {
        await supabaseAdmin.from('contacts').insert({ organization_id: org_id, name, phone: formatted, email, custom_fields: { role: 'Teammate', teammate_role: role } });
      }
    }

    return Response.json({ teammate });
  } catch (err) {
    console.error('Admin teammates POST error:', err);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request) {
  const admin = verifyAdminToken(request);
  if (!admin) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { id } = await request.json();
    if (!id) return Response.json({ error: 'id required' }, { status: 400 });
    const { error } = await supabaseAdmin.from('agents').delete().eq('id', id);
    if (error) throw error;
    return Response.json({ success: true });
  } catch (err) {
    console.error('Admin teammates DELETE error:', err);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
