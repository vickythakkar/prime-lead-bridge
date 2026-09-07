import { supabaseAdmin } from '@/lib/supabase-admin';
import { verifyAdminToken } from '@/lib/admin-auth';

export async function GET(request) {
  try {
    const admin = verifyAdminToken(request);
    if (!admin) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: plans, error } = await supabaseAdmin
      .from('subscription_plans')
      .select('*')
      .order('base_price', { ascending: true });

    if (error) throw error;
    
    return Response.json({ plans });
  } catch (err) {
    console.error('Failed to fetch subscription plans:', err);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const admin = verifyAdminToken(request);
    if (!admin) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { id, name, base_price, included_minutes, overage_rate } = body;

    const { data, error } = await supabaseAdmin
      .from('subscription_plans')
      .insert({
        id: id || name.toLowerCase().replace(/[^a-z0-9]/g, '_'),
        name,
        base_price: parseFloat(base_price),
        included_minutes: parseInt(included_minutes),
        overage_rate: parseFloat(overage_rate)
      })
      .select()
      .single();

    if (error) throw error;

    return Response.json({ plan: data });
  } catch (err) {
    console.error('Failed to create subscription plan:', err);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    const admin = verifyAdminToken(request);
    if (!admin) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { id, name, base_price, included_minutes, overage_rate } = body;

    const { data, error } = await supabaseAdmin
      .from('subscription_plans')
      .update({
        name,
        base_price: parseFloat(base_price),
        included_minutes: parseInt(included_minutes),
        overage_rate: parseFloat(overage_rate)
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return Response.json({ plan: data });
  } catch (err) {
    console.error('Failed to update subscription plan:', err);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
