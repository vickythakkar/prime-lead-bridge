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

    const { data: plansData } = await supabaseAdmin.from('subscription_plans').select('*');
    const plansMap = {};
    if (plansData) {
      plansData.forEach(p => plansMap[p.id] = p);
    }

    // ── 2. Generate invoices for PREVIOUS month ────────────────
    const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0); // Last day of prev month

    const billingPeriodStart = prevMonthStart.toISOString().split('T')[0];
    const billingPeriodEnd = prevMonthEnd.toISOString().split('T')[0];

    // Get all organizations
    const { data: orgs } = await supabaseAdmin
      .from('organizations')
      .select('id, name, company_name, contact_name, notify_email, contact_email, subscription_plan, ivr_flow_config, pending_discount_type, pending_discount_amount');

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

    // Determine the invoice prefix year based on the billing period year
    const invoiceYear = prevMonthStart.getFullYear();
    const prefix = `PLB${invoiceYear}`;

    // Find the latest invoice number for this year to continue the sequence
    const { data: latestInvoices } = await supabaseAdmin
      .from('invoices')
      .select('invoice_number')
      .like('invoice_number', `${prefix}%`)
      .order('invoice_number', { ascending: false })
      .limit(1);

    let nextInvoiceSequence = 1;
    if (latestInvoices && latestInvoices.length > 0 && latestInvoices[0].invoice_number) {
      const lastSeq = parseInt(latestInvoices[0].invoice_number.replace(prefix, ''), 10);
      if (!isNaN(lastSeq)) {
        nextInvoiceSequence = lastSeq + 1;
      }
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
        const planId = (org.subscription_plan || 'pay_as_you_go').toLowerCase();
        const planObj = plansMap[planId];

        if (planObj) {
          baseFee = parseFloat(planObj.base_price);
          perMinRate = parseFloat(planObj.overage_rate);
        } else {
          baseFee = 5.00; // legacy default
          perMinRate = orgRate;
        }

        // Admin org does not pay a base fee
        if (org.company_name === 'Prime Real Ops') {
          baseFee = 0;
        }

        const subtotal = parseFloat((baseFee + usageCost).toFixed(2));
        
        let discountAmount = 0;
        if (org.pending_discount_amount && parseFloat(org.pending_discount_amount) > 0) {
          const discountVal = parseFloat(org.pending_discount_amount);
          if (org.pending_discount_type === 'percentage') {
            discountAmount = parseFloat(((subtotal * discountVal) / 100).toFixed(2));
          } else {
            discountAmount = discountVal;
          }
          // Cap discount at subtotal
          if (discountAmount > subtotal) discountAmount = subtotal;
        }

        const totalAmount = parseFloat((subtotal - discountAmount).toFixed(2));

        // Due date: org specific window from generation
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + orgPaymentWindow);
        const dueDateStr = dueDate.toISOString().split('T')[0];

        const invoiceNumber = `${prefix}${String(nextInvoiceSequence).padStart(3, '0')}`;
        nextInvoiceSequence++;

        await supabaseAdmin.from('invoices').insert({
          organization_id: org.id,
          invoice_number: invoiceNumber,
          billing_period_start: billingPeriodStart,
          billing_period_end: billingPeriodEnd,
          total_minutes: totalMinutes,
          total_calls: totalCalls,
          rate_per_minute: perMinRate,
          subtotal: subtotal,
          discount_amount: discountAmount,
          overage_amount: 0,
          total_amount: totalAmount,
          status: totalAmount <= 0 ? 'paid' : 'due', // Auto-mark $0 invoices as paid
          due_date: dueDateStr,
        });
        
        // Reset the pending discount for this org
        if (discountAmount > 0) {
          await supabaseAdmin.from('organizations')
            .update({ pending_discount_amount: 0 })
            .eq('id', org.id);
        }

        invoicesGenerated++;
        totalRevenueGenerated += totalAmount;

        // Send Invoice Email to Broker
        if (sendEmail && getInvoiceEmailHtml && totalAmount > 0) {
          const brokerEmail = org.notify_email || org.contact_email;
          if (brokerEmail) {
            const planName = planObj ? planObj.name.toUpperCase() : (planId === 'pay_as_you_go' ? 'PAY AS YOU GO' : planId.toUpperCase());
            const monthStr = prevMonthStart.toLocaleString('default', { month: 'long', year: 'numeric' });
            await sendEmail({
              to: brokerEmail,
              cc: 'info@primerealops.com',
              subject: `Your Prime Lead Bridge Invoice - ${monthStr}`,
              html: getInvoiceEmailHtml(org.company_name, monthStr, totalMinutes, baseFee, usageCost, subtotal, discountAmount, 0, totalAmount, dueDateStr, planName, invoiceNumber)
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
