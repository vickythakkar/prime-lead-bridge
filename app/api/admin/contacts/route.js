import { supabaseAdmin } from '@/lib/supabase-admin';
import { verifyAdminToken } from '@/lib/admin-auth';

export async function GET(request) {
  const admin = verifyAdminToken(request);
  if (!admin) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get('org_id');
    
    let query = supabaseAdmin
      .from('contacts')
      .select('*, organizations(company_name, name)')
      .eq('is_deleted', false)
      .order('created_at', { ascending: false });
      
    if (orgId) {
      query = query.eq('organization_id', orgId);
    }
    
    const { data, error } = await query;
    if (error) throw error;
    
    const contacts = (data || []).map(c => ({
      ...c,
      organization_name: c.organizations?.company_name || c.organizations?.name || 'Unknown Org'
    }));
    
    return Response.json({ contacts });
  } catch (err) {
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request) {
  const admin = verifyAdminToken(request);
  if (!admin) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const { name, phone, email, company, notes, org_id } = await request.json();
    const { data, error } = await supabaseAdmin.from('contacts').insert([{ name, phone, email, company, notes, organization_id: org_id, avatar_color: '#' + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0') }]).select().single();
    if (error) throw error;
    return Response.json({ contact: data });
  } catch (err) {
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(request) {
  const admin = verifyAdminToken(request);
  if (!admin) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const { id, name, phone, email, company, notes } = await request.json();
    const { data, error } = await supabaseAdmin.from('contacts').update({ name, phone, email, company, notes, updated_at: new Date().toISOString() }).eq('id', id).select().single();
    if (error) throw error;
    return Response.json({ contact: data });
  } catch (err) {
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request) {
  const admin = verifyAdminToken(request);
  if (!admin) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const { id } = await request.json();
    const { error } = await supabaseAdmin.from('contacts').update({ is_deleted: true }).eq('id', id);
    if (error) throw error;
    return Response.json({ success: true });
  } catch (err) {
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
