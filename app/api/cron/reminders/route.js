import { supabaseAdmin } from '@/lib/supabase-admin';
import { sendPushToOrg } from '@/lib/push-notifications';

export const maxDuration = 300; // 5 minutes max
export const dynamic = 'force-dynamic'; // Prevent caching

export async function GET(request) {
  try {
    // 1. Verify cron secret to prevent unauthorized execution
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}` && process.env.NODE_ENV === 'production') {
      return new Response('Unauthorized', { status: 401 });
    }

    // 2. Find tasks due in the next hour that are still pending
    const now = new Date();
    const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000);
    
    const { data: dueTasks, error } = await supabaseAdmin
      .from('tasks')
      .select('*, organizations(id, name)')
      .eq('status', 'pending')
      .gte('due_date', now.toISOString())
      .lte('due_date', oneHourFromNow.toISOString());

    if (error) throw error;
    
    if (!dueTasks || dueTasks.length === 0) {
      return Response.json({ success: true, message: 'No tasks due in the next hour.' });
    }

    // 3. Group by organization to send push notifications
    const tasksByOrg = {};
    for (const task of dueTasks) {
      if (!tasksByOrg[task.organization_id]) {
        tasksByOrg[task.organization_id] = [];
      }
      tasksByOrg[task.organization_id].push(task);
    }

    for (const orgId of Object.keys(tasksByOrg)) {
      const orgTasks = tasksByOrg[orgId];
      for (const task of orgTasks) {
        const payload = {
          title: 'Reminder: ' + task.title,
          body: `Due at ${new Date(task.due_date).toLocaleTimeString([], { timeStyle: 'short' })}${task.phone_number ? ' for ' + task.phone_number : ''}`,
          url: '/dashboard',
          tag: 'task-reminder-' + task.id
        };
        await sendPushToOrg(orgId, payload);
      }
    }

    return Response.json({ success: true, sent: dueTasks.length });
  } catch (err) {
    console.error('Cron reminders error:', err);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
