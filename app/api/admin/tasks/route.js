import { supabaseAdmin } from '@/lib/supabase-admin';
import { verifyAdminToken } from '@/lib/admin-auth';

export async function GET(request) {
  try {
    const admin = verifyAdminToken(request);
    if (!admin) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'all';

    let query = supabaseAdmin
      .from('tasks')
      .select('*')
      .eq('user_type', 'admin')
      .or('is_deleted.is.null,is_deleted.eq.false')
      .order('due_date', { ascending: true });

    if (status !== 'all') {
      query = query.eq('status', status);
    }

    const { data: tasks, error } = await query;
    if (error) throw error;

    return Response.json({ tasks });
  } catch (err) {
    console.error('Fetch tasks error:', err);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
