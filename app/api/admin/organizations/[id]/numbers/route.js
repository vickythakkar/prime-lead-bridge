import twilio from 'twilio';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { verifyAdminToken } from '@/lib/admin-auth';

export async function POST(request, { params }) {
  try {
    const admin = verifyAdminToken(request);
    if (!admin) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { id: orgId } = await params;
    const { phoneNumber } = await request.json();

    if (!phoneNumber) {
      return new Response('Phone number is required', { status: 400 });
    }

    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const voiceUrl = `https://${request.headers.get('host')}/api/ivr/incoming`; // Assuming IVR handles incoming

    const client = twilio(accountSid, authToken);

    // Purchase the number
    const incomingPhoneNumber = await client.incomingPhoneNumbers.create({
      phoneNumber: phoneNumber,
      voiceUrl: voiceUrl,
      voiceMethod: 'POST'
    });

    // Save to database
    const { data: orgNumber, error } = await supabaseAdmin.from('organization_numbers').insert([{
      organization_id: orgId,
      phone_number: incomingPhoneNumber.phoneNumber,
      twilio_sid: incomingPhoneNumber.sid,
      status: 'active'
    }]).select().single();

    if (error) {
      console.error('Error saving number to DB:', error);
      return new Response('Failed to save number to database', { status: 500 });
    }

    return Response.json({ success: true, number: orgNumber });
  } catch (err) {
    console.error('Error purchasing number:', err);
    return new Response('Internal Server Error', { status: 500 });
  }
}
