import { supabaseAdmin } from '@/lib/supabase-admin';
import { verifyAdminToken } from '@/lib/admin-auth';

export async function GET(request) {
  const admin = verifyAdminToken(request);
  if (!admin) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get('org_id');

    let query = supabaseAdmin
      .from('leads')
      .select('*, properties(*), organizations(*)')
      .order('created_at', { ascending: false })
      .limit(200);

    if (orgId) query = query.eq('organization_id', orgId);

    const { data, error } = await query;
    if (error) throw error;

    return Response.json({ leads: data || [] });
  } catch (err) {
    console.error('Admin leads error:', err);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
