import twilio from 'twilio';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function POST(request) {
  const formData = await request.formData();
  
  const callSid = formData.get('CallSid');
  const recordingUrl = formData.get('RecordingUrl');
  const recordingSid = formData.get('RecordingSid');
  
  const { searchParams } = new URL(request.url);
  const orgId = searchParams.get('org_id');

  if (recordingUrl && recordingSid && callSid) {
    try {
      // 1. Download the recording from Twilio
      const response = await fetch(`${recordingUrl}.mp3`, {
        headers: {
          'Authorization': 'Basic ' + Buffer.from(
            process.env.TWILIO_ACCOUNT_SID + ':' + process.env.TWILIO_AUTH_TOKEN
          ).toString('base64')
        }
      });
      
      const audioBuffer = await response.arrayBuffer();

      // 2. Upload to Supabase Storage
      const fileName = `${orgId}/${callSid}_${recordingSid}.mp3`;
      const { data: uploadData, error: uploadError } = await supabaseAdmin
        .storage
        .from('call_recordings')
        .upload(fileName, audioBuffer, {
          contentType: 'audio/mpeg'
        });

      if (!uploadError) {
        // 3. Update Call Log with Supabase URL path
        await supabaseAdmin
          .from('call_logs')
          .update({ recording_url: fileName })
          .eq('call_sid', callSid);

        // 4. Delete recording from Twilio to save costs / privacy
        const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
        await client.recordings(recordingSid).remove();
      } else {
        console.error("Error uploading recording to Supabase:", uploadError);
      }
    } catch (err) {
      console.error("Failed to process recording:", err);
    }
  }

  return new Response('OK', { status: 200 });
}
