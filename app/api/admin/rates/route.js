import { supabaseAdmin } from '@/lib/supabase-admin';
import { verifyAdminToken } from '@/lib/admin-auth';

// GET — get current billing rate
export async function GET(request) {
  const admin = verifyAdminToken(request);
  if (!admin) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('billing_rates')
      .select('*')
      .eq('name', 'default')
      .single();

    if (error) throw error;

    return Response.json({ rate: data });
  } catch (err) {
    console.error('Admin rates error:', err);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH — update billing rate
export async function PATCH(request) {
  const admin = verifyAdminToken(request);
  if (!admin) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { rate_per_minute, overage_multiplier, payment_window_days } = await request.json();

    const updates = { updated_at: new Date().toISOString() };
    if (rate_per_minute !== undefined) updates.rate_per_minute = rate_per_minute;
    if (overage_multiplier !== undefined) updates.overage_multiplier = overage_multiplier;
    if (payment_window_days !== undefined) updates.payment_window_days = payment_window_days;

    const { data, error } = await supabaseAdmin
      .from('billing_rates')
      .update(updates)
      .eq('name', 'default')
      .select()
      .single();

    if (error) throw error;

    return Response.json({ rate: data });
  } catch (err) {
    console.error('Admin rate update error:', err);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
