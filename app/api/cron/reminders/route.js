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

    // 4. Run the Trash Auto-Purge
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const tables = ['tasks', 'leads', 'properties', 'contacts', 'conversations'];
    const purgeResults = {};

    for (const table of tables) {
      let { count, error } = await supabaseAdmin
        .from(table)
        .delete({ count: 'exact' })
        .eq('is_deleted', true)
        .lt('deleted_at', thirtyDaysAgo);
      
      if (error && error.message.includes('deleted_at')) {
        // Fallback to updated_at or created_at if deleted_at column doesn't exist
        const res = await supabaseAdmin
          .from(table)
          .delete({ count: 'exact' })
          .eq('is_deleted', true)
          .lt('updated_at', thirtyDaysAgo);
        
        count = res.count;
        error = res.error;
      }

      if (!error) {
        purgeResults[table] = count || 0;
      } else {
        purgeResults[table] = `skipped: ${error.message}`;
      }
    }

    return Response.json({ success: true, sent: dueTasks?.length || 0, purged: purgeResults });
  } catch (err) {
    console.error('Cron reminders error:', err);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
