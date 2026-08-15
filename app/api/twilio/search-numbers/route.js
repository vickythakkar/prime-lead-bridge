import twilio from 'twilio';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const areaCode = searchParams.get('areaCode');

    if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) {
      return new Response(JSON.stringify({ error: 'Twilio credentials not configured' }), { 
        status: 500, 
        headers: { 'Content-Type': 'application/json' } 
      });
    }

    const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

    const searchParamsObj = {
      limit: 10,
    };
    
    if (areaCode) {
      searchParamsObj.areaCode = parseInt(areaCode, 10);
    }

    const availableNumbers = await client.availablePhoneNumbers('US').local.list(searchParamsObj);
    
    const formattedNumbers = availableNumbers.map(n => ({
      phoneNumber: n.phoneNumber,
      friendlyName: n.friendlyName,
      locality: n.locality || '',
      region: n.region || ''
    }));

    return new Response(JSON.stringify({ numbers: formattedNumbers }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error("Twilio number search error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
