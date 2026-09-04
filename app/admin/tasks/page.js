'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import EditTaskModal from '@/app/dashboard/components/EditTaskModal';

export default function AdminTasksPage() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('pending');
  const [editingTask, setEditingTask] = useState(null);

  useEffect(() => {
    fetchTasks(filter);
  }, [filter]);

  async function fetchTasks(status) {
    setLoading(true);
    const token = localStorage.getItem('admin_token');
    
    // Fallback to directly fetching from supabase if no specific admin route exists
    // The tasks table allows reading via RLS, but for admin, it's safer to use an API if RLS blocks.
    // Wait, the stats API fetches pending tasks. Let's just use the supabase client directly 
    // Wait, admin does not have a session. So we should create a quick API or fetch through an existing one.
    // We will just create an API route below for this.
    try {
      const res = await fetch(`/api/admin/tasks?status=${status}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setTasks(data.tasks || []);
      }
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  }

  async function handleDelete(taskId) {
    const token = localStorage.getItem('admin_token');
    await fetch(`/api/admin/tasks/${taskId}`, { 
      method: 'PATCH', 
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_deleted: true, deleted_at: new Date().toISOString() })
    });
    
    const toastEl = document.createElement('div');
    toastEl.className = 'fixed bottom-10 left-1/2 -translate-x-1/2 flex items-center gap-3 px-5 py-3.5 rounded-full shadow-2xl border z-[9999] animate-in fade-in slide-in-from-bottom-5 bg-emerald-500/90 border-emerald-500/20 text-white backdrop-blur-md font-semibold text-sm whitespace-nowrap';
    toastEl.innerText = 'Task moved to trash';
    document.body.appendChild(toastEl);
    setTimeout(() => { toastEl.remove(); }, 3000);

    setTasks(tasks.filter(t => t.id !== taskId));
  }

  async function handleComplete(taskId) {
    const token = localStorage.getItem('admin_token');
    await fetch(`/api/admin/tasks/${taskId}`, { 
      method: 'PATCH', 
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'completed' })
    });
    
    const toastEl = document.createElement('div');
    toastEl.className = 'fixed bottom-10 left-1/2 -translate-x-1/2 flex items-center gap-3 px-5 py-3.5 rounded-full shadow-2xl border z-[9999] animate-in fade-in slide-in-from-bottom-5 bg-indigo-500/90 border-indigo-500/20 text-white backdrop-blur-md font-semibold text-sm whitespace-nowrap';
    toastEl.innerText = 'Task marked as completed';
    document.body.appendChild(toastEl);
    setTimeout(() => { toastEl.remove(); }, 3000);

    if (filter === 'pending') {
      setTasks(tasks.filter(t => t.id !== taskId));
    } else {
      fetchTasks(filter);
    }
  }

  return (
    <div className="animate-in fade-in duration-500">
      <header className="mb-8 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-white">Admin Follow-ups & Tasks</h1>
          <p className="text-slate-400 mt-1">Manage all your admin scheduled follow-ups and reminders.</p>
        </div>
      </header>

      <div className="flex gap-2 mb-6">
        {['pending', 'completed', 'all'].map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === f
                ? 'bg-indigo-600 text-white'
                : 'bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white'
            }`}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-slate-400">Loading tasks...</div>
      ) : tasks.length === 0 ? (
        <div className="glass-card rounded-2xl p-12 text-center">
          <p className="text-slate-400">No {filter !== 'all' ? filter : ''} tasks found.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {tasks.map(task => {
            const isOverdue = task.status === 'pending' && new Date(task.due_date) < new Date();
            return (
              <div key={task.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-slate-900/50 border border-white/5 rounded-xl hover:border-white/10 transition-colors gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className={`font-medium ${task.status === 'completed' ? 'text-slate-500 line-through' : 'text-white'}`}>{task.title}</h3>
                    {task.disposition && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold tracking-wide uppercase bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                        {task.disposition}
                      </span>
                    )}
                    {task.status === 'completed' && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold tracking-wide uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">Done</span>
                    )}
                  </div>
                  {task.description && (
                    <p className="text-sm text-slate-400 mt-1 line-clamp-2 italic">&quot;{task.description}&quot;</p>
                  )}
                  <div className="flex items-center gap-3 mt-2 text-sm">
                    <span className={isOverdue ? 'text-red-400 font-medium' : 'text-slate-400'}>
                      {new Date(task.due_date).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                    </span>
                    {task.phone_number && (
                      <>
                        <span className="text-slate-600">&bull;</span>
                        <span className="text-slate-400 font-mono">{task.phone_number}</span>
                      </>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 sm:self-start">
                  <button onClick={() => setEditingTask(task)} className="w-8 h-8 rounded-lg bg-slate-800 text-slate-400 flex items-center justify-center hover:bg-slate-700 hover:text-white transition-colors" title="Edit">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 16 16"><path d="M12.146.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1 0 .708l-10 10a.5.5 0 0 1-.168.11l-5 2a.5.5 0 0 1-.65-.65l2-5a.5.5 0 0 1 .11-.168l10-10zM11.207 2.5 13.5 4.793 14.793 3.5 12.5 1.207 11.207 2.5zm1.586 3L10.5 3.207 4 9.707V10h.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.5h.293l6.5-6.5zm-9.761 5.175-.106.106-1.528 3.821 3.821-1.528.106-.106A.5.5 0 0 1 5 12.5V12h-.5a.5.5 0 0 1-.5-.5V11h-.5a.5.5 0 0 1-.468-.325z"/></svg>
                  </button>
                  <button onClick={() => handleDelete(task.id)} className="w-8 h-8 rounded-lg bg-red-500/10 text-red-400 flex items-center justify-center hover:bg-red-500/20 transition-colors" title="Delete">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 16 16"><path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/><path fillRule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/></svg>
                  </button>
                  {task.phone_number && (
                    <Link href={`/admin/dialer?phone=${encodeURIComponent(task.phone_number)}`} className="w-10 h-10 ml-2 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center hover:bg-emerald-500/20 transition-colors" title="Call Now">
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M3.654 1.328a.678.678 0 0 0-1.015-.063L1.605 2.3c-.483.484-.661 1.169-.45 1.77a17.568 17.568 0 0 0 4.168 6.608 17.569 17.569 0 0 0 6.608 4.168c.601.211 1.286.033 1.77-.45l1.034-1.034a.678.678 0 0 0-.063-1.015l-2.307-1.794a.678.678 0 0 0-.58-.122l-2.19.547a1.745 1.745 0 0 1-1.657-.459L5.482 8.062a1.745 1.745 0 0 1-.46-1.657l.548-2.19a.678.678 0 0 0-.122-.58L3.654 1.328z"/></svg>
                    </Link>
                  )}
                  {task.status === 'pending' && (
                    <button onClick={() => handleComplete(task.id)} className="w-10 h-10 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center hover:bg-indigo-500/20 transition-colors" title="Mark as Done">
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M10.97 4.97a.75.75 0 0 1 1.07 1.05l-3.99 4.99a.75.75 0 0 1-1.08.02L4.324 8.384a.75.75 0 1 1 1.06-1.06l2.094 2.093 3.473-4.425a.267.267 0 0 1 .02-.022z"/></svg>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <EditTaskModal
        isOpen={!!editingTask}
        onClose={() => { setEditingTask(null); fetchTasks(filter); }}
        task={editingTask}
      />
    </div>
  );
}
