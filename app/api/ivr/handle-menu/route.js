import twilio from 'twilio';

const VoiceResponse = twilio.twiml.VoiceResponse;

export async function POST(request) {
  const formData = await request.formData();
  const digits = formData.get('Digits');
  
  const twiml = new VoiceResponse();

  if (digits === '1') {
    // Route to office (for now, simply saying connecting to office and ending, 
    // but typically you would use <Dial> to a specific office number)
    twiml.say({ voice: 'Polly.Matthew-Neural' }, 'Connecting you to the office.');
    // twiml.dial('+1234567890'); // Placeholder for office number
  } else if (digits === '2') {
    // Ask for property lookup
    const gather = twiml.gather({
      action: '/api/ivr/lookup-property',
      method: 'POST',
    });

    gather.say(
      { voice: 'Polly.Matthew-Neural' },
      'Please enter the street number or zip code of the property you are inquiring about, followed by the pound sign.'
    );

    // If no input, ask again
    twiml.redirect('/api/ivr/handle-menu?Digits=2');
  } else {
    // Invalid option
    twiml.say({ voice: 'Polly.Matthew-Neural' }, 'Sorry, I don\'t understand that choice.');
    twiml.redirect('/api/ivr/incoming');
  }

  // Also handle GET for redirect
  return new Response(twiml.toString(), {
    headers: {
      'Content-Type': 'text/xml',
    },
  });
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const digits = searchParams.get('Digits');
  
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
    twiml.redirect('/api/ivr/handle-menu?Digits=2');
  } else {
    twiml.redirect('/api/ivr/incoming');
  }

  return new Response(twiml.toString(), {
    headers: {
      'Content-Type': 'text/xml',
    },
  });
}
