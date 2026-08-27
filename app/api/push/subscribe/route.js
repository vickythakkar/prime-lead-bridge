import { supabaseAdmin } from '@/lib/supabase-admin';
import { verifyAdminToken } from '@/lib/admin-auth';

export async function POST(request) {
  try {
    const body = await request.json();
    const { subscription, user_type, organization_id } = body;

    if (!subscription || !subscription.endpoint) {
      return Response.json({ error: 'Invalid subscription' }, { status: 400 });
    }

    // Verify auth based on user_type
    let orgId = organization_id;
    let userType = user_type || 'broker';

    if (userType === 'admin') {
      const admin = verifyAdminToken(request);
      if (!admin) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    } else {
      const authHeader = request.headers.get('authorization');
      if (!authHeader) return Response.json({ error: 'Unauthorized' }, { status: 401 });
      const token = authHeader.split(' ')[1];
      const { data: { user } } = await supabaseAdmin.auth.getUser(token);
      if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
      const { data: agent } = await supabaseAdmin.from('agents').select('organization_id').eq('id', user.id).single();
      if (agent) orgId = agent.organization_id;
    }

    // Upsert by endpoint to prevent duplicates
    const { data: existing } = await supabaseAdmin
      .from('push_subscriptions')
      .select('id')
      .eq('endpoint', subscription.endpoint)
      .maybeSingle();

    if (existing) {
      await supabaseAdmin
        .from('push_subscriptions')
        .update({
          p256dh: subscription.keys.p256dh,
          auth: subscription.keys.auth,
          user_type: userType,
          organization_id: orgId,
          updated_at: new Date().toISOString()
        })
        .eq('id', existing.id);
    } else {
      await supabaseAdmin
        .from('push_subscriptions')
        .insert({
          endpoint: subscription.endpoint,
          p256dh: subscription.keys.p256dh,
          auth: subscription.keys.auth,
          user_type: userType,
          organization_id: orgId
        });
    }

    return Response.json({ success: true });
  } catch (err) {
    console.error('Push subscribe error:', err);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const body = await request.json();
    const { endpoint } = body;

    if (endpoint) {
      await supabaseAdmin.from('push_subscriptions').delete().eq('endpoint', endpoint);
    }

    return Response.json({ success: true });
  } catch (err) {
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
