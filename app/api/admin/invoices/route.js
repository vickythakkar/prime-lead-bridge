import { supabaseAdmin } from '@/lib/supabase-admin';
import { verifyAdminToken } from '@/lib/admin-auth';

// GET — list all invoices (filterable by status)
export async function GET(request) {
  const admin = verifyAdminToken(request);
  if (!admin) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');

    let query = supabaseAdmin
      .from('invoices')
      .select('*, organizations(name, company_name)')
      .order('created_at', { ascending: false });

    if (status && status !== 'all') {
      query = query.eq('status', status);
    }

    const { data, error } = await query;
    if (error) throw error;

    return Response.json({ invoices: data || [] });
  } catch (err) {
    console.error('Admin invoices error:', err);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH — mark invoice as paid
export async function PATCH(request) {
  const admin = verifyAdminToken(request);
  if (!admin) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { invoice_id, action, paid_amount, discount_amount, total_amount, notes } = await request.json();

    if (!invoice_id) {
      return Response.json({ error: 'invoice_id is required' }, { status: 400 });
    }

    let updatePayload = { updated_at: new Date().toISOString() };
    
    if (action === 'apply_discount') {
      updatePayload.discount_amount = discount_amount;
      updatePayload.total_amount = total_amount;
    } else {
      // Mark as paid (default behavior)
      updatePayload.status = 'paid';
      updatePayload.paid_date = new Date().toISOString().split('T')[0];
      updatePayload.paid_amount = paid_amount || null;
      updatePayload.notes = notes || null;
    }

    const { data, error } = await supabaseAdmin
      .from('invoices')
      .update(updatePayload)
      .eq('id', invoice_id)
      .select()
      .single();

    if (error) throw error;

    return Response.json({ invoice: data });
  } catch (err) {
    console.error('Admin invoice update error:', err);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
