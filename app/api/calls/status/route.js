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

    const logData = {
      organization_id: orgId,
      call_sid: callSid,
      direction,
      from_number: finalFrom,
      to_number: finalTo,
      status: mappedStatus,
      duration: dialCallDuration ? parseInt(dialCallDuration, 10) : 0,
      recording_url: recordingUrl,
      contact_id: contactId,
    };

    // Upsert
    const { data: existingLog } = await supabaseAdmin
      .from('call_logs')
      .select('id')
      .eq('call_sid', callSid)
      .single();

    if (existingLog) {
      await supabaseAdmin
        .from('call_logs')
        .update(logData)
        .eq('id', existingLog.id);
    } else {
      await supabaseAdmin
        .from('call_logs')
        .insert(logData);
    }

    if (recordingUrl && mappedStatus === 'missed') {
      // Create a voicemail record if it was missed and has a recording
      await supabaseAdmin.from('voicemails').insert({
        organization_id: orgId,
        from_number: finalFrom,
        recording_url: recordingUrl,
        duration: dialCallDuration ? parseInt(dialCallDuration, 10) : 0
      });
    }

    // Return valid empty TwiML so Twilio doesn't read the text "OK" aloud if this is an action URL
    return new Response('<?xml version="1.0" encoding="UTF-8"?><Response></Response>', { 
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
