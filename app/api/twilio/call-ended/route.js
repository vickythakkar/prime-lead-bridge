import { supabaseAdmin } from '@/lib/supabase-admin';

export async function POST(request) {
  try {
    const formData = await request.formData();
    
    const callSid = formData.get('CallSid');
    const dialCallDuration = formData.get('DialCallDuration');
    const callDuration = formData.get('CallDuration'); // Fallback if DialCallDuration is missing
    
    // Use DialCallDuration (time connected to agent), fallback to CallDuration (total time in Twilio)
    const durationStr = dialCallDuration || callDuration;
    
    if (callSid && durationStr) {
      const durationInt = parseInt(durationStr, 10);
      const callMinutes = Math.ceil(durationInt / 60); // Round up to nearest minute
      
      // 1. Get the call log to find the organization
      const { data: callLog } = await supabaseAdmin
        .from('call_logs')
        .select('id, organization_id, cost_broker')
        .eq('twilio_call_sid', callSid)
        .single();
        
      if (callLog && callLog.cost_broker === null) {
        // 2. Get organization settings
        const { data: org } = await supabaseAdmin
          .from('organizations')
          .select('subscription_plan, ivr_flow_config')
          .eq('id', callLog.organization_id)
          .single();
          
        if (org) {
          // 3. Determine base rate and included minutes
          let includedMins = 0;
          let perMinRate = 0.05; // default fallback
          
          const planId = (org.subscription_plan || 'pay_as_you_go').toLowerCase();
          
          const { data: planData } = await supabaseAdmin
            .from('subscription_plans')
            .select('included_minutes, overage_rate')
            .eq('id', planId)
            .single();

          if (planData) {
            includedMins = planData.included_minutes || 0;
            const customRateStr = org.ivr_flow_config?.rate_per_minute;
            perMinRate = customRateStr !== null && customRateStr !== undefined && customRateStr !== ''
              ? parseFloat(customRateStr)
              : parseFloat(planData.overage_rate || 0);
          } else {
            // Fallback for custom PAYG overrides or legacy
            const customRateStr = org.ivr_flow_config?.rate_per_minute;
            if (customRateStr !== null && customRateStr !== undefined && customRateStr !== '') {
              perMinRate = parseFloat(customRateStr);
            }
          }
          
          let costForThisCall = 0;
          
          if (includedMins > 0) {
            // 4. Calculate total minutes used THIS MONTH (excluding this call)
            const now = new Date();
            const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
            
            const { data: pastCalls } = await supabaseAdmin
              .from('call_logs')
              .select('duration')
              .eq('organization_id', callLog.organization_id)
              .gte('created_at', startOfMonth)
              .neq('id', callLog.id); // exclude the current call just in case
              
            const pastSeconds = (pastCalls || []).reduce((sum, c) => sum + (c.duration || 0), 0);
            const pastMinutes = Math.ceil(pastSeconds / 60); // Total minutes used prior to this call
            
            // 5. Calculate billable minutes for THIS call
            if (pastMinutes >= includedMins) {
              // Already exhausted all included minutes in previous calls
              costForThisCall = callMinutes * perMinRate;
            } else {
              // Some included minutes remaining
              const minutesRemaining = includedMins - pastMinutes;
              if (callMinutes > minutesRemaining) {
                // Call exhausted the remaining included minutes
                const billableMinutes = callMinutes - minutesRemaining;
                costForThisCall = billableMinutes * perMinRate;
              } else {
                // Call fully covered by included minutes
                costForThisCall = 0;
              }
            }
          } else {
            // No included minutes, standard per-minute billing
            costForThisCall = callMinutes * perMinRate;
          }
          
          // 6. Update the call log with duration and snapshot the exact cost!
          await supabaseAdmin
            .from('call_logs')
            .update({ 
              duration: durationInt,
              cost_broker: parseFloat(costForThisCall.toFixed(4))
            })
            .eq('id', callLog.id);
        }
      } else if (callLog) {
         // Fallback just update duration if it was already processed somehow
         await supabaseAdmin.from('call_logs').update({ duration: durationInt }).eq('id', callLog.id);
      }
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
