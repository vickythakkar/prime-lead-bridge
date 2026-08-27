import twilio from 'twilio';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { Resend } from 'resend';

const VoiceResponse = twilio.twiml.VoiceResponse;

export async function POST(request) {
  const formData = await request.formData();
  const { searchParams } = new URL(request.url);
  const digits = formData.get('Digits') || searchParams.get('Digits');
  const to = formData.get('To');
  const path = searchParams.get('path');
  
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
  let actionData = null;

  // 1. Traverse the tree using `path` and `digits`
  if (flowConfig.flow && Object.keys(flowConfig.flow).length > 0) {
    let currentNode = flowConfig.flow;
    
    // Follow the path if we are deep in the tree (e.g. "1.options")
    if (path) {
      const keys = path.split('.');
      for (const k of keys) {
        if (currentNode && currentNode[k]) {
          currentNode = currentNode[k];
        } else {
          currentNode = null;
          break;
        }
      }
    }

    // Now select the branch based on the digit pressed (if digits exist)
    if (currentNode && digits && currentNode[digits]) {
      actionData = currentNode[digits];
    } 
    // Or if there are no digits but we were directed to a specific action node (e.g. fallback)
    else if (currentNode && currentNode.action) {
      actionData = currentNode;
    }
  } 
  
  // 2. Legacy fallback if not using new flow builder
  if (!actionData) {
    if (flowConfig.keyPress && flowConfig.keyPress[digits]) {
      actionData = flowConfig.keyPress[digits];
    } else if ((!flowConfig.flow || Object.keys(flowConfig.flow).length === 0) && (!flowConfig.keyPress || Object.keys(flowConfig.keyPress).length === 0)) {
      if (digits === '1') {
        actionData = { 
          action: orgData.receive_office_calls ? 'route_browser' : (orgData.fallback_when_unavailable === 'fallback_number' ? 'forward_call' : 'voicemail'),
          phoneNumber: orgData.fallback_phone_number
        };
      } else if (digits === '2' && orgData.enable_listing_lookup !== false) {
        actionData = { action: 'property_lookup' };
      }
    }
  }

  // 3. Handle invalid selection
  if (!actionData) {
    twiml.say({ voice: 'Polly.Matthew-Neural' }, 'Sorry, I don\'t understand that choice.');
    twiml.redirect('/api/ivr/incoming'); // Sends them back to main menu
    return new Response(twiml.toString(), { headers: { 'Content-Type': 'text/xml' } });
  }

  // 4. Calculate next path string for fallbacks
  // e.g. path="1.options", digits="2" -> nextPath="1.options.2"
  const nextPath = path && digits ? `${path}.${digits}` : (digits ? digits : path);
  const fallbackQuery = actionData.fallback ? `&fallbackPath=${nextPath}.fallback` : '&fallback=voicemail';

  // 5. Execute Action
  const action = actionData.action;

  if (action === 'sub_menu') {
    const gather = twiml.gather({
      numDigits: 1,
      action: `/api/ivr/handle-menu?path=${nextPath}.options&To=${encodeURIComponent(to)}`,
      method: 'POST',
    });
    gather.say(
      { voice: 'Polly.Matthew-Neural' },
      actionData.greeting || 'Please listen carefully to the following options.'
    );
    twiml.redirect(`/api/ivr/handle-menu?path=${nextPath}.options&To=${encodeURIComponent(to)}`);
  }
  
  else if (action === 'route_browser') { // Legacy office dialer
    const dial = twiml.dial({ 
      record: 'record-from-ringing',
      action: `/api/calls/status?org_id=${orgData.id}${fallbackQuery}`,
      timeout: actionData.duration || actionData.timeout || 20
    });
    dial.client(`org_${orgData.id}`);
  } 
  
  // Helper to normalize phone numbers for comparison
  const normalizePhone = (p) => p ? p.replace(/\D/g, '').slice(-10) : '';
  const normalizedTo = normalizePhone(to);

  if (action === 'forward_call' || action === 'route_number') {
    const numberToDial = actionData.phoneNumber || actionData.number || orgData.fallback_phone_number;
    
    if (numberToDial && normalizePhone(numberToDial) === normalizedTo) {
      twiml.say({ voice: 'Polly.Matthew-Neural' }, 'System configuration error: circular forwarding detected.');
      if (actionData.fallback) twiml.redirect(`/api/ivr/handle-menu?path=${nextPath}.fallback&To=${encodeURIComponent(to)}`);
      else twiml.redirect('/api/ivr/incoming');
    } else if (numberToDial) {
      twiml.say({ voice: 'Polly.Matthew-Neural' }, 'Connecting you now.');
      const dial = twiml.dial({ 
        record: 'record-from-ringing',
        action: `/api/calls/status?org_id=${orgData.id}${fallbackQuery}`,
        timeout: actionData.duration || actionData.timeout || 20
      });
      dial.number(numberToDial);
    } else {
      twiml.say({ voice: 'Polly.Matthew-Neural' }, 'The forwarding number is not configured.');
      if (actionData.fallback) twiml.redirect(`/api/ivr/handle-menu?path=${nextPath}.fallback&To=${encodeURIComponent(to)}`);
      else twiml.redirect('/api/ivr/incoming');
    }
  } 
  
  else if (action === 'ring_team' || action === 'route_agent') {
    let agentPhone = null;
    let agentName = null;
    
    if (action === 'ring_team' && actionData.teamRole) {
      // Find an agent with that role (first available for now)
      const { data: agent } = await supabaseAdmin
        .from('contacts')
        .select('phone, name')
        .eq('organization_id', orgData.id)
        .eq('custom_fields->>role', actionData.teamRole)
        .not('phone', 'is', null)
        .limit(1)
        .single();
        
      if (agent) { agentPhone = agent.phone; agentName = agent.name; }
    } else if (action === 'route_agent' && actionData.agentId) {
      const { data: agent } = await supabaseAdmin.from('contacts').select('phone, name').eq('id', actionData.agentId).single();
      if (agent) { agentPhone = agent.phone; agentName = agent.name; }
    }

    if (agentPhone && normalizePhone(agentPhone) === normalizedTo) {
      twiml.say({ voice: 'Polly.Matthew-Neural' }, 'System configuration error: circular forwarding detected.');
      if (actionData.fallback) twiml.redirect(`/api/ivr/handle-menu?path=${nextPath}.fallback&To=${encodeURIComponent(to)}`);
      else twiml.redirect('/api/ivr/incoming');
    } else if (agentPhone) {
      twiml.say({ voice: 'Polly.Matthew-Neural' }, `Connecting you to ${agentName || 'our team'}.`);
      const dial = twiml.dial({ 
        record: 'record-from-ringing',
        action: `/api/calls/status?org_id=${orgData.id}${fallbackQuery}`,
        timeout: actionData.duration || actionData.timeout || 20 
      });
      dial.number(agentPhone);
    } else {
      twiml.say({ voice: 'Polly.Matthew-Neural' }, 'Sorry, no team members are available for that role.');
      if (actionData.fallback) twiml.redirect(`/api/ivr/handle-menu?path=${nextPath}.fallback&To=${encodeURIComponent(to)}`);
      else twiml.redirect('/api/ivr/incoming');
    }
  } 
  
  else if (action === 'voicemail') {
    const fromNumber = formData.get('From');

    twiml.say({ voice: 'Polly.Matthew-Neural' }, 'Our office is currently unavailable. Please leave a message after the beep.');
    twiml.record({
      action: `/api/calls/status?org_id=${orgData.id}&is_voicemail=true`,
      recordingStatusCallback: `/api/calls/status?org_id=${orgData.id}&is_voicemail=true`,
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
