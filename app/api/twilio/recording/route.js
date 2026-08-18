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

    const fetchHeaders = {
      'Authorization': `Basic ${auth}`
    };

    // Forward the Range header if the browser sends one (essential for seeking/duration)
    const rangeHeader = request.headers.get('range');
    if (rangeHeader) {
      fetchHeaders['Range'] = rangeHeader;
    }

    const response = await fetch(fetchUrl, {
      headers: fetchHeaders
    });

    if (!response.ok) {
      return new NextResponse('Failed to fetch recording from Twilio', { status: response.status });
    }

    // Read the audio into a buffer instead of streaming it directly.
    // Streaming response.body causes Next.js to use chunked transfer encoding,
    // which strips the Content-Length header and breaks browser audio duration/seeking.
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const responseHeaders = new Headers({
      'Content-Type': 'audio/mpeg',
      'Content-Disposition': 'inline',
      'Content-Length': buffer.length.toString(),
      'Accept-Ranges': 'none'
    });

    return new NextResponse(buffer, {
      status: response.status,
      headers: responseHeaders
    });
  } catch (error) {
    console.error('Recording Proxy Error:', error);
    return new NextResponse('Error fetching recording', { status: 500 });
  }
}
