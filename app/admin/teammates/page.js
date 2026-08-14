'use client';
import { useState, useEffect } from 'react';

// Admin org ID — the one org in the DB used for admin-owned resources
const ADMIN_ORG_ID = '8a564ec4-9544-4b63-ac58-98ec66d69a76';

export default function AdminTeammates() {
  const [teammates, setTeammates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const initial = { name: '', email: '', cell_phone: '', role: '' };
  const [form, setForm] = useState(initial);

  const token = typeof window !== 'undefined' ? localStorage.getItem('admin_token') : '';

  useEffect(() => { fetchTeammates(); }, []);

  async function fetchTeammates() {
    setLoading(true);
    const res = await fetch(`/api/admin/teammates?org_id=${ADMIN_ORG_ID}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await res.json();
    setTeammates(data.teammates || []);
    setLoading(false);
  }

  function startEditing(tm) {
    setEditingId(tm.id);
    setForm({ name: tm.name || '', email: tm.email || '', cell_phone: tm.cell_phone || '', role: tm.role || '' });
    setShowModal(true);
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    try {
      if (editingId) {
        // For edit, update directly (agents table doesn't have a PUT via our new route, use supabase in a real scenario)
        // For MVP, delete + re-insert is simpler
        await fetch('/api/admin/teammates', { method: 'DELETE', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ id: editingId }) });
      }
      const res = await fetch('/api/admin/teammates', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, org_id: ADMIN_ORG_ID })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      await fetchTeammates();
      setShowModal(false);
      setEditingId(null);
      setForm(initial);
    } catch (err) {
      alert('Failed to save: ' + err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id) {
    if (!confirm('Remove this teammate?')) return;
    await fetch('/api/admin/teammates', { method: 'DELETE', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
    setTeammates(teammates.filter(t => t.id !== id));
  }

  const roleColors = { 'Teammate': 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20', 'Manager': 'bg-amber-500/10 text-amber-400 border-amber-500/20', 'Sales': 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20', 'Support': 'bg-blue-500/10 text-blue-400 border-blue-500/20' };

  return (
    <div className="animate-in fade-in duration-500">
      <header className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white">Teammates</h1>
          <p className="text-slate-400 mt-1">Manage your internal admin team members.</p>
        </div>
        <button
          onClick={() => { setEditingId(null); setForm(initial); setShowModal(true); }}
          className="bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2.5 rounded-lg font-medium shadow-[0_0_15px_rgba(79,70,229,0.3)] transition-all"
        >
          + Add Teammate
        </button>
      </header>

      <div className="glass-card rounded-2xl overflow-hidden shadow-2xl">
        {loading ? (
          <div className="p-8 text-center text-slate-400">Loading teammates...</div>
        ) : teammates.length === 0 ? (
          <div className="p-12 text-center">
            <div className="text-4xl mb-4">👥</div>
            <h3 className="text-lg font-medium text-white mb-2">No teammates yet</h3>
            <p className="text-slate-400">Add your team members to route calls and manage access.</p>
          </div>
        ) : (
          <table className="w-full text-left">
            <thead className="bg-slate-900/40 border-b border-white/10">
              <tr>
                <th className="px-6 py-4 text-sm font-semibold text-slate-300">Name</th>
                <th className="px-6 py-4 text-sm font-semibold text-slate-300">Role</th>
                <th className="px-6 py-4 text-sm font-semibold text-slate-300">Email</th>
                <th className="px-6 py-4 text-sm font-semibold text-slate-300">Cell Phone</th>
                <th className="px-6 py-4 text-sm font-semibold text-slate-300 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {teammates.map((tm) => (
                <tr key={tm.id} className="hover:bg-white/5 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-indigo-500/20 flex items-center justify-center text-sm font-bold text-indigo-400 shrink-0">
                        {(tm.name || '?')[0].toUpperCase()}
                      </div>
                      <span className="font-medium text-white">{tm.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium border ${roleColors[tm.role] || roleColors['Teammate']}`}>
                      {tm.role || 'Teammate'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-slate-400">{tm.email || '—'}</td>
                  <td className="px-6 py-4 text-slate-300 font-mono text-sm">{tm.cell_phone || '—'}</td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-3">
                      <button onClick={() => startEditing(tm)} className="text-slate-400 hover:text-white transition-colors" title="Edit">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M12.146.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1 0 .708l-10 10a.5.5 0 0 1-.168.11l-5 2a.5.5 0 0 1-.65-.65l2-5a.5.5 0 0 1 .11-.168l10-10zM11.207 2.5 13.5 4.793 14.793 3.5 12.5 1.207 11.207 2.5zm1.586 3L10.5 3.207 4 9.707V10h.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.5h.293l6.5-6.5zm-9.761 5.175-.106.106-1.528 3.821 3.821-1.528.106-.106A.5.5 0 0 1 5 12.5V12h-.5a.5.5 0 0 1-.5-.5V11h-.5a.5.5 0 0 1-.468-.325z"/></svg>
                      </button>
                      <button onClick={() => handleDelete(tm.id)} className="text-slate-500 hover:text-red-400 transition-colors" title="Remove">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/><path fillRule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/></svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 w-full max-w-md rounded-2xl p-8 shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-white">{editingId ? 'Edit Teammate' : 'Add New Teammate'}</h2>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Full Name</label>
                <input type="text" required className="w-full bg-slate-950/50 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Role</label>
                <select className="w-full bg-slate-950/50 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500" value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}>
                  <option value="Teammate">Teammate</option>
                  <option value="Manager">Manager</option>
                  <option value="Sales">Sales</option>
                  <option value="Support">Support</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Email</label>
                <input type="email" placeholder="teammate@primerealops.com" className="w-full bg-slate-950/50 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Cell Phone</label>
                <input type="tel" placeholder="+12125551234" className="w-full bg-slate-950/50 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500" value={form.cell_phone} onChange={e => setForm({ ...form, cell_phone: e.target.value })} />
              </div>
              <div className="pt-4 flex justify-end gap-3">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 rounded-lg text-slate-300 hover:bg-white/5 font-medium transition-colors">Cancel</button>
                <button type="submit" disabled={saving} className="bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2 rounded-lg font-medium transition-colors disabled:opacity-50">{saving ? 'Saving...' : 'Save Teammate'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
