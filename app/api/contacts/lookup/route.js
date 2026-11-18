import { supabaseAdmin } from '@/lib/supabase-admin';
import { verifyAdminToken } from '@/lib/admin-auth';
import { lookupCallerByPhone } from '@/lib/caller-lookup';

export async function GET(request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const phone = searchParams.get('phone');
    if (!phone) {
      return Response.json({ found: false });
    }

    // 1. Check Admin token first (allows global lookup across organizations)
    const admin = verifyAdminToken(request);
    if (admin) {
      const orgIdParam = searchParams.get('org_id') || null;
      const caller = await lookupCallerByPhone(phone, orgIdParam);
      if (!caller) return Response.json({ found: false });
      return Response.json({
        found: true,
        name: caller.name,
        company: caller.company,
        role: caller.role,
        organizationName: caller.organizationName,
        source: caller.source,
      });
    }

    // 2. Otherwise verify Supabase Broker/Agent token and scope strictly to their organization
    const token = authHeader.split(' ')[1];
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: agentData } = await supabaseAdmin
      .from('agents')
      .select('organization_id')
      .eq('id', user.id)
      .single();

    if (!agentData?.organization_id) {
      return Response.json({ found: false });
    }

    const caller = await lookupCallerByPhone(phone, agentData.organization_id);
    if (!caller) return Response.json({ found: false });

    return Response.json({
      found: true,
      name: caller.name,
      company: caller.company,
      role: caller.role,
      source: caller.source,
    });
  } catch (err) {
    console.error('Error looking up contact by phone:', err);
    return Response.json({ found: false }, { status: 500 });
  }
}
