import { supabaseAdmin } from '@/lib/supabase-admin';
import { verifyAdminToken } from '@/lib/admin-auth';

export async function GET(request) {
  const admin = verifyAdminToken(request);
  if (!admin) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Get all organizations with their numbers
    const { data: orgs, error } = await supabaseAdmin
      .from('organizations')
      .select('*, organization_numbers(phone_number, status)')
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Get current month stats for each org
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString();

    const { data: callStats } = await supabaseAdmin
      .from('call_logs')
      .select('organization_id, duration')
      .gte('created_at', monthStart)
      .lte('created_at', monthEnd);

    // Aggregate stats per org
    const orgStats = {};
    (callStats || []).forEach(call => {
      if (!orgStats[call.organization_id]) {
        orgStats[call.organization_id] = { totalCalls: 0, totalMinutes: 0 };
      }
      orgStats[call.organization_id].totalCalls++;
      orgStats[call.organization_id].totalMinutes += Math.ceil((call.duration || 0) / 60);
    });

    const enrichedOrgs = (orgs || []).map(org => ({
      ...org,
      currentMonth: orgStats[org.id] || { totalCalls: 0, totalMinutes: 0 },
    }));

    return Response.json({ organizations: enrichedOrgs });
  } catch (err) {
    console.error('Admin orgs error:', err);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
