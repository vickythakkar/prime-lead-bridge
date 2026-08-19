import { supabaseAdmin } from '@/lib/supabase-admin';

export async function GET(request) {
  try {
    const now = new Date();

    // ── 1. Get billing rate ────────────────────────────────────
    const { data: rateData } = await supabaseAdmin
      .from('billing_rates')
      .select('*')
      .eq('name', 'default')
      .single();

    const rate = parseFloat(rateData?.rate_per_minute || 0.025);
    const overageMultiplier = parseFloat(rateData?.overage_multiplier || 2.0);
    const paymentWindowDays = rateData?.payment_window_days || 7;

    // ── 2. Generate invoices for PREVIOUS month ────────────────
    const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0); // Last day of prev month

    const billingPeriodStart = prevMonthStart.toISOString().split('T')[0];
    const billingPeriodEnd = prevMonthEnd.toISOString().split('T')[0];

    // Get all organizations
    const { data: orgs } = await supabaseAdmin
      .from('organizations')
      .select('id, name, company_name, contact_name, notify_email, contact_email, subscription_plan, ivr_flow_config');

    let invoicesGenerated = 0;
    let totalRevenueGenerated = 0;
    let sendEmail, getInvoiceEmailHtml;

    try {
      const emailModule = await import('@/lib/email');
      const templatesModule = await import('@/lib/email-templates');
      sendEmail = emailModule.sendEmail;
      getInvoiceEmailHtml = templatesModule.getInvoiceEmailHtml;
    } catch (e) {
      console.error('Email modules failed to load:', e);
    }

    if (orgs) {
      for (const org of orgs) {
        // Check if invoice already exists for this billing period
        const { data: existing } = await supabaseAdmin
          .from('invoices')
          .select('id')
          .eq('organization_id', org.id)
          .eq('billing_period_start', billingPeriodStart)
          .single();

        if (existing) continue; // Skip if already generated

        const orgRate = org.ivr_flow_config?.rate_per_minute !== null && org.ivr_flow_config?.rate_per_minute !== undefined ? parseFloat(org.ivr_flow_config.rate_per_minute) : rate;
        const orgPaymentWindow = org.ivr_flow_config?.payment_window_days !== null && org.ivr_flow_config?.payment_window_days !== undefined ? parseInt(org.ivr_flow_config.payment_window_days) : paymentWindowDays;

        // Calculate total minutes, calls, and exact prorated cost for the previous month
        const { data: calls } = await supabaseAdmin
          .from('call_logs')
          .select('duration, cost_broker')
          .eq('organization_id', org.id)
          .gte('created_at', prevMonthStart.toISOString())
          .lt('created_at', new Date(now.getFullYear(), now.getMonth(), 1).toISOString());

        const totalCalls = (calls || []).length;
        const totalSeconds = (calls || []).reduce((sum, c) => sum + (c.duration || 0), 0);
        const totalMinutes = Math.ceil(totalSeconds / 60);
        
        // Sum up the pre-calculated, prorated cost of all calls
        const usageCost = (calls || []).reduce((sum, c) => sum + (parseFloat(c.cost_broker) || 0), 0);
        
        let baseFee = 0;
        let perMinRate = orgRate;
        const plan = (org.subscription_plan || 'PAY_AS_YOU_GO').toLowerCase();

        if (plan === 'starter') {
          baseFee = 39.00;
          perMinRate = 0.12;
        } else if (plan === 'growth') {
          baseFee = 79.00;
          perMinRate = 0.10;
        } else {
          // Pay As You Go or default
          baseFee = 5.00;
          perMinRate = orgRate; // Defaults to 0.05 if not overridden
        }

        const subtotal = parseFloat((baseFee + usageCost).toFixed(2));

        // Due date: org specific window from generation
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + orgPaymentWindow);
        const dueDateStr = dueDate.toISOString().split('T')[0];

        await supabaseAdmin.from('invoices').insert({
          organization_id: org.id,
          billing_period_start: billingPeriodStart,
          billing_period_end: billingPeriodEnd,
          total_minutes: totalMinutes,
          total_calls: totalCalls,
          rate_per_minute: perMinRate,
          subtotal: subtotal,
          overage_amount: 0,
          total_amount: subtotal,
          status: subtotal === 0 ? 'paid' : 'due', // Auto-mark $0 invoices as paid
          due_date: dueDateStr,
        });

        invoicesGenerated++;
        totalRevenueGenerated += subtotal;

        // Send Invoice Email to Broker
        if (sendEmail && getInvoiceEmailHtml && subtotal > 0) {
          const brokerEmail = org.notify_email || org.contact_email;
          if (brokerEmail) {
            const monthStr = prevMonthStart.toLocaleString('default', { month: 'long', year: 'numeric' });
            await sendEmail({
              to: brokerEmail,
              subject: `Your Prime Lead Bridge Invoice - ${monthStr}`,
              html: getInvoiceEmailHtml(org.company_name, monthStr, totalMinutes, subtotal, 0, subtotal, dueDateStr)
            });
          }
        }
      }
    }

    // Send summary to Admin
    if (invoicesGenerated > 0 && sendEmail) {
      try {
        const { getAdminInvoiceSummaryHtml } = await import('@/lib/email-templates');
        await sendEmail({
          to: process.env.ADMIN_NOTIFY_EMAIL || 'vicky@primerealops.com',
          subject: 'Monthly Billing Cycle Completed - Prime Lead Bridge',
          html: getAdminInvoiceSummaryHtml(invoicesGenerated, totalRevenueGenerated)
        });
      } catch (e) {
        console.error('Failed to send admin summary email:', e);
      }
    }

    // ── 3. Mark overdue invoices ────────────────────────────────
    // Any invoice that is 'due' and past its due_date becomes 'overdue'
    const todayStr = now.toISOString().split('T')[0];
    
    await supabaseAdmin
      .from('invoices')
      .update({ 
        status: 'overdue', 
        updated_at: new Date().toISOString() 
      })
      .eq('status', 'due')
      .lt('due_date', todayStr);

    // ── 4. Calculate overage for overdue invoices ───────────────
    // Overage = 2x cost per minute per week overdue
    const { data: overdueInvoices } = await supabaseAdmin
      .from('invoices')
      .select('*, organizations(ivr_flow_config)')
      .eq('status', 'overdue');

    if (overdueInvoices) {
      for (const inv of overdueInvoices) {
        const dueDate = new Date(inv.due_date);
        const daysPastDue = Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
        const weeksPastDue = Math.max(1, Math.floor(daysPastDue / 7));

        // Overage: (rate * multiplier * total_minutes) * weeks_past_due
        // This means: for every week overdue, the broker pays an additional
        // amount equal to (2x per-minute rate * their total minutes)
        const orgOverageMult = inv.organizations?.ivr_flow_config?.overage_multiplier !== null && inv.organizations?.ivr_flow_config?.overage_multiplier !== undefined
          ? parseFloat(inv.organizations.ivr_flow_config.overage_multiplier)
          : overageMultiplier;
        const weeklyOverage = parseFloat(inv.rate_per_minute) * orgOverageMult * inv.total_minutes;
        const totalOverage = parseFloat((weeklyOverage * weeksPastDue).toFixed(2));
        const totalAmount = parseFloat((parseFloat(inv.subtotal) + totalOverage).toFixed(2));

        if (totalOverage !== parseFloat(inv.overage_amount)) {
          await supabaseAdmin
            .from('invoices')
            .update({
              overage_amount: totalOverage,
              total_amount: totalAmount,
              updated_at: new Date().toISOString(),
            })
            .eq('id', inv.id);
        }
      }
    }

    return Response.json({ 
      success: true, 
      message: 'Invoices generated and overdue penalties applied.',
      timestamp: now.toISOString(),
    });
  } catch (err) {
    console.error('Invoice generation error:', err);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
