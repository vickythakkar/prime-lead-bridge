import { supabaseAdmin } from '@/lib/supabase-admin';

// Verify admin token from Authorization header
export function verifyAdminToken(request) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  try {
    const token = authHeader.split(' ')[1];
    const payload = JSON.parse(Buffer.from(token, 'base64').toString());
    
    // Check expiry
    if (payload.exp < Date.now()) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

// Helper to get org lookup from a Twilio phone number
export async function getOrgFromPhoneNumber(phoneNumber) {
  const { data: numData } = await supabaseAdmin
    .from('organization_numbers')
    .select('organization_id')
    .eq('phone_number', phoneNumber)
    .eq('status', 'active')
    .single();
  
  return numData?.organization_id || null;
}

// Helper to get org from authenticated user
export async function getOrgFromUser(request) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader) return null;

  const token = authHeader.split(' ')[1];
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return null;

  const { data: agentData } = await supabaseAdmin
    .from('agents')
    .select('organization_id')
    .eq('id', user.id)
    .single();

  return agentData?.organization_id || null;
}
