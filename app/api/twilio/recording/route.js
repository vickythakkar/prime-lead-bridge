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

    // Fetch the ENTIRE file from Twilio
    const response = await fetch(fetchUrl, {
      headers: { 'Authorization': `Basic ${auth}` }
    });

    if (!response.ok) {
      return new NextResponse('Failed to fetch recording from Twilio', { status: response.status });
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const totalSize = buffer.length;

    const rangeHeader = request.headers.get('range');

    if (rangeHeader) {
      // Parse Range header (e.g., "bytes=0-1000")
      const parts = rangeHeader.replace(/bytes=/, "").split("-");
      const partialstart = parts[0];
      const partialend = parts[1];

      const start = parseInt(partialstart, 10);
      const end = partialend ? parseInt(partialend, 10) : totalSize - 1;
      const chunksize = (end - start) + 1;

      const chunk = buffer.subarray(start, end + 1);

      return new NextResponse(chunk, {
        status: 206,
        headers: {
          'Content-Range': `bytes ${start}-${end}/${totalSize}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': chunksize.toString(),
          'Content-Type': 'audio/mpeg',
        },
      });
    }

    // No range requested, send full file
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Accept-Ranges': 'bytes',
        'Content-Length': totalSize.toString(),
        'Content-Type': 'audio/mpeg',
      },
    });

  } catch (error) {
    console.error('Recording Proxy Error:', error);
    return new NextResponse('Error fetching recording', { status: 500 });
  }
}
