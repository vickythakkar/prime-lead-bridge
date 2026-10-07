import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get('url');
  
  if (!url || !url.includes('api.twilio.com')) {
    return new NextResponse('Invalid URL', { status: 400 });
  }

  try {
    // Extract the Twilio Recording SID to use as a unique filename
    const match = url.match(/Recordings\/(RE[a-zA-Z0-9]+)/);
    if (!match) {
      return new NextResponse('Invalid Twilio Recording URL format', { status: 400 });
    }
    const recordingSid = match[1];
    const supabasePath = `twilio_recordings/${recordingSid}.mp3`;

    // 1. Check if the recording has already been migrated to Supabase
    const { data: existingFiles } = await supabaseAdmin.storage
      .from('call_recordings')
      .list('twilio_recordings', { search: `${recordingSid}.mp3` });

    const exists = existingFiles && existingFiles.some(f => f.name === `${recordingSid}.mp3`);

    // 2. If it already exists, immediately redirect to Supabase CDN to save Vercel bandwidth!
    if (exists) {
      const { data: urlData } = supabaseAdmin.storage.from('call_recordings').getPublicUrl(supabasePath);
      return NextResponse.redirect(urlData.publicUrl, { status: 302 });
    }

    // 3. If it DOES NOT exist in Supabase yet, download it from Twilio...
    const auth = Buffer.from(`${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`).toString('base64');
    
    // Ensure the URL ends with .mp3 for native playback
    const fetchUrl = url.endsWith('.mp3') ? url : `${url}.mp3`;

    const response = await fetch(fetchUrl, {
      headers: { 'Authorization': `Basic ${auth}` }
    });

    if (!response.ok) {
      return new NextResponse('Failed to fetch recording from Twilio', { status: response.status });
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 4. ...and upload it to Supabase Storage for future plays!
    const { error: uploadError } = await supabaseAdmin.storage
      .from('call_recordings')
      .upload(supabasePath, buffer, {
        contentType: 'audio/mpeg',
        upsert: true
      });

    if (uploadError) {
      console.error('Failed to upload to Supabase, falling back to serving directly:', uploadError);
      
      // Fallback: Serve the file directly if upload fails
      return new NextResponse(buffer, {
        status: 200,
        headers: {
          'Accept-Ranges': 'bytes',
          'Content-Length': buffer.length.toString(),
          'Content-Type': 'audio/mpeg',
          'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800'
        },
      });
    }

    // 5. Upload succeeded! Redirect the browser to the new Supabase URL
    const { data: urlData } = supabaseAdmin.storage.from('call_recordings').getPublicUrl(supabasePath);
    return NextResponse.redirect(urlData.publicUrl, { status: 302 });

  } catch (error) {
    console.error('Recording Proxy Error:', error);
    return new NextResponse('Error fetching recording', { status: 500 });
  }
}
