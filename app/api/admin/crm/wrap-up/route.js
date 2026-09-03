import { supabaseAdmin } from '@/lib/supabase-admin';
import { verifyAdminToken } from '@/lib/admin-auth';

export async function POST(request) {
  try {
    const admin = verifyAdminToken(request);
    if (!admin) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { callDetails, form } = await request.json();

    // Handle Contact Status / Notes
    if (callDetails?.callSid) {
      // In this system, admin calls aren't logged in `call_logs` the exact same way or they might not have a call log since the admin dialer wasn't logging calls to `call_logs` but let's try
      await supabaseAdmin.from('call_logs')
        .update({
          notes: form.notes,
          disposition: form.disposition
        })
        .eq('call_sid', callDetails.callSid);
    }

    if (form.scheduleFollowUp && form.followUpDate && form.followUpTime) {
      const dueDateTime = new Date(`${form.followUpDate}T${form.followUpTime}`).toISOString();
      
      const taskData = {
        title: form.followUpTitle,
        description: form.notes,
        due_date: dueDateTime,
        status: 'pending',
        user_type: 'admin',
        phone_number: callDetails?.phoneNumber || null
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
