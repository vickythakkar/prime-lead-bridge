import { supabaseAdmin } from '@/lib/supabase-admin';
import { verifyAdminToken } from '@/lib/admin-auth';

export async function GET(request, { params }) {
  try {
    const authPayload = verifyAdminToken(request);
    if (!authPayload) {
      return new Response('Unauthorized', { status: 401 });
    }

    const { id } = params;

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

    // Fetch agents
    const { data: agents } = await supabaseAdmin
      .from('agents')
      .select('id, full_name, cell_phone, email, role, created_at')
      .eq('organization_id', id);

    // Fetch recent call logs
    const { data: callLogs } = await supabaseAdmin
      .from('call_logs')
      .select('*')
      .eq('organization_id', id)
      .order('created_at', { ascending: false })
      .limit(50);

    return Response.json({
      organization: org,
      numbers: numbers || [],
      agents: agents || [],
      callLogs: callLogs || []
    });
  } catch (err) {
    console.error('Error fetching org details:', err);
    return new Response('Internal Server Error', { status: 500 });
  }
}
