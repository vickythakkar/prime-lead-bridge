import twilio from 'twilio';
import { supabaseAdmin } from '@/lib/supabase-admin';

const VoiceResponse = twilio.twiml.VoiceResponse;

export async function POST(request) {
  const formData = await request.formData();
  const digits = formData.get('Digits');
  const caller = formData.get('From');
  const callSid = formData.get('CallSid');
  
  const { searchParams } = new URL(request.url);
  const idsParam = searchParams.get('ids');
  
  const twiml = new VoiceResponse();

  if (!idsParam || !digits) {
    twiml.say({ voice: 'Polly.Matthew-Neural' }, 'Invalid selection.');
    twiml.redirect('/api/ivr/handle-menu?Digits=2');
    return new Response(twiml.toString(), { headers: { 'Content-Type': 'text/xml' } });
  }

  const ids = idsParam.split(',');
  // Digits is 1-based index
  const selectedIndex = parseInt(digits, 10) - 1;

  if (selectedIndex >= 0 && selectedIndex < ids.length) {
    const selectedId = ids[selectedIndex];
    
    // Redirect to confirm-property with selected ID, simulating pressing '1' on that property
    // To make it easy, we will just fetch the property and dial directly here
    
    const { data: property, error } = await supabaseAdmin
      .from('properties')
      .select('*, agents(*)')
      .eq('id', selectedId)
      .single();

    if (error || !property) {
      twiml.say({ voice: 'Polly.Matthew-Neural' }, 'Error retrieving property.');
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
    await supabaseAdmin.from('call_logs').insert([{
      organization_id: property.organization_id,
      property_id: property.id,
      caller_number: caller,
      call_sid: callSid,
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
      twiml.say({ voice: 'Polly.Matthew-Neural' }, `Connecting you to ${personName} for ${property.address}.`);
      twiml.dial(dialNumber);
    } else {
      twiml.say({ voice: 'Polly.Matthew-Neural' }, 'We do not have a valid phone number on file for this property. Goodbye.');
    }
  } else {
    twiml.say({ voice: 'Polly.Matthew-Neural' }, 'Invalid selection.');
    twiml.redirect('/api/ivr/handle-menu?Digits=2');
  }

  return new Response(twiml.toString(), {
    headers: {
      'Content-Type': 'text/xml',
    },
  });
}
