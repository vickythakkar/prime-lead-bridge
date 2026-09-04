import { supabaseAdmin } from '@/lib/supabase-admin';
import { verifyAdminToken } from '@/lib/admin-auth';

export async function POST(request) {
  try {
    const admin = verifyAdminToken(request);
    if (!admin) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { callDetails, form, callId } = await request.json();

    // Handle Contact Status / Notes
    if (callDetails?.callSid) {
      const { data: callLog } = await supabaseAdmin
        .from('call_logs')
        .select('id')
        .eq('twilio_call_sid', callDetails.callSid)
        .maybeSingle();

      if (callLog) {
        await supabaseAdmin.from('call_logs').update({
          notes: form.notes,
          disposition: form.disposition
        }).eq('id', callLog.id);
      } else {
        await supabaseAdmin.from('call_logs').insert({
          twilio_call_sid: callDetails.callSid,
          disposition: form.disposition,
          notes: form.notes,
          call_type: 'outbound'
        });
      }
    } else if (callId) {
      await supabaseAdmin.from('call_logs').update({
        notes: form.notes,
        disposition: form.disposition
      }).eq('id', callId);
    }

    if (form.scheduleFollowUp && form.followUpDate && form.followUpTime) {
      const dueDateTime = new Date(`${form.followUpDate}T${form.followUpTime}`).toISOString();
      
      const taskData = {
        title: form.followUpTitle,
        description: form.notes,
        due_date: dueDateTime,
        status: 'pending',
        user_type: 'admin',
        phone_number: callDetails?.phoneNumber || null,
        disposition: form.disposition
      };

      const { error } = await supabaseAdmin.from('tasks').insert(taskData);
      if (error) console.error("Error creating admin task:", error);
    }

    return Response.json({ success: true });
  } catch (err) {
    console.error('Admin CRM Wrap-up error:', err);
    return Response.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
