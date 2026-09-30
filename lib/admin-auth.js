import { supabaseAdmin } from '@/lib/supabase-admin';
import crypto from 'crypto';

const SECRET = process.env.JWT_SECRET || 'plb-admin-fallback-secret-key-32chars!!';

// Verify admin token from Authorization header
export function verifyAdminToken(request) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  try {
    const token = authHeader.split(' ')[1];
    const parts = token.split('.');
    
    // Legacy support for unsigned tokens temporarily (to not break active sessions)
    if (parts.length === 1) {
      const legacyPayload = JSON.parse(Buffer.from(token, 'base64').toString('utf8'));
      if (legacyPayload && legacyPayload.exp >= Date.now()) {
        return legacyPayload;
      }
      return null;
    }

    if (parts.length !== 3) {
      return null;
    }

    const [header, payloadStr, signature] = parts;
    const expectedSignature = crypto.createHmac('sha256', SECRET).update(`${header}.${payloadStr}`).digest('base64url');
    
    if (crypto.timingSafeEqual(Buffer.from(expectedSignature), Buffer.from(signature)) === false) {
       return null;
    }

    const payload = JSON.parse(Buffer.from(payloadStr, 'base64url').toString('utf8'));
    
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
