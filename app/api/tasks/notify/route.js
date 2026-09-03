import { supabaseAdmin } from '@/lib/supabase-admin';
import { sendPushToOrg } from '@/lib/push-notifications';
import { sendEmail } from '@/lib/email'; // Assuming you have this, if not we'll just skip email or mock it

export async function POST(request) {
  try {
    const { task, action } = await request.json();

    if (action === 'created' && task.organization_id) {
      // 1. Send Web Push Notification
      const pushPayload = {
        title: 'Follow-up Scheduled',
        body: `${task.title} is scheduled for ${new Date(task.due_date).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}`,
        url: '/dashboard',
        tag: 'task-update'
      };
      
      await sendPushToOrg(task.organization_id, pushPayload);
      
      // 2. We could also send an email here using Resend or SendGrid if configured
      // await sendEmail({ to: brokerEmail, subject: 'Task Created', text: pushPayload.body });
    }

    return Response.json({ success: true });
  } catch (err) {
    console.error('Task notify error:', err);
    return Response.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
