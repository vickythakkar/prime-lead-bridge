import twilio from 'twilio';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { Resend } from 'resend';

const VoiceResponse = twilio.twiml.VoiceResponse;

export async function POST(request) {
  const formData = await request.formData();
  const digits = formData.get('Digits');
  const to = formData.get('To');
  
  let orgData = null;
  if (to) {
    const { data: numData } = await supabaseAdmin
      .from('organization_numbers')
      .select('organization_id')
      .eq('phone_number', to)
      .eq('status', 'active')
      .single();

    if (numData) {
      const { data } = await supabaseAdmin
        .from('organizations')
        .select('*')
        .eq('id', numData.organization_id)
        .single();
      orgData = data;
    }
  }

  const twiml = new VoiceResponse();

  if (!orgData) {
    twiml.say({ voice: 'Polly.Matthew-Neural' }, 'System error. Goodbye.');
    twiml.hangup();
    return new Response(twiml.toString(), { headers: { 'Content-Type': 'text/xml' } });
  }

  const flowConfig = orgData.ivr_flow_config || {};
  let action = null;
  let actionData = null;

  // Determine action from Dynamic IVR config if present, otherwise fallback to legacy logic
  if (flowConfig.keyPress && flowConfig.keyPress[digits]) {
    action = flowConfig.keyPress[digits].action;
    actionData = flowConfig.keyPress[digits];
  } else if (!flowConfig.keyPress || Object.keys(flowConfig.keyPress).length === 0) {
    // Legacy fallback logic
    if (digits === '1') {
      action = orgData.receive_office_calls ? 'route_browser' : (orgData.fallback_when_unavailable === 'fallback_number' ? 'route_number' : 'voicemail');
      actionData = { number: orgData.fallback_phone_number };
    } else if (digits === '2' && orgData.enable_listing_lookup !== false) {
      action = 'property_lookup';
    }
  }

  if (!action) {
    twiml.say({ voice: 'Polly.Matthew-Neural' }, 'Sorry, I don\'t understand that choice.');
    twiml.redirect('/api/ivr/incoming');
    return new Response(twiml.toString(), { headers: { 'Content-Type': 'text/xml' } });
  }

  // Execute the requested action
  if (action === 'route_browser') {
    twiml.say({ voice: 'Polly.Matthew-Neural' }, 'Connecting you to the office.');
    const dial = twiml.dial({ record: 'record-from-answer', action: `/api/calls/status?org_id=${orgData.id}` });
    dial.client(`org_${orgData.id}`); // browser dialer client name scoped to organization
  } 
  
  else if (action === 'route_number') {
    const numberToDial = actionData.number || orgData.fallback_phone_number;
    if (numberToDial) {
      twiml.say({ voice: 'Polly.Matthew-Neural' }, 'Connecting you now.');
      const dial = twiml.dial({ record: 'record-from-answer', action: `/api/calls/status?org_id=${orgData.id}` });
      dial.number(numberToDial);
    } else {
      twiml.say({ voice: 'Polly.Matthew-Neural' }, 'The forwarding number is not configured.');
      twiml.redirect('/api/ivr/incoming');
    }
  } 
  
  else if (action === 'route_agent') {
    // Lookup agent phone number
    if (actionData.agentId) {
      const { data: agent } = await supabaseAdmin.from('agents').select('cell_phone, name').eq('id', actionData.agentId).single();
      if (agent && agent.cell_phone) {
        twiml.say({ voice: 'Polly.Matthew-Neural' }, `Connecting you to ${agent.name}.`);
        const dial = twiml.dial({ 
          record: 'record-from-answer', 
          action: `/api/calls/status?org_id=${orgData.id}&fallback=voicemail`,
          timeout: 20 
        });
        dial.number(agent.cell_phone);
      } else {
        twiml.say({ voice: 'Polly.Matthew-Neural' }, 'Sorry, that agent could not be reached.');
        twiml.redirect('/api/ivr/incoming');
      }
    } else {
      twiml.say({ voice: 'Polly.Matthew-Neural' }, 'Agent configuration is invalid.');
      twiml.redirect('/api/ivr/incoming');
    }
  } 
  
  else if (action === 'voicemail') {
    // We can handle sending a missed call email here before they leave a voicemail
    const fromNumber = formData.get('From');
    if (process.env.RESEND_API_KEY) {
      const notifyEmail = orgData.notify_email || process.env.NOTIFY_EMAIL;
      if (notifyEmail) {
        try {
          const resend = new Resend(process.env.RESEND_API_KEY);
          resend.emails.send({
            from: 'info@primerealops.com',
            to: notifyEmail,
            subject: `Missed call from ${fromNumber}`,
            html: `<p>You missed a call from <strong>${fromNumber}</strong>. They were routed to voicemail.</p>`
          });
        } catch (err) {
          console.error('Failed to send missed call email:', err);
        }
      }
    }
    twiml.say({ voice: 'Polly.Matthew-Neural' }, 'Our office is currently unavailable. Please leave a message after the beep.');
    // the callback will handle saving it to voicemails table
    twiml.record({
      action: `/api/calls/status?org_id=${orgData.id}`,
      recordingStatusCallback: `/api/calls/status?org_id=${orgData.id}`,
      recordingStatusCallbackEvent: 'completed',
    });
  } 
  
  else if (action === 'property_lookup') {
    const gather = twiml.gather({
      action: '/api/ivr/lookup-property',
      method: 'POST',
    });
    gather.say(
      { voice: 'Polly.Matthew-Neural' },
      'Please enter the street number or zip code of the property you are inquiring about, followed by the pound sign.'
    );
    twiml.redirect('/api/ivr/handle-menu?Digits=2&To=' + encodeURIComponent(to));
  }

  return new Response(twiml.toString(), {
    headers: { 'Content-Type': 'text/xml' },
  });
}

// Fallback for GET requests
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const digits = searchParams.get('Digits');
  const to = searchParams.get('To');
  
  const twiml = new VoiceResponse();
  
  if (digits === '2') {
    const gather = twiml.gather({
      action: '/api/ivr/lookup-property',
      method: 'POST',
    });
    gather.say(
      { voice: 'Polly.Matthew-Neural' },
      'Please enter the street number or zip code of the property you are inquiring about, followed by the pound sign.'
    );
    twiml.redirect('/api/ivr/handle-menu?Digits=2&To=' + encodeURIComponent(to || ''));
  } else {
    twiml.redirect('/api/ivr/incoming');
  }

  return new Response(twiml.toString(), {
    headers: { 'Content-Type': 'text/xml' },
  });
}
