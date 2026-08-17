import { supabaseAdmin } from '@/lib/supabase-admin';
import { verifyAdminToken } from '@/lib/admin-auth';

export async function GET(request) {
  const admin = verifyAdminToken(request);
  if (!admin) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const ADMIN_ORG_ID = '8a564ec4-9544-4b63-ac58-98ec66d69a76';
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString();

    // Total orgs
    const { count: totalOrgs } = await supabaseAdmin
      .from('organizations')
      .select('*', { count: 'exact', head: true })
      .neq('id', ADMIN_ORG_ID);

    // This month's calls
    const { data: monthCalls } = await supabaseAdmin
      .from('call_logs')
      .select('duration, organization_id')
      .gte('created_at', monthStart)
      .lte('created_at', monthEnd);

    const totalCalls = (monthCalls || []).length;
    const totalMinutes = (monthCalls || []).reduce((sum, c) => sum + Math.ceil((c.duration || 0) / 60), 0);

    // Get billing rate
    const { data: rateData } = await supabaseAdmin
      .from('billing_rates')
      .select('rate_per_minute')
      .eq('name', 'default')
      .single();

    const rate = rateData?.rate_per_minute || 0.025;
    const totalRevenue = (totalMinutes * parseFloat(rate)).toFixed(2);

    // Previous month logic
    const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
    const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59).toISOString();

    const { count: prevTotalOrgs } = await supabaseAdmin
      .from('organizations')
      .select('*', { count: 'exact', head: true })
      .lt('created_at', monthStart)
      .neq('id', ADMIN_ORG_ID);

    const { data: prevMonthCalls } = await supabaseAdmin
      .from('call_logs')
      .select('duration')
      .gte('created_at', prevMonthStart)
      .lte('created_at', prevMonthEnd);

    const prevTotalCalls = (prevMonthCalls || []).length;
    const prevTotalMinutes = (prevMonthCalls || []).reduce((sum, c) => sum + Math.ceil((c.duration || 0) / 60), 0);
    const prevTotalRevenue = prevTotalMinutes * parseFloat(rate);

    const calculateGrowth = (current, previous) => {
      if (previous === 0) return current > 0 ? 100 : 0;
      return Math.round(((current - previous) / previous) * 100);
    };

    const orgsGrowth = calculateGrowth(totalOrgs, prevTotalOrgs || 0);
    const callsGrowth = calculateGrowth(totalCalls, prevTotalCalls);
    const minutesGrowth = calculateGrowth(totalMinutes, prevTotalMinutes);
    const revenueGrowth = calculateGrowth(totalMinutes * parseFloat(rate), prevTotalRevenue);

    // Invoices summary
    const { data: invoices } = await supabaseAdmin
      .from('invoices')
      .select('status, total_amount')
      .order('created_at', { ascending: false });

    const invoiceSummary = {
      due: 0,
      overdue: 0,
      paid: 0,
      totalDue: 0,
      totalOverdue: 0,
      totalPaid: 0,
    };

    (invoices || []).forEach(inv => {
      invoiceSummary[inv.status]++;
      if (inv.status === 'due') invoiceSummary.totalDue += parseFloat(inv.total_amount);
      if (inv.status === 'overdue') invoiceSummary.totalOverdue += parseFloat(inv.total_amount);
      if (inv.status === 'paid') invoiceSummary.totalPaid += parseFloat(inv.total_amount);
    });

    // Per-org breakdown for this month
    const orgBreakdown = {};
    (monthCalls || []).forEach(call => {
      if (!orgBreakdown[call.organization_id]) {
        orgBreakdown[call.organization_id] = { calls: 0, minutes: 0 };
      }
      orgBreakdown[call.organization_id].calls++;
      orgBreakdown[call.organization_id].minutes += Math.ceil((call.duration || 0) / 60);
    });

    // Get org names
    const { data: orgs } = await supabaseAdmin
      .from('organizations')
      .select('id, name, company_name, subscription_plan')
      .neq('id', ADMIN_ORG_ID);

    const orgUsage = (orgs || []).map(org => ({
      id: org.id,
      name: org.company_name || org.name,
      calls: orgBreakdown[org.id]?.calls || 0,
      minutes: orgBreakdown[org.id]?.minutes || 0,
      usage: orgBreakdown[org.id]?.minutes || 0,
      status: org.subscription_plan || 'basic',
      estimatedCost: ((orgBreakdown[org.id]?.minutes || 0) * parseFloat(rate)).toFixed(2),
    }));
    
    orgUsage.sort((a, b) => b.usage - a.usage);

    return Response.json({
      totalOrgs,
      totalCalls,
      totalMinutes,
      totalRevenue,
      ratePerMinute: rate,
      invoiceSummary,
      topOrgs: orgUsage,
      growth: {
        orgs: orgsGrowth,
        calls: callsGrowth,
        minutes: minutesGrowth,
        revenue: revenueGrowth
      }
    });
  } catch (err) {
    console.error('Admin stats error:', err);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
