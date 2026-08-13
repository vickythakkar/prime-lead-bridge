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
        const twilioAccountSid = process.env.TWILIO_ACCOUNT_SID;
        const twilioAuthToken = process.env.TWILIO_AUTH_TOKEN;
        
        const response = await fetch(url, {
          headers: {
            'Authorization': 'Basic ' + Buffer.from(`${twilioAccountSid}:${twilioAuthToken}`).toString('base64')
          }
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch from Twilio: ${response.statusText}`);
        }

        const buffer = await response.arrayBuffer();
        
        return new Response(buffer, {
          headers: {
            'Content-Type': response.headers.get('Content-Type') || 'audio/x-wav',
            'Content-Disposition': 'inline'
          }
        });
      } else {
        // Generic proxy
        const response = await fetch(url);
        const buffer = await response.arrayBuffer();
        return new Response(buffer, {
          headers: {
            'Content-Type': response.headers.get('Content-Type') || 'audio/mpeg',
            'Content-Disposition': 'inline'
          }
        });
      }
    } else {
      // It's a Supabase storage path
      // Try 'recordings' bucket first, then 'call_recordings'
      let { data, error } = await supabaseAdmin.storage.from('recordings').download(url);
      
      if (error) {
        const { data: data2, error: error2 } = await supabaseAdmin.storage.from('call_recordings').download(url);
        if (error2) {
          throw new Error('Failed to download from storage');
        }
        data = data2;
      }

      const buffer = await data.arrayBuffer();
      
      return new Response(buffer, {
        headers: {
          'Content-Type': 'audio/webm', // Client recordings are usually webm
          'Content-Disposition': 'inline'
        }
      });
    }

  } catch (err) {
    console.error('Error proxying recording:', err);
    return new Response('Error proxying recording', { status: 500 });
  }
}
