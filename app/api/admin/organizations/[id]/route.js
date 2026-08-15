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

    return Response.json({
      organization: org,
      numbers: numbers || [],
      agents: agents || [],
      callLogs: callLogsWithUrls
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
    if (body.rate_per_minute) updateData.rate_per_minute = parseFloat(body.rate_per_minute);
    if (body.overage_multiplier) updateData.overage_multiplier = parseFloat(body.overage_multiplier);
    if (body.payment_window_days) updateData.payment_window_days = parseInt(body.payment_window_days);

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
