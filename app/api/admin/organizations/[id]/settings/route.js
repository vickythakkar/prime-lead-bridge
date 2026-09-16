import { supabaseAdmin } from '@/lib/supabase-admin';
import { verifyAdminToken } from '@/lib/admin-auth';

export async function POST(request, { params }) {
  try {
    const authPayload = verifyAdminToken(request);
    if (!authPayload) {
      return new Response('Unauthorized', { status: 401 });
    }

    const { id } = await params;
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
      'notify_email'
    ];

    const safeUpdates = {};
    for (const key of allowedFields) {
      if (updates[key] !== undefined) {
        safeUpdates[key] = updates[key];
      }
    }

    // Add pending discount fields
    if (updates.pending_discount_type !== undefined) safeUpdates.pending_discount_type = updates.pending_discount_type;
    if (updates.pending_discount_amount !== undefined) safeUpdates.pending_discount_amount = parseFloat(updates.pending_discount_amount || 0);

    // Handle missing columns by stuffing them into ivr_flow_config JSONB
    const emailTogglesPresent = updates.email_voicemail !== undefined || updates.email_missed_call !== undefined || updates.email_invoice !== undefined || updates.email_follow_up_reminder !== undefined;
    if (updates.service_active !== undefined || updates.rate_per_minute !== undefined || emailTogglesPresent) {
      const { data: existingOrg } = await supabaseAdmin
        .from('organizations')
        .select('ivr_flow_config')
        .eq('id', id)
        .single();
      
      const newConfig = existingOrg?.ivr_flow_config || {};
      if (updates.service_active !== undefined) newConfig.service_active = updates.service_active;
      if (updates.rate_per_minute !== undefined) newConfig.rate_per_minute = updates.rate_per_minute;
      
      if (emailTogglesPresent) {
        newConfig.email_preferences = newConfig.email_preferences || {};
        if (updates.email_voicemail !== undefined) newConfig.email_preferences.voicemail = !!updates.email_voicemail;
        if (updates.email_missed_call !== undefined) newConfig.email_preferences.missed_call = !!updates.email_missed_call;
        if (updates.email_invoice !== undefined) newConfig.email_preferences.invoice = !!updates.email_invoice;
        if (updates.email_follow_up_reminder !== undefined) newConfig.email_preferences.follow_up = !!updates.email_follow_up_reminder;
      }
      
      safeUpdates.ivr_flow_config = newConfig;
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
