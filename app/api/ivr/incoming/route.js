import twilio from 'twilio';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { Resend } from 'resend';
import { sendPushToOrg, sendPushToAdmin } from '@/lib/push-notifications';

const VoiceResponse = twilio.twiml.VoiceResponse;

export async function POST(request) {
  const formData = await request.formData();
  const to = formData.get('To');
  
  let orgData = null;

  if (to) {
    const { data: numData } = await supabaseAdmin
      .from('organization_numbers')
      .select('organization_id')
      .eq('phone_number', to)
      .eq('status', 'active')
      .maybeSingle();

    if (numData) {
      const { data } = await supabaseAdmin
        .from('organizations')
        .select('*')
        .eq('id', numData.organization_id)
        .maybeSingle();
      orgData = data;
    }
  }
  
  const from = formData.get('From');
  
  const twiml = new VoiceResponse();

  if (!orgData) {
    twiml.say({ voice: 'Polly.Matthew-Neural' }, 'This number is not configured correctly. Goodbye.');
    twiml.hangup();
    return new Response(twiml.toString(), { headers: { 'Content-Type': 'text/xml' } });
  }

  // ENFORCE SERVICE SUSPENSION
  if (orgData.service_active === false) {
    twiml.say({ voice: 'Polly.Matthew-Neural' }, 'The services for this number have been temporarily suspended. Please contact support. Goodbye.');
    twiml.hangup();
    return new Response(twiml.toString(), { headers: { 'Content-Type': 'text/xml' } });
  }

  // Send push notifications for incoming call
  const pushPayload = {
    title: '📞 Incoming Call',
    body: `Incoming call from ${from}`,
    tag: 'incoming-call',
    url: '/dashboard/calls'
  };
  sendPushToOrg(orgData.id, pushPayload).catch(() => {});
  sendPushToAdmin({ ...pushPayload, url: '/admin/activity' }).catch(() => {});

  const flowConfig = orgData.ivr_flow_config || {};

  // If IVR Greeting is disabled (legacy fallback) or no keypress options exist
  if (orgData.play_ivr_greeting === false) {
    twiml.redirect('/api/ivr/handle-menu?Digits=1');
    return new Response(twiml.toString(), { headers: { 'Content-Type': 'text/xml' } });
  }

  // Use custom greeting or fallback
  const defaultGreeting = `Welcome to ${orgData.company_name || 'our office'}. To connect with the office, press 1.` 
    + (orgData.enable_listing_lookup !== false ? ` If you are a buyer inquiring about a property, press 2.` : ``);
  
  const greetingText = flowConfig.greeting || orgData.ivr_greeting || defaultGreeting;

  const hasFlow = flowConfig.flow && Object.keys(flowConfig.flow).length > 0;
  const hasLegacyKeyPress = flowConfig.keyPress && Object.keys(flowConfig.keyPress).length > 0;

  if (!hasFlow && !hasLegacyKeyPress) {
    // No routing options defined! Just play greeting and connect immediately (equivalent to pressing 1)
    twiml.say({ voice: 'Polly.Matthew-Neural' }, greetingText);
    twiml.redirect('/api/ivr/handle-menu?Digits=1');
    return new Response(twiml.toString(), { headers: { 'Content-Type': 'text/xml' } });
  }

  const gather = twiml.gather({
    numDigits: 1,
    action: '/api/ivr/handle-menu',
    method: 'POST',
  });

  gather.say(
    { voice: 'Polly.Matthew-Neural' },
    greetingText
  );

  twiml.redirect('/api/ivr/incoming');

  return new Response(twiml.toString(), {
    headers: { 'Content-Type': 'text/xml' },
  });
}
