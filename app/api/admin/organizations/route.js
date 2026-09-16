import { supabaseAdmin } from '@/lib/supabase-admin';
import { verifyAdminToken } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

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

    const orgStats = {};
    (callStats || []).forEach(call => {
      if (!orgStats[call.organization_id]) {
        orgStats[call.organization_id] = { totalCalls: 0, totalSeconds: 0 };
      }
      orgStats[call.organization_id].totalCalls++;
      orgStats[call.organization_id].totalSeconds += (call.duration || 0);
    });

    const url = new URL(request.url);
    const includeAdmin = url.searchParams.get('include_admin') === 'true';

    const enrichedOrgs = (orgs || [])
      .filter(org => includeAdmin || org.id !== '8a564ec4-9544-4b63-ac58-98ec66d69a76')
      .map(org => {
        const stats = orgStats[org.id] || { totalCalls: 0, totalSeconds: 0 };
        const totalMinutes = Math.ceil(stats.totalSeconds / 60);
        
        let cost = 0;
        const plan = (org.subscription_plan || 'PAY_AS_YOU_GO').toUpperCase();
        
        if (plan === 'PAY_AS_YOU_GO') {
          cost = 5.00 + (totalMinutes * 0.05);
        } else if (plan === 'STARTER') {
          cost = 49.00 + (totalMinutes > 500 ? (totalMinutes - 500) * 0.12 : 0);
        } else if (plan === 'GROWTH') {
          cost = 89.00 + (totalMinutes > 1000 ? (totalMinutes - 1000) * 0.10 : 0);
        }

        return {
          ...org,
          currentMonth: {
            totalCalls: stats.totalCalls,
            totalMinutes: totalMinutes,
            estimatedCost: cost.toFixed(2)
          }
        };
      });

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
    const { company_name, subscription_plan, notify_email, contact_name, contact_email, contact_phone, website, rate_per_minute, overage_multiplier, payment_window_days, pending_discount_type, pending_discount_amount } = body;

    if (!company_name) return Response.json({ error: 'Company name is required' }, { status: 400 });

    const insertData = {
      company_name,
      name: company_name,
      subscription_plan: subscription_plan || 'pay_as_you_go',
      notify_email: notify_email || contact_email || '',
      contact_name: contact_name || '',
      contact_email: contact_email || '',
      contact_phone: contact_phone || '',
      website: website || '',
      pending_discount_type: pending_discount_type || 'fixed',
      pending_discount_amount: pending_discount_amount ? parseFloat(pending_discount_amount) : 0,
    };

    // Add billing overrides and email toggles to ivr_flow_config
    const ivrFlowConfig = { email_preferences: {} };
    if (rate_per_minute) ivrFlowConfig.rate_per_minute = parseFloat(rate_per_minute);
    
    if (body.email_voicemail !== undefined) ivrFlowConfig.email_preferences.voicemail = !!body.email_voicemail;
    if (body.email_missed_call !== undefined) ivrFlowConfig.email_preferences.missed_call = !!body.email_missed_call;
    if (body.email_invoice !== undefined) ivrFlowConfig.email_preferences.invoice = !!body.email_invoice;
    if (body.email_follow_up_reminder !== undefined) ivrFlowConfig.email_preferences.follow_up = !!body.email_follow_up_reminder;
    
    if (Object.keys(ivrFlowConfig).length > 0) {
      insertData.ivr_flow_config = ivrFlowConfig;
    }
    
    // Note: overage_multiplier and payment_window_days columns exist now? Actually they might not.
    // Wait, let's keep them out if they don't exist.

    const { data: org, error } = await supabaseAdmin
      .from('organizations')
      .insert([insertData])
      .select()
      .single();

    if (error) throw error;

    try {
      const { sendEmail } = await import('@/lib/email');
      const { getWelcomeEmailHtml, getAdminNewBrokerHtml } = await import('@/lib/email-templates');

      const brokerEmail = org.notify_email || org.contact_email;
      if (brokerEmail) {
        await sendEmail({
          to: brokerEmail,
          subject: 'Welcome to Prime Lead Bridge',
          html: getWelcomeEmailHtml(org.contact_name)
        });
      }

      await sendEmail({
        to: process.env.ADMIN_NOTIFY_EMAIL || 'vicky@primerealops.com',
        subject: 'New Broker Created - Prime Lead Bridge',
        html: getAdminNewBrokerHtml(org, { name: org.contact_name, cell_phone: org.contact_phone })
      });
    } catch (emailErr) {
      console.error('Failed to send admin-created broker emails:', emailErr);
    }

    return Response.json({ organization: org });
  } catch (err) {
    console.error('Admin org create error:', err);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

