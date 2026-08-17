import { supabaseAdmin } from '@/lib/supabase-admin';

export async function POST(request) {
  try {
    const body = await request.json();
    const { name, email, phone, orgName, userId } = body;

    if (!name || !email || !orgName || !userId) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const ADMIN_ORG_ID = '8a564ec4-9544-4b63-ac58-98ec66d69a76';

    // 1. Create Organization
    const { data: orgData, error: orgError } = await supabaseAdmin
      .from('organizations')
      .insert([{ 
        name: orgName, 
        company_name: orgName,
        contact_name: name,
        contact_email: email,
      }])
      .select()
      .single();

    if (orgError) throw orgError;

    // 2. Create Agent Profile
    const { error: agentError } = await supabaseAdmin
      .from('agents')
      .insert([{
        id: userId,
        organization_id: orgData.id,
        name: name,
        cell_phone: phone
      }]);

    if (agentError) {
      console.error('Agent Creation Error:', agentError);
      throw agentError;
    }

    // 3. Create Admin contact in the new Broker's org (Broker's View)
    const { error: adminContactError } = await supabaseAdmin
      .from('contacts')
      .insert([{
        organization_id: orgData.id,
        name: 'PrimeRealOps',
        company: 'PrimeRealOps',
        phone: '',
        email: '',
        custom_fields: { role: 'Teammate' },
        avatar_color: '#4f46e5'
      }]);

    if (adminContactError) throw adminContactError;

    // 4. Create Broker contact in the Admin's org (Admin's View)
    const { error: brokerContactError } = await supabaseAdmin
      .from('contacts')
      .insert([{
        organization_id: ADMIN_ORG_ID,
        name: name,
        email: email || '',
        phone: phone || '',
        company: orgName,
        custom_fields: { role: 'Agent' },
        avatar_color: '#10b981'
      }]);

    if (brokerContactError) throw brokerContactError;

    return Response.json({ success: true, organization: orgData });
  } catch (err) {
    console.error('Setup API Error:', err);
    return Response.json({ error: 'Internal server error during account setup' }, { status: 500 });
  }
}
