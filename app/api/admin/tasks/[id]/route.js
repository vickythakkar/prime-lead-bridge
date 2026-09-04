import { supabaseAdmin } from '@/lib/supabase-admin';
import { verifyAdminToken } from '@/lib/admin-auth';

export async function PATCH(request, { params }) {
  try {
    const admin = verifyAdminToken(request);
    if (!admin) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const updates = await request.json();
    const { id } = await params;

    const { error } = await supabaseAdmin.from('tasks').update(updates).eq('id', id);
    if (error) throw error;

    return Response.json({ success: true });
  } catch (err) {
    console.error('Update task error:', err);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const admin = verifyAdminToken(request);
    if (!admin) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const { error } = await supabaseAdmin
      .from('tasks')
      .update({ is_deleted: true, deleted_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;

    return Response.json({ success: true });
  } catch (err) {
    console.error('Delete task error:', err);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
