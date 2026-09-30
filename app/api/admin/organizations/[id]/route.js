import { supabaseAdmin } from '@/lib/supabase-admin';
import { verifyAdminToken } from '@/lib/admin-auth';

export async function GET(request, { params }) {
  try {
    const authPayload = verifyAdminToken(request);
    if (!authPayload) {
      return new Response('Unauthorized', { status: 401 });
    }

    const { id } = await params;

    // Fetch org details
    const { data: org, error: orgError } = await supabaseAdmin
      .from('organizations')
      .select('*')
      .eq('id', id)
      .single();

    if (orgError || !org) {
      return new Response('Organization not found', { status: 404 });
    }

    // Fetch associated numbers
    const { data: numbers } = await supabaseAdmin
      .from('organization_numbers')
      .select('*')
      .eq('organization_id', id);

    // Fetch agents (table only has: id, organization_id, name, cell_phone, created_at)
    const { data: agents } = await supabaseAdmin
      .from('agents')
      .select('id, name, cell_phone, created_at')
      .eq('organization_id', id);

    // Fetch recent call logs
    const { data: callLogs } = await supabaseAdmin
      .from('call_logs')
      .select('*')
      .eq('organization_id', id)
      .order('created_at', { ascending: false })
      .limit(50);

    const callLogsWithUrls = (callLogs || []).map(call => {
      if (call.recording_url) {
        const { data: urlData } = supabaseAdmin.storage
          .from('call_recordings')
          .getPublicUrl(call.recording_url);
        return { ...call, audio_link: urlData.publicUrl };
      }
      return call;
    });

    // Fetch invoices
    const { data: invoices } = await supabaseAdmin
      .from('invoices')
      .select('*')
      .eq('organization_id', id)
      .order('created_at', { ascending: false });

    // Calculate current month estimated bill
    const now = new Date();
    const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
    const { data: currentMonthCalls } = await supabaseAdmin
      .from('call_logs')
      .select('duration')
      .eq('organization_id', id)
      .gte('created_at', startOfMonth);
      
    const totalSeconds = currentMonthCalls ? currentMonthCalls.reduce((acc, call) => acc + (call.duration || 0), 0) : 0;
    const totalMinutes = Math.ceil(totalSeconds / 60);

    const { data: adminSettings } = await supabaseAdmin.from('admin_settings').select('*').eq('id', 1).maybeSingle();
    const { data: plans } = await supabaseAdmin.from('subscription_plans').select('*');

    const activePlanId = org.subscription_plan || 'pay_as_you_go';
    const currentPlan = (plans || []).find(p => p.id === activePlanId) || {
      name: 'Pay As You Go',
      base_price: 5,
      included_minutes: 0,
      overage_rate: adminSettings?.broker_per_minute_charge || 0.05
    };

    const planRate = currentPlan.overage_rate;
    const customRateStr = org.ivr_flow_config?.rate_per_minute;
    const customRate = customRateStr !== null && customRateStr !== undefined && customRateStr !== '' ? parseFloat(customRateStr) : null;
    let displayRate = planRate;
    if (customRate !== null) {
      displayRate = customRate < planRate ? planRate : customRate;
    }

    const overageMinutes = Math.max(0, totalMinutes - currentPlan.included_minutes);
    const estimatedOverageCost = overageMinutes * displayRate;
    
    let rateDiscountAmount = 0;
    if (customRate !== null && customRate < planRate) {
      rateDiscountAmount = estimatedOverageCost - (overageMinutes * customRate);
    }
    const subtotal = currentPlan.base_price + estimatedOverageCost;

    let userDiscount = 0;
    if (org.pending_discount_amount && parseFloat(org.pending_discount_amount) > 0) {
      const discountVal = parseFloat(org.pending_discount_amount);
      if (org.pending_discount_type === 'percentage') {
        userDiscount = (subtotal * discountVal) / 100;
      } else {
        userDiscount = discountVal;
      }
    }
    const totalEstimatedBill = Math.max(0, subtotal - (rateDiscountAmount + userDiscount));

    const estimatedInvoice = {
      id: 'estimated-current',
      invoice_number: 'Estimated',
      created_at: new Date().toISOString(),
      month_year: `${new Date().toLocaleDateString()} (Current)`,
      total_amount: totalEstimatedBill,
      status: 'pending'
    };

    const allInvoices = [estimatedInvoice, ...(invoices || [])];

    return Response.json({
      organization: org,
      numbers: numbers || [],
      agents: agents || [],
      callLogs: callLogsWithUrls,
      invoices: allInvoices
    });
  } catch (err) {
    console.error('Error fetching org details:', err);
    return new Response('Internal Server Error', { status: 500 });
  }
}

