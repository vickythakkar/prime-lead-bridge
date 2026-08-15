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

export async function POST(request) {
  const admin = verifyAdminToken(request);
  if (!admin) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await request.json();
    const { company_name, subscription_plan, notify_email, contact_name, contact_email, contact_phone, rate_per_minute, overage_multiplier, payment_window_days } = body;

    if (!company_name) return Response.json({ error: 'Company name is required' }, { status: 400 });

    const insertData = {
      company_name,
      name: company_name,
      subscription_plan: subscription_plan || 'basic',
      notify_email: notify_email || contact_email || '',
      contact_name: contact_name || '',
    };

    // Add billing overrides if provided
    if (rate_per_minute) insertData.rate_per_minute = parseFloat(rate_per_minute);
    if (overage_multiplier) insertData.overage_multiplier = parseFloat(overage_multiplier);
    if (payment_window_days) insertData.payment_window_days = parseInt(payment_window_days);

    const { data: org, error } = await supabaseAdmin
      .from('organizations')
      .insert([insertData])
      .select()
      .single();

    if (error) throw error;
    return Response.json({ organization: org });
  } catch (err) {
    console.error('Admin org create error:', err);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

