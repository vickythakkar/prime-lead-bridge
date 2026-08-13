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
      .select('id, name, company_name');

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
        const subtotal = parseFloat((totalMinutes * rate).toFixed(2));

        // Due date: 7 days from generation
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + paymentWindowDays);

        await supabaseAdmin.from('invoices').insert({
          organization_id: org.id,
          billing_period_start: billingPeriodStart,
          billing_period_end: billingPeriodEnd,
          total_minutes: totalMinutes,
          total_calls: totalCalls,
          rate_per_minute: rate,
          subtotal: subtotal,
          overage_amount: 0,
          total_amount: subtotal,
          status: totalMinutes === 0 ? 'paid' : 'due', // Auto-mark $0 invoices as paid
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
      .select('*')
      .eq('status', 'overdue');

    if (overdueInvoices) {
      for (const inv of overdueInvoices) {
        const dueDate = new Date(inv.due_date);
        const daysPastDue = Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
        const weeksPastDue = Math.max(1, Math.floor(daysPastDue / 7));

        // Overage: (rate * multiplier * total_minutes) * weeks_past_due
        // This means: for every week overdue, the broker pays an additional
        // amount equal to (2x per-minute rate * their total minutes)
        const weeklyOverage = parseFloat(inv.rate_per_minute) * overageMultiplier * inv.total_minutes;
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
