import twilio from 'twilio';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { Resend } from 'resend';

// Resend will be instantiated inside the handler to prevent Vercel build errors
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

  if (digits === '1') {
    // Route to office
    if (orgData.receive_office_calls) {
      twiml.say({ voice: 'Polly.Matthew-Neural' }, 'Connecting you to the office.');
      
      const dial = twiml.dial({ record: 'record-from-answer', action: `/api/calls/status?org_id=${orgData.id}` });
      dial.client(`org_${orgData.id}`); // browser dialer client name scoped to organization
    } else {
      if (orgData.fallback_when_unavailable === 'fallback_number' && orgData.fallback_phone_number) {
        twiml.say({ voice: 'Polly.Matthew-Neural' }, 'Connecting you to the office.');
        const dial = twiml.dial({ record: 'record-from-answer', action: `/api/calls/status?org_id=${orgData.id}` });
        dial.number(orgData.fallback_phone_number);
      } else {
        // Voicemail fallback
        
        const fromNumber = formData.get('From');
        if (process.env.RESEND_API_KEY) {
          const notifyEmail = orgData.notify_email || process.env.NOTIFY_EMAIL;
          if (notifyEmail) {
            try {
              const resend = new Resend(process.env.RESEND_API_KEY);
              await resend.emails.send({
                from: 'info@primerealops.com',
                to: notifyEmail,
                subject: `Missed call from ${fromNumber}`,
                html: `<p>You missed a call from <strong>${fromNumber}</strong>. They were sent to voicemail.</p>`
              });
            } catch (err) {
              console.error('Failed to send missed call email:', err);
            }
          }
        }

        twiml.say({ voice: 'Polly.Matthew-Neural' }, 'Our office is currently unavailable. Please leave a message after the beep.');
        twiml.record({
          action: `/api/calls/status?org_id=${orgData.id}`,
          recordingStatusCallback: `/api/calls/status?org_id=${orgData.id}`
        });
      }
    }
  } else if (digits === '2') {
    if (orgData.enable_listing_lookup === false) {
      twiml.say({ voice: 'Polly.Matthew-Neural' }, 'Listing lookup is not enabled.');
      twiml.redirect('/api/ivr/incoming');
    } else {
      // Ask for property lookup
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
  } else {
    // Invalid option
    twiml.say({ voice: 'Polly.Matthew-Neural' }, 'Sorry, I don\'t understand that choice.');
    twiml.redirect('/api/ivr/incoming');
  }

  return new Response(twiml.toString(), {
    headers: { 'Content-Type': 'text/xml' },
  });
}

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
