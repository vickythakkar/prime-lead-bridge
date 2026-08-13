import { supabaseAdmin } from '@/lib/supabase-admin';

export async function POST(request) {
  const formData = await request.formData();
  
  const callSid = formData.get('CallSid');
  const dialCallDuration = formData.get('DialCallDuration');
  
  try {
    if (callSid && dialCallDuration) {
      const durationInt = parseInt(dialCallDuration, 10);
      
      // Update the call log with the duration
      await supabaseAdmin
        .from('call_logs')
        .update({ duration: durationInt })
        .eq('call_sid', callSid);
    }

    return new Response('<?xml version="1.0" encoding="UTF-8"?><Response></Response>', { 
      status: 200,
      headers: { 'Content-Type': 'text/xml' }
    });
  } catch (err) {
    console.error('Call ended webhook error:', err);
    return new Response('<?xml version="1.0" encoding="UTF-8"?><Response></Response>', { 
      status: 500,
      headers: { 'Content-Type': 'text/xml' }
    });
  }
}
