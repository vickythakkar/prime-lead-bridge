import twilio from 'twilio';
import { supabaseAdmin } from '@/lib/supabase-admin';

const VoiceResponse = twilio.twiml.VoiceResponse;

export async function POST(request) {
  const formData = await request.formData();
  const digits = formData.get('Digits');
  const caller = formData.get('From');
  const callSid = formData.get('CallSid');
  
  const { searchParams } = new URL(request.url);
  const propertyId = searchParams.get('property_id');
  
  const twiml = new VoiceResponse();

  if (digits === '1') {
    // Confirmed property
    // Fetch property details to determine routing
    const { data: property, error } = await supabaseAdmin
      .from('properties')
      .select('*, agents(*)')
      .eq('id', propertyId)
      .single();

    if (error || !property) {
      twiml.say({ voice: 'Polly.Matthew-Neural' }, 'An error occurred while routing your call. Please try again later.');
      return new Response(twiml.toString(), { headers: { 'Content-Type': 'text/xml' } });
    }

    // Log the lead
    await supabaseAdmin.from('leads').insert([{
      organization_id: property.organization_id,
      property_id: property.id,
      caller_phone: caller,
      status: 'new'
    }]);

    // Log the call
    const to = formData.get('To') || '';
    await supabaseAdmin.from('call_logs').insert([{
      organization_id: property.organization_id,
      property_id: property.id,
      from_number: caller,
      to_number: to,
      call_type: 'inbound',
      call_sid: callSid,
      status: 'in-progress',
      duration: 0
    }]);

    // Determine who to route to
    let dialNumber = '';
    let personName = '';
    
    if (property.route_to === 'seller' && property.seller_phone) {
      dialNumber = property.seller_phone;
      personName = 'the seller';
    } else if (property.agents && property.agents.cell_phone) {
      dialNumber = property.agents.cell_phone;
      personName = 'the listing agent';
    }

    if (dialNumber) {
      twiml.say({ voice: 'Polly.Matthew-Neural' }, `Connecting you to ${personName} now.`);
      
      // We pass record="record-from-ringing" and provide a recordingStatusCallback 
      // so Twilio will ping our server when the recording is ready.
      // We also provide an action URL to log the total call duration after the call ends.
      twiml.dial({
        record: 'record-from-ringing',
        recordingStatusCallback: `/api/twilio/recording?call_sid=${callSid}&org_id=${property.organization_id}`,
        recordingStatusCallbackEvent: 'completed',
        action: `/api/twilio/call-ended?call_sid=${callSid}`,
        method: 'POST'
      }, dialNumber);

    } else {
      twiml.say({ voice: 'Polly.Matthew-Neural' }, 'We do not have a valid phone number on file for this property. Goodbye.');
    }
    
  } else if (digits === '2') {
    // Try again
    twiml.redirect('/api/ivr/handle-menu?Digits=2');
  } else {
    twiml.say({ voice: 'Polly.Matthew-Neural' }, 'Invalid choice.');
    twiml.redirect(`/api/ivr/handle-menu?Digits=2`);
  }

  return new Response(twiml.toString(), {
    headers: {
      'Content-Type': 'text/xml',
    },
  });
}
