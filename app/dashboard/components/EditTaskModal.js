'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export default function EditTaskModal({ isOpen, onClose, task }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [dueTime, setDueTime] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen && task) {
      setTitle(task.title || '');
      setDescription(task.description || '');
      
      if (task.due_date) {
        const d = new Date(task.due_date);
        setDueDate(d.toISOString().split('T')[0]);
        setDueTime(d.toISOString().split('T')[1].slice(0,5));
      }
    }
  }, [isOpen, task]);

  if (!isOpen || !task) return null;

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    
    try {
      const dueDateTime = new Date(`${dueDate}T${dueTime}`).toISOString();
      const updates = { title, description, due_date: dueDateTime };
      
      // Determine if it's an admin task or broker task
      if (task.user_type === 'admin') {
        const token = localStorage.getItem('admin_token');
        await fetch(`/api/admin/tasks/${task.id}`, {
          method: 'PATCH',
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(updates)
        });
      } else {
        await supabase.from('tasks').update(updates).eq('id', task.id);
      }
      
      window.dispatchEvent(new CustomEvent('tasksUpdated'));
      onClose();
    } catch (err) {
      console.error(err);
      alert('Failed to save');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
      <div className="glass-card bg-slate-900 border border-white/10 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
        <div className="p-6 border-b border-white/5 flex justify-between items-center">
          <h2 className="text-xl font-bold text-white">Edit Follow-up</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white">✕</button>
        </div>
        
        <form onSubmit={handleSave} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Title</label>
            <input type="text" value={title} onChange={e => setTitle(e.target.value)} required className="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-indigo-500" />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Notes</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} rows="3" className="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-indigo-500" />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Date</label>
              <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} required className="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-2 text-white" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Time</label>
              <input type="time" value={dueTime} onChange={e => setDueTime(e.target.value)} required className="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-2 text-white" />
            </div>
          </div>
          
          <div className="pt-4 flex justify-end gap-3">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg font-medium text-slate-300 hover:text-white hover:bg-white/5 transition-colors">Cancel</button>
            <button type="submit" disabled={saving} className="px-6 py-2 rounded-lg font-medium bg-indigo-600 hover:bg-indigo-700 text-white transition-colors disabled:opacity-50">
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
