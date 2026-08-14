import twilio from 'twilio';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function POST(request) {
  try {
    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get('org_id');
    const realDirection = searchParams.get('real_direction');
    const realFrom = searchParams.get('real_from');
    const realTo = searchParams.get('real_to');

    const formData = await request.formData();
    const callSid = formData.get('CallSid');
    const callStatus = formData.get('CallStatus');
    const dialCallStatus = formData.get('DialCallStatus');
    const dialCallDuration = formData.get('DialCallDuration');
    const recordingUrl = formData.get('RecordingUrl');
    const recordingSid = formData.get('RecordingSid');
    const from = formData.get('From');
    const to = formData.get('To');

    if (!orgId) {
      return new Response('Missing org_id', { status: 400 });
    }

    const direction = realDirection || (from.includes('client:') ? 'outbound' : 'inbound');
    const finalFrom = realFrom || from;
    const finalTo = realTo || to;
    
    // The actual external number involved
    const contactNumber = direction === 'inbound' ? finalFrom : finalTo;
    
    // Map status - we'll treat any webhook here as a loggable event.
    let mappedStatus = callStatus || 'completed'; // default if missing
    
    // For outbound dials specifically
    if (dialCallStatus) {
      if (['completed', 'answered'].includes(dialCallStatus)) mappedStatus = 'completed';
      else if (['no-answer', 'canceled'].includes(dialCallStatus)) mappedStatus = 'missed';
      else if (['busy', 'failed'].includes(dialCallStatus)) mappedStatus = dialCallStatus;
    } else if (callStatus) {
      if (['completed', 'in-progress'].includes(callStatus)) mappedStatus = 'completed';
      else if (['no-answer', 'canceled'].includes(callStatus)) mappedStatus = 'missed';
      else if (['busy', 'failed'].includes(callStatus)) mappedStatus = callStatus;
    }

    let contactId = null;
    if (contactNumber && !contactNumber.includes('client:')) {
      const { data: contact } = await supabaseAdmin
        .from('contacts')
        .select('id')
        .eq('organization_id', orgId)
        .eq('phone', contactNumber)
        .single();
      if (contact) {
        contactId = contact.id;
      }
    }

    const callDuration = formData.get('CallDuration');

    const durationVal = dialCallDuration ? parseInt(dialCallDuration, 10) : (callDuration ? parseInt(callDuration, 10) : 0);

    let finalRecordingUrl = recordingUrl;

    if (recordingUrl && recordingSid && recordingUrl.includes('api.twilio.com')) {
      try {
        const fetchUrl = recordingUrl.endsWith('.mp3') ? recordingUrl : `${recordingUrl}.mp3`;
        const auth = Buffer.from(`${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`).toString('base64');
        
        const response = await fetch(fetchUrl, {
          headers: { 'Authorization': `Basic ${auth}` }
        });

        if (response.ok) {
          const arrayBuffer = await response.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);
          
          const filePath = `${orgId}/${recordingSid}.mp3`;
          
          const { error: uploadError } = await supabaseAdmin.storage
            .from('call_recordings')
            .upload(filePath, buffer, {
              contentType: 'audio/mpeg',
              upsert: true
            });
            
          if (!uploadError) {
            finalRecordingUrl = filePath;
            
            // Delete from Twilio
            const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
            try {
              await client.recordings(recordingSid).remove();
            } catch (delErr) {
              console.error("Error deleting from Twilio:", delErr);
            }
          }
        }
      } catch (e) {
        console.error("Error migrating recording to Supabase:", e);
      }
    }

    const logData = {
      organization_id: orgId,
      twilio_call_sid: callSid,
      call_type: direction,
      from_number: finalFrom,
      to_number: finalTo,
      status: mappedStatus,
      duration: durationVal,
      recording_url: finalRecordingUrl,
      contact_id: contactId,
    };

    // Upsert
    const { data: existingLog, error: fetchErr } = await supabaseAdmin
      .from('call_logs')
      .select('id, duration, recording_url')
      .eq('twilio_call_sid', callSid)
      .maybeSingle();

    if (existingLog) {
      if (durationVal === 0 && existingLog.duration > 0) {
        logData.duration = existingLog.duration;
      }
      if (!recordingUrl && existingLog.recording_url) {
        logData.recording_url = existingLog.recording_url;
      }
      await supabaseAdmin
        .from('call_logs')
        .update(logData)
        .eq('id', existingLog.id);
    } else {
      await supabaseAdmin
        .from('call_logs')
        .insert(logData);
    }

    if (finalRecordingUrl && mappedStatus === 'missed') {
      // Create a voicemail record if it was missed and has a recording
      await supabaseAdmin.from('voicemails').insert({
        organization_id: orgId,
        from_number: finalFrom,
        recording_url: finalRecordingUrl,
        duration: dialCallDuration ? parseInt(dialCallDuration, 10) : 0
      });
    }

    // Return valid TwiML
    const VoiceResponse = twilio.twiml.VoiceResponse;
    const twiml = new VoiceResponse();

    const fallback = searchParams.get('fallback');
    if (fallback === 'voicemail' && dialCallStatus && ['no-answer', 'busy', 'failed', 'canceled'].includes(dialCallStatus)) {
      // The dial failed or timed out, redirect to voicemail node
      twiml.say({ voice: 'Polly.Matthew-Neural' }, 'The agent is currently unavailable. Please leave a message after the beep.');
      twiml.record({
        action: `/api/calls/status?org_id=${orgId}`,
        recordingStatusCallback: `/api/calls/status?org_id=${orgId}`,
        recordingStatusCallbackEvent: 'completed',
      });
    }

    return new Response(twiml.toString() || '<?xml version="1.0" encoding="UTF-8"?><Response></Response>', { 
      status: 200,
      headers: { 'Content-Type': 'text/xml' }
    });
  } catch (err) {
    console.error('Error in call status webhook:', err);
    return new Response('<?xml version="1.0" encoding="UTF-8"?><Response></Response>', { 
      status: 500,
      headers: { 'Content-Type': 'text/xml' }
    });
  }
}
