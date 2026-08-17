import twilio from 'twilio';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function POST(request) {
  try {
    const { phoneNumber, orgId } = await request.json();

    if (!phoneNumber || !orgId) {
      return new Response(JSON.stringify({ error: 'Missing phoneNumber or orgId' }), { status: 400 });
    }

    const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://prime-lead-bridge-five.vercel.app';

    // Purchase the number via Twilio
    const incomingPhoneNumber = await client.incomingPhoneNumbers.create({
      phoneNumber: phoneNumber,
      voiceUrl: `${baseUrl}/api/ivr/incoming`,
      voiceMethod: 'POST',
      statusCallback: `${baseUrl}/api/calls/status?org_id=${orgId}`,
      statusCallbackMethod: 'POST',
      statusCallbackEvent: ['completed'],
      smsUrl: `${baseUrl}/api/sms/incoming`,
      smsMethod: 'POST'
    });

    // Save to Supabase
    const { data, error } = await supabaseAdmin
      .from('organization_numbers')
      .insert([{
        organization_id: orgId,
        phone_number: incomingPhoneNumber.phoneNumber,
        twilio_sid: incomingPhoneNumber.sid,
        status: 'active'
      }])
      .select();

    if (error) {
      console.error("Database insert error:", error);
      return new Response(JSON.stringify({ error: 'Failed to save number to database' }), { status: 500 });
    }

    return new Response(JSON.stringify({ success: true, number: data[0] }), { 
      status: 200, 
      headers: { 'Content-Type': 'application/json' } 
    });

  } catch (error) {
    console.error("Twilio provisioning error:", error);
    return new Response(JSON.stringify({ error: error.message }), { 
      status: 500, 
      headers: { 'Content-Type': 'application/json' } 
    });
  }
}
