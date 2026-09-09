import twilio from 'twilio';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { sendEmail } from '@/lib/email';
import { getVoicemailEmailHtml } from '@/lib/email-templates';
import { sendPushToOrg, sendPushToAdmin } from '@/lib/push-notifications';

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

    // Delay the terminal statusCallback by 2 seconds to allow the <Dial> action webhook 
    // (which fires simultaneously) to insert the call log first. This prevents a race 
    // condition that creates duplicate logs.
    if (callStatus === 'completed' && !dialCallStatus) {
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    // We must safely handle missing From/To because Twilio's recordingStatusCallback omits them.
    let finalFrom = realFrom || from;
    let finalTo = realTo || to;
    let direction = realDirection;
    
    // Fetch existing log early to inherit data if this is a recordingStatusCallback
    const { data: existingLog } = await supabaseAdmin
      .from('call_logs')
      .select('*')
      .eq('twilio_call_sid', callSid)
      .maybeSingle();

    if (existingLog) {
      finalFrom = finalFrom || existingLog.from_number;
      finalTo = finalTo || existingLog.to_number;
      direction = direction || existingLog.call_type;
    }

    // Default if completely new and missing info
    direction = direction || (finalFrom && finalFrom.includes('client:') ? 'outbound' : 'inbound');
    finalFrom = finalFrom || 'Unknown';
    finalTo = finalTo || 'Unknown';
    
    // The actual external number involved
    const contactNumber = direction === 'inbound' ? finalFrom : finalTo;
    
    // Map status - we'll treat any webhook here as a loggable event.
    let mappedStatus = callStatus || 'completed'; // default if missing
    
    const isVoicemail = searchParams.get('is_voicemail') === 'true';

    // For outbound dials specifically
    if (isVoicemail) {
      mappedStatus = 'voicemail';
    } else if (dialCallStatus) {
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
      const digitsOnly = contactNumber.replace(/\D/g, '');
      const last10 = digitsOnly.slice(-10);
      
      if (last10.length === 10) {
        const { data: contact } = await supabaseAdmin
          .from('contacts')
          .select('id')
          .eq('organization_id', orgId)
          .ilike('phone', `%${last10}%`)
          .or('is_deleted.is.null,is_deleted.eq.false')
          .maybeSingle(); // maybeSingle to avoid 406 if multiple matches (though ideally only 1)
          
        if (contact) {
          contactId = contact.id;
        }
      } else {
        // Fallback to exact match if for some reason it's not a 10 digit number
        const { data: contact } = await supabaseAdmin
          .from('contacts')
          .select('id')
          .eq('organization_id', orgId)
          .eq('phone', contactNumber)
          .or('is_deleted.is.null,is_deleted.eq.false')
          .maybeSingle();
        if (contact) contactId = contact.id;
      }
    }

    const callDuration = formData.get('CallDuration');
    const recordingDuration = formData.get('RecordingDuration');

    // We prioritize RecordingDuration if available because it perfectly matches the audio file length.
    // Otherwise we fall back to the parent callDuration (which includes ringing/IVR).
    // dialCallDuration only includes the time the child call was actively answered.
    const durationVal = recordingDuration ? parseInt(recordingDuration, 10) : 
                       (callDuration ? parseInt(callDuration, 10) : 
                       (dialCallDuration ? parseInt(dialCallDuration, 10) : 0));

    let finalRecordingUrl = recordingUrl;

    // The frontend proxies Twilio recordings through /api/twilio/recording
    // so we just leave finalRecordingUrl as the original Twilio URL 
    // and rely on Twilio's native storage.

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

    if (existingLog) {
      if (durationVal === 0 && existingLog.duration > 0) {
        logData.duration = existingLog.duration;
      }
      if (!recordingUrl && existingLog.recording_url) {
        logData.recording_url = existingLog.recording_url;
      }
      
      // Preserve specific statuses from being overwritten by the generic terminal 'completed'
      const specificStatuses = ['voicemail', 'missed', 'failed', 'busy'];
      if (mappedStatus === 'completed' && specificStatuses.includes(existingLog.status)) {
        logData.status = existingLog.status;
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

    const recordingSource = formData.get('RecordingSource');

    // ONLY insert voicemail on the 'completed' webhook for recordings to prevent duplicates
    const recordingStatus = formData.get('RecordingStatus');
    if (finalRecordingUrl && (isVoicemail || recordingSource === 'RecordVerb')) {
      if (!recordingStatus || recordingStatus === 'completed') {
        const { data: existingVm } = await supabaseAdmin.from('voicemails').select('id').eq('recording_url', finalRecordingUrl).maybeSingle();
        
        if (!existingVm) {
          const recordingDuration = formData.get('RecordingDuration');
          const vmDuration = recordingDuration ? parseInt(recordingDuration, 10) : (dialCallDuration ? parseInt(dialCallDuration, 10) : 0);
          
          await supabaseAdmin.from('voicemails').insert({
          organization_id: orgId,
          from_number: finalFrom,
          recording_url: finalRecordingUrl,
          duration: vmDuration,
          contact_id: contactId
        });
      
      try {
        const { data: orgInfo } = await supabaseAdmin
          .from('organizations')
          .select('notify_email, contact_email')
          .eq('id', orgId)
          .single();
          
        const recipientEmail = orgInfo?.notify_email || orgInfo?.contact_email;
        if (recipientEmail) {
          await sendEmail({
            to: recipientEmail,
            subject: 'New Voicemail Received - Prime Lead Bridge',
            html: getVoicemailEmailHtml(finalFrom, dialCallDuration ? parseInt(dialCallDuration, 10) : 0, finalRecordingUrl)
          });
        }
      } catch (emailErr) {
        console.error('Failed to send voicemail email:', emailErr);
      }

      // Push notification for voicemail
      const vmPush = {
        title: '🎙️ New Voicemail',
        body: `New voicemail from ${finalFrom}`,
        tag: 'new-voicemail',
        url: '/dashboard/voicemails'
      };
      sendPushToOrg(orgId, vmPush).catch(() => {});
      sendPushToAdmin({ ...vmPush, url: '/admin/voicemails' }).catch(() => {});
    }
    }
    } else if ((mappedStatus === 'missed' || isVoicemail) && callStatus === 'completed' && !finalRecordingUrl && !recordingStatus) {
      try {
        const { data: orgInfo } = await supabaseAdmin
          .from('organizations')
          .select('notify_email, contact_email')
          .eq('id', orgId)
          .single();
          
        const recipientEmail = orgInfo?.notify_email || orgInfo?.contact_email;
        if (recipientEmail) {
          await sendEmail({
            to: recipientEmail,
            subject: `Missed call from ${finalFrom}`,
            html: `<p>You missed a call from <strong>${finalFrom}</strong> and no voicemail was left.</p>`
          });
        }
      } catch (emailErr) {
        console.error('Failed to send missed call email:', emailErr);
      }
    }
    // Return valid TwiML
    const VoiceResponse = twilio.twiml.VoiceResponse;
    const twiml = new VoiceResponse();

    const fallback = searchParams.get('fallback');
    const fallbackPath = searchParams.get('fallbackPath');
    
    if (fallbackPath && dialCallStatus && ['no-answer', 'busy', 'failed', 'canceled'].includes(dialCallStatus)) {
      twiml.redirect(`/api/ivr/handle-menu?path=${fallbackPath}&To=${encodeURIComponent(finalTo)}`);
    } else if (fallback === 'voicemail' && dialCallStatus && ['no-answer', 'busy', 'failed', 'canceled'].includes(dialCallStatus)) {
      // The dial failed or timed out, redirect to voicemail node
      twiml.say({ voice: 'Polly.Matthew-Neural' }, 'The agent is currently unavailable. Please leave a message after the beep.');
      twiml.record({
        action: `/api/calls/status?org_id=${orgId}&is_voicemail=true`,
        recordingStatusCallback: `/api/calls/status?org_id=${orgId}&is_voicemail=true`,
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
