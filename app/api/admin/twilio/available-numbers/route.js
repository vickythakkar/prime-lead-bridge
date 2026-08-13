import twilio from 'twilio';
import { verifyAdminToken } from '@/lib/admin-auth';

export async function GET(request) {
  try {
    const authPayload = verifyAdminToken(request);
    if (!authPayload) {
      return new Response('Unauthorized', { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const areaCode = searchParams.get('areaCode');

    if (!areaCode || areaCode.length !== 3) {
      return new Response('Valid area code is required', { status: 400 });
    }

    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    
    if (!accountSid || !authToken) {
      return new Response('Twilio credentials not configured', { status: 500 });
    }

    const client = twilio(accountSid, authToken);

    const localNumbers = await client.availablePhoneNumbers('US')
      .local
      .list({ areaCode: areaCode, limit: 10 });

    const results = localNumbers.map(n => ({
      phoneNumber: n.phoneNumber,
      friendlyName: n.friendlyName,
      locality: n.locality,
      region: n.region
    }));

    return Response.json({ numbers: results });
  } catch (err) {
    console.error('Error fetching available numbers:', err);
    return new Response('Internal Server Error', { status: 500 });
  }
}
