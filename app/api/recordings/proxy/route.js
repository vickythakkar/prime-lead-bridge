import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const url = searchParams.get('url');

    if (!url) {
      return new Response('Missing url parameter', { status: 400 });
    }

    if (url.startsWith('http://') || url.startsWith('https://')) {
      // It's a Twilio URL or external URL
      if (url.includes('twilio.com')) {
        // We do the exact same lazy-migration logic here to save Vercel bandwidth!
        const match = url.match(/Recordings\/(RE[a-zA-Z0-9]+)/);
        if (match) {
          const recordingSid = match[1];
          const supabasePath = `twilio_recordings/${recordingSid}.mp3`;

          const { data: existingFiles } = await supabaseAdmin.storage
            .from('call_recordings')
            .list('twilio_recordings', { search: `${recordingSid}.mp3` });

          const exists = existingFiles && existingFiles.some(f => f.name === `${recordingSid}.mp3`);

          if (exists) {
            const { data: urlData } = supabaseAdmin.storage.from('call_recordings').getPublicUrl(supabasePath);
            return NextResponse.redirect(urlData.publicUrl, { status: 302 });
          }

          // If it doesn't exist, download and upload it
          const twilioAccountSid = process.env.TWILIO_ACCOUNT_SID;
          const twilioAuthToken = process.env.TWILIO_AUTH_TOKEN;
          
          const fetchUrl = url.endsWith('.mp3') ? url : `${url}.mp3`;
          const response = await fetch(fetchUrl, {
            headers: {
              'Authorization': 'Basic ' + Buffer.from(`${twilioAccountSid}:${twilioAuthToken}`).toString('base64')
            }
          });

          if (!response.ok) {
            throw new Error(`Failed to fetch from Twilio: ${response.statusText}`);
          }

          const arrayBuffer = await response.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);

          const { error: uploadError } = await supabaseAdmin.storage
            .from('call_recordings')
            .upload(supabasePath, buffer, {
              contentType: 'audio/mpeg',
              upsert: true
            });

          if (!uploadError) {
            const { data: urlData } = supabaseAdmin.storage.from('call_recordings').getPublicUrl(supabasePath);
            return NextResponse.redirect(urlData.publicUrl, { status: 302 });
          }

          // Fallback if upload fails
          return new Response(buffer, {
            headers: {
              'Content-Type': 'audio/mpeg',
              'Content-Disposition': 'inline',
              'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800'
            }
          });
        }
        
        // If it's a Twilio URL but doesn't match standard Recording regex, fallback to direct proxy
        const twilioAccountSid = process.env.TWILIO_ACCOUNT_SID;
        const twilioAuthToken = process.env.TWILIO_AUTH_TOKEN;
        const response = await fetch(url, {
          headers: {
            'Authorization': 'Basic ' + Buffer.from(`${twilioAccountSid}:${twilioAuthToken}`).toString('base64')
          }
        });
        const buffer = await response.arrayBuffer();
        return new Response(buffer, {
          headers: {
            'Content-Type': response.headers.get('Content-Type') || 'audio/mpeg',
            'Content-Disposition': 'inline',
            'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800'
          }
        });

      } else {
        // Generic proxy for other URLs
        const response = await fetch(url);
        const buffer = await response.arrayBuffer();
        return new Response(buffer, {
          headers: {
            'Content-Type': response.headers.get('Content-Type') || 'audio/mpeg',
            'Content-Disposition': 'inline',
            'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800'
          }
        });
      }
    } else {
      // It's a Supabase storage path.
      // INSTEAD of downloading it and proxying it through Vercel (burning 10GB bandwidth),
      // we can simply generate a public URL and 302 Redirect the client directly to Supabase CDN!
      
      // Let's assume 'recordings' and 'call_recordings' are both public.
      // If we don't know which bucket it's in, we can try to guess or just redirect to call_recordings.
      // But actually, we know it's a path. Let's redirect to 'recordings' first, or 'call_recordings'
      
      // Since it's public, we don't need to download it.
      // If it's a client recording (from Web Dialer), it's in 'recordings' bucket.
      // If it's a twilio recording, it's in 'call_recordings' bucket.
      let bucket = 'recordings';
      if (url.startsWith('twilio_recordings/')) {
        bucket = 'call_recordings';
      }
      
      const { data: urlData } = supabaseAdmin.storage.from(bucket).getPublicUrl(url);
      
      return NextResponse.redirect(urlData.publicUrl, { status: 302 });
    }

  } catch (err) {
    console.error('Error proxying recording:', err);
    return new Response('Error proxying recording', { status: 500 });
  }
}
