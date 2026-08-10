import { supabaseAdmin } from '@/lib/supabase-admin';

export async function POST(request) {
  const formData = await request.formData();
  
  const callSid = formData.get('CallSid');
  const dialCallDuration = formData.get('DialCallDuration');
  
  if (callSid && dialCallDuration) {
    const durationInt = parseInt(dialCallDuration, 10);
    
    // Update the call log with the duration
    await supabaseAdmin
      .from('call_logs')
      .update({ duration: durationInt })
      .eq('call_sid', callSid);
  }

  return new Response('OK', { status: 200 });
}
