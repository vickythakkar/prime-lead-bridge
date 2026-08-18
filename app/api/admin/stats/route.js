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

    // This month's calls (excluding admin)
    const { data: monthCalls } = await supabaseAdmin
      .from('call_logs')
      .select('duration, organization_id')
      .gte('created_at', monthStart)
      .lte('created_at', monthEnd)
      .neq('organization_id', ADMIN_ORG_ID);

    const totalCalls = (monthCalls || []).length;
    const totalSeconds = (monthCalls || []).reduce((sum, c) => sum + (c.duration || 0), 0);
    const totalMinutes = Math.ceil(totalSeconds / 60);

    // We will calculate totalRevenue dynamically based on plans below

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
      .select('duration, organization_id')
      .gte('created_at', prevMonthStart)
      .lte('created_at', prevMonthEnd)
      .neq('organization_id', ADMIN_ORG_ID);

    const prevTotalCalls = (prevMonthCalls || []).length;
    const prevTotalSeconds = (prevMonthCalls || []).reduce((sum, c) => sum + (c.duration || 0), 0);
    const prevTotalMinutes = Math.ceil(prevTotalSeconds / 60);

    // Growth will be calculated after we compute the revenue

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
        orgBreakdown[call.organization_id] = { calls: 0, seconds: 0 };
      }
      orgBreakdown[call.organization_id].calls++;
      orgBreakdown[call.organization_id].seconds += (call.duration || 0);
    });

    // Get org names
    const { data: orgs } = await supabaseAdmin
      .from('organizations')
      .select('id, name, company_name, subscription_plan')
      .neq('id', ADMIN_ORG_ID);

    const prevOrgBreakdown = {};
    (prevMonthCalls || []).forEach(call => {
      if (!prevOrgBreakdown[call.organization_id]) prevOrgBreakdown[call.organization_id] = 0;
      prevOrgBreakdown[call.organization_id] += (call.duration || 0);
    });

    let currentRevenueAmount = 0;
    let prevRevenueAmount = 0;

    const orgUsage = (orgs || []).map(org => {
      const secs = orgBreakdown[org.id]?.seconds || 0;
      const prevSecs = prevOrgBreakdown[org.id] || 0;
      const mins = Math.ceil(secs / 60);
      const prevMins = Math.ceil(prevSecs / 60);
      
      let cost = 0;
      let prevCost = 0;
      
      const plan = (org.subscription_plan || 'PAY_AS_YOU_GO').toUpperCase();
      
      if (plan === 'PAY_AS_YOU_GO') {
        cost = 5.00 + (mins * 0.05);
        prevCost = 5.00 + (prevMins * 0.05);
      } else if (plan === 'STARTER') {
        cost = 39.00 + (mins > 500 ? (mins - 500) * 0.12 : 0);
        prevCost = 39.00 + (prevMins > 500 ? (prevMins - 500) * 0.12 : 0);
      } else if (plan === 'GROWTH') {
        cost = 79.00 + (mins > 1000 ? (mins - 1000) * 0.10 : 0);
        prevCost = 79.00 + (prevMins > 1000 ? (prevMins - 1000) * 0.10 : 0);
      }
      
      currentRevenueAmount += cost;
      prevRevenueAmount += prevCost;

      return {
        id: org.id,
        name: org.company_name || org.name,
        calls: orgBreakdown[org.id]?.calls || 0,
        minutes: mins,
        usage: mins,
        status: plan,
        estimatedCost: cost.toFixed(2),
      };
    });
    
    const calculateGrowth = (current, previous) => {
      if (previous === 0) return current > 0 ? 100 : 0;
      return Math.round(((current - previous) / previous) * 100);
    };

    const orgsGrowth = calculateGrowth(totalOrgs, prevTotalOrgs || 0);
    const callsGrowth = calculateGrowth(totalCalls, prevTotalCalls);
    const minutesGrowth = calculateGrowth(totalMinutes, prevTotalMinutes);
    const revenueGrowth = calculateGrowth(currentRevenueAmount, prevRevenueAmount);

    const totalRevenue = currentRevenueAmount.toFixed(2);
    
    orgUsage.sort((a, b) => b.usage - a.usage);

    return Response.json({
      totalOrgs,
      totalCalls,
      totalMinutes,
      totalRevenue,
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
