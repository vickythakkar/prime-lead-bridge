import { NextResponse } from 'next/server';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get('url');
  
  if (!url || !url.includes('api.twilio.com')) {
    return new NextResponse('Invalid URL', { status: 400 });
  }

  try {
    const auth = Buffer.from(`${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`).toString('base64');
    
    // Ensure the URL ends with .mp3 for native playback
    const fetchUrl = url.endsWith('.mp3') ? url : `${url}.mp3`;

    const response = await fetch(fetchUrl, {
      headers: {
        'Authorization': `Basic ${auth}`
      }
    });

    if (!response.ok) {
      return new NextResponse('Failed to fetch recording from Twilio', { status: response.status });
    }

    // Stream the audio directly to the client
    return new NextResponse(response.body, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Disposition': 'inline',
        'Accept-Ranges': 'bytes'
      }
    });
  } catch (error) {
    console.error('Recording Proxy Error:', error);
    return new NextResponse('Error fetching recording', { status: 500 });
  }
}
