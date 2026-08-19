import { supabaseAdmin } from '@/lib/supabase-admin';
import { verifyAdminToken } from '@/lib/admin-auth';

export async function POST(request, { params }) {
  try {
    const authPayload = verifyAdminToken(request);
    if (!authPayload) {
      return new Response('Unauthorized', { status: 401 });
    }

    const { id } = params;
    const updates = await request.json();

    const allowedFields = [
      'company_name',
      'subscription_plan',
      'ivr_greeting',
      'play_ivr_greeting',
      'receive_office_calls',
      'fallback_when_unavailable',
      'fallback_phone_number',
      'enable_listing_lookup',
      'notify_email',
      'service_active',
      'rate_per_minute'
    ];

    const safeUpdates = {};
    for (const key of allowedFields) {
      if (updates[key] !== undefined) {
        safeUpdates[key] = updates[key];
      }
    }

    const { error } = await supabaseAdmin
      .from('organizations')
      .update(safeUpdates)
      .eq('id', id);

    if (error) {
      console.error('Update org error:', error);
      return new Response('Error updating organization', { status: 500 });
    }

    return Response.json({ success: true });
  } catch (err) {
    console.error('Settings update error:', err);
    return new Response('Internal Server Error', { status: 500 });
  }
}
