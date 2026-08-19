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
      .select('id, name, company_name, subscription_plan, rate_per_minute, overage_multiplier, payment_window_days');

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

        const orgRate = org.rate_per_minute !== null && org.rate_per_minute !== undefined ? parseFloat(org.rate_per_minute) : rate;
        const orgPaymentWindow = org.payment_window_days !== null && org.payment_window_days !== undefined ? parseInt(org.payment_window_days) : paymentWindowDays;

        // Calculate total minutes and calls for the previous month
        const { data: calls } = await supabaseAdmin
          .from('call_logs')
          .select('duration')
          .eq('organization_id', org.id)
          .gte('created_at', prevMonthStart.toISOString())
          .lt('created_at', new Date(now.getFullYear(), now.getMonth(), 1).toISOString());

        const totalCalls = (calls || []).length;
        // Round each call up to the nearest minute individually (Twilio billing style)
        const totalMinutes = (calls || []).reduce((sum, c) => sum + Math.ceil((c.duration || 0) / 60), 0);
        
        let baseFee = 0;
        let includedMins = 0;
        let perMinRate = orgRate;
        const plan = (org.subscription_plan || 'PAY_AS_YOU_GO').toLowerCase();

        if (plan === 'starter') {
          baseFee = 39.00;
          includedMins = 500;
          perMinRate = 0.12;
        } else if (plan === 'growth') {
          baseFee = 79.00;
          includedMins = 1000;
          perMinRate = 0.10;
        } else {
          // Pay As You Go or default
          baseFee = 5.00;
          includedMins = 0;
          perMinRate = orgRate; // Defaults to 0.05 if not overridden
        }

        const billableMinutes = Math.max(0, totalMinutes - includedMins);
        const subtotal = parseFloat((baseFee + (billableMinutes * perMinRate)).toFixed(2));

        // Due date: org specific window from generation
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + orgPaymentWindow);

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
          due_date: dueDate.toISOString().split('T')[0],
        });
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
      .select('*, organizations(overage_multiplier)')
      .eq('status', 'overdue');

    if (overdueInvoices) {
      for (const inv of overdueInvoices) {
        const dueDate = new Date(inv.due_date);
        const daysPastDue = Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
        const weeksPastDue = Math.max(1, Math.floor(daysPastDue / 7));

        // Overage: (rate * multiplier * total_minutes) * weeks_past_due
        // This means: for every week overdue, the broker pays an additional
        // amount equal to (2x per-minute rate * their total minutes)
        const orgOverageMult = inv.organizations?.overage_multiplier !== null && inv.organizations?.overage_multiplier !== undefined
          ? parseFloat(inv.organizations.overage_multiplier)
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