export async function PATCH(request, { params }) {
  const admin = verifyAdminToken(request);
  if (!admin) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { id } = await params;
    const body = await request.json();

    const updateData = {};
    if (body.company_name !== undefined) updateData.company_name = body.company_name;
    if (body.subscription_plan !== undefined) updateData.subscription_plan = body.subscription_plan;
    if (body.notify_email !== undefined) updateData.notify_email = body.notify_email;
    if (body.contact_name !== undefined) updateData.contact_name = body.contact_name;
    if (body.contact_email !== undefined) updateData.contact_email = body.contact_email;
    if (body.contact_phone !== undefined) updateData.contact_phone = body.contact_phone;
    if (body.pending_discount_type !== undefined) updateData.pending_discount_type = body.pending_discount_type;
    if (body.pending_discount_amount !== undefined) updateData.pending_discount_amount = parseFloat(body.pending_discount_amount || 0);

    // Merge ivr_flow_config updates
    const emailTogglesPresent = body.email_voicemail !== undefined || body.email_missed_call !== undefined || body.email_invoice !== undefined || body.email_follow_up_reminder !== undefined;
    if (body.rate_per_minute !== undefined || body.overage_multiplier !== undefined || body.payment_window_days !== undefined || emailTogglesPresent) {
      // First fetch existing config
      const { data: existingOrg } = await supabaseAdmin.from('organizations').select('ivr_flow_config').eq('id', id).single();
      const newConfig = { ...(existingOrg?.ivr_flow_config || {}) };
      
      if (body.rate_per_minute !== undefined) newConfig.rate_per_minute = parseFloat(body.rate_per_minute) || null;
      if (body.overage_multiplier !== undefined) newConfig.overage_multiplier = parseFloat(body.overage_multiplier) || null;
      if (body.payment_window_days !== undefined) newConfig.payment_window_days = parseFloat(body.payment_window_days) || null;
      
      if (emailTogglesPresent) {
        newConfig.email_preferences = newConfig.email_preferences || {};
        if (body.email_voicemail !== undefined) newConfig.email_preferences.voicemail = !!body.email_voicemail;
        if (body.email_missed_call !== undefined) newConfig.email_preferences.missed_call = !!body.email_missed_call;
        if (body.email_invoice !== undefined) newConfig.email_preferences.invoice = !!body.email_invoice;
        if (body.email_follow_up_reminder !== undefined) newConfig.email_preferences.follow_up = !!body.email_follow_up_reminder;
      }

      updateData.ivr_flow_config = newConfig;
    }

    const { data, error } = await supabaseAdmin
      .from('organizations')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return Response.json({ organization: data });
  } catch (err) {
    console.error('Error updating org:', err);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  const admin = verifyAdminToken(request);
  if (!admin) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { id } = await params;
    
    // Safety check: Do not allow deleting the Admin org
    if (id === '8a564ec4-9544-4b63-ac58-98ec66d69a76') {
      return Response.json({ error: 'Cannot delete the Admin organization' }, { status: 403 });
    }

    // 1. Get associated Twilio numbers
    const { data: numbers } = await supabaseAdmin
      .from('organization_numbers')
      .select('*')
      .eq('organization_id', id);
      
    // 2. Release from Twilio
    if (numbers && numbers.length > 0) {
      const twilio = require('twilio');
      const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
      for (const num of numbers) {
        if (num.twilio_sid) {
          try {
            await client.incomingPhoneNumbers(num.twilio_sid).remove();
          } catch (e) {
            console.error('Failed to release Twilio number during org deletion:', e);
          }
        }
      }
    }

    // 3. Delete the organization (Assuming ON DELETE CASCADE or we might need to delete related records first)
    const { error } = await supabaseAdmin
      .from('organizations')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Supabase Delete Error:', error);
      throw error;
    }

    return Response.json({ success: true });
  } catch (err) {
    console.error('Error deleting org:', err);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

