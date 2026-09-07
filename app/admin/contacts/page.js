'use client';
import { useState, useEffect } from 'react';

const ADMIN_ORG_ID = '8a564ec4-9544-4b63-ac58-98ec66d69a76';

export default function AdminContacts() {
  const [contacts, setContacts] = useState([]);
  const [orgs, setOrgs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterRole, setFilterRole] = useState('');
  const [selectedOrg, setSelectedOrg] = useState(ADMIN_ORG_ID);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const initial = { name: '', phone: '', email: '', company: '', notes: '' };
  const [form, setForm] = useState(initial);

  useEffect(() => { fetchOrgs(); }, []);
  useEffect(() => { fetchContacts(); }, [selectedOrg]);

  async function fetchOrgs() {
    const token = localStorage.getItem('admin_token');
    const res = await fetch('/api/admin/organizations?include_admin=true', { headers: { Authorization: `Bearer ${token}` } });
    if (res.ok) {
      const data = await res.json();
      setOrgs(data.organizations || []);
    }
  }

  async function fetchContacts() {
    setLoading(true);
    const token = localStorage.getItem('admin_token');
    const url = selectedOrg ? `/api/admin/contacts?org_id=${selectedOrg}` : '/api/admin/contacts';
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (res.ok) {
      const data = await res.json();
      setContacts(data.contacts || []);
    }
    setLoading(false);
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    const token = localStorage.getItem('admin_token');
    try {
      const method = editingId ? 'PATCH' : 'POST';
      const body = editingId ? { ...form, id: editingId } : { ...form, org_id: ADMIN_ORG_ID };
      const res = await fetch('/api/admin/contacts', {
        method,
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      await fetchContacts();
      setShowModal(false);
      setEditingId(null);
      setForm(initial);
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id) {
    if (!confirm('Delete this contact?')) return;
    const token = localStorage.getItem('admin_token');
    await fetch('/api/admin/contacts', { method: 'DELETE', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
    setContacts(contacts.filter(c => c.id !== id));
  }

  function startEdit(c) {
    setEditingId(c.id);
    setForm({ name: c.name || '', phone: c.phone || '', email: c.email || '', company: c.company || '', notes: c.notes || '' });
    setShowModal(true);
  }

  const roleColors = { 'Agent': 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20', 'Teammate': 'bg-purple-500/10 text-purple-400 border-purple-500/20', 'Seller': 'bg-amber-500/10 text-amber-400 border-amber-500/20' };

  const filtered = contacts.filter(c => {
    const role = c.custom_fields?.role || '';
    const matchRole = !filterRole || role === filterRole;
    const matchSearch = !search || (c.name || '').toLowerCase().includes(search.toLowerCase()) || (c.phone || '').includes(search) || (c.email || '').toLowerCase().includes(search.toLowerCase());
    return matchRole && matchSearch;
  });

  return (
    <div className="animate-in fade-in duration-500">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white">Contacts</h1>
          <p className="text-slate-400 mt-1">Admin contact directory and CRM.</p>
        </div>
        <button
          onClick={() => { setEditingId(null); setForm(initial); setShowModal(true); }}
          className="bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2.5 rounded-lg font-medium shadow-[0_0_15px_rgba(79,70,229,0.3)] transition-all self-start sm:self-auto"
        >
          + Add Contact
        </button>
      </header>

      <div className="flex flex-wrap gap-3 mb-6">
        <input type="text" placeholder="Search contacts..." value={search} onChange={e => setSearch(e.target.value)}
          className="flex-1 min-w-[200px] max-w-xs bg-slate-900/50 border border-slate-700 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-indigo-500" />
        <select value={selectedOrg} onChange={e => setSelectedOrg(e.target.value)}
          className="bg-slate-900/50 border border-slate-700 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-indigo-500">
          <option value={ADMIN_ORG_ID}>Admin Contacts</option>
          {orgs.filter(o => o.id !== ADMIN_ORG_ID).map(o => (
            <option key={o.id} value={o.id}>{o.company_name || o.name}</option>
          ))}
          <option value="">All Organizations</option>
        </select>
        <select value={filterRole} onChange={e => setFilterRole(e.target.value)}
          className="bg-slate-900/50 border border-slate-700 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-indigo-500">
          <option value="">All Tags</option>
          <option value="Teammate">Teammates</option>
          <option value="Agent">Agents</option>
          <option value="Seller">Sellers</option>
          <option value="Buyer">Buyers</option>
        </select>
      </div>

      <div className="glass-card rounded-2xl overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-400">Loading contacts...</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <div className="text-4xl mb-4">📋</div>
            <h3 className="text-lg font-medium text-white mb-2">No contacts found</h3>
            <p className="text-slate-400">Add contacts manually or they'll sync automatically when teammates are added.</p>
          </div>
        ) : (
          <table className="w-full text-left">
            <thead className="bg-slate-900/40 border-b border-white/10">
              <tr>
                <th className="px-6 py-4 text-sm font-semibold text-slate-300">Name</th>
                <th className="px-6 py-4 text-sm font-semibold text-slate-300">Organization</th>
                <th className="px-6 py-4 text-sm font-semibold text-slate-300">Tag</th>
                <th className="px-6 py-4 text-sm font-semibold text-slate-300">Phone</th>
                <th className="px-6 py-4 text-sm font-semibold text-slate-300">Email</th>
                <th className="px-6 py-4 text-sm font-semibold text-slate-300 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filtered.map(c => {
                const role = c.custom_fields?.role;
                return (
                  <tr key={c.id} className="hover:bg-white/5 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0" style={{ backgroundColor: (c.avatar_color || '#4f46e5') + '33', color: c.avatar_color || '#818cf8' }}>
                          {(c.name || '?')[0].toUpperCase()}
                        </div>
                        <span className="font-medium text-white">{c.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {role ? (
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium border ${roleColors[role] || 'bg-slate-500/10 text-slate-400 border-slate-500/20'}`}>{role}</span>
                      ) : <span className="text-slate-600 text-xs">—</span>}
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm font-medium text-slate-300 bg-white/5 px-2.5 py-1 rounded-lg border border-white/10">
                        {c.organization_name || 'Admin Platform'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-300 font-mono text-sm">{c.phone || '—'}</td>
                    <td className="px-6 py-4 text-slate-400 text-sm">{c.email || '—'}</td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-3 items-center">
                        {c.phone && (
                          <button onClick={() => window.location.href = `/admin/dialer?phone=${encodeURIComponent(c.phone)}&name=${encodeURIComponent(c.name)}`} className="text-slate-500 hover:text-green-400 transition-colors" title="Call">
                            <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" fill="currentColor" viewBox="0 0 16 16"><path fillRule="evenodd" d="M1.885.511a1.745 1.745 0 0 1 2.61.163L6.29 2.98c.329.423.445.974.315 1.494l-.547 2.19a.678.678 0 0 0 .178.643l2.457 2.457a.678.678 0 0 0 .644.178l2.189-.547a1.745 1.745 0 0 1 1.494.315l2.306 1.794c.829.645.905 1.87.163 2.611l-1.034 1.034c-.74.74-1.846 1.065-2.877.702a18.634 18.634 0 0 1-7.01-4.42 18.634 18.634 0 0 1-4.42-7.009c-.362-1.03-.037-2.137.703-2.877L1.885.511z"/></svg>
                          </button>
                        )}
                        <button onClick={() => startEdit(c)} className="text-slate-400 hover:text-white transition-colors" title="Edit">
                          <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" fill="currentColor" viewBox="0 0 16 16"><path d="M12.146.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1 0 .708l-10 10a.5.5 0 0 1-.168.11l-5 2a.5.5 0 0 1-.65-.65l2-5a.5.5 0 0 1 .11-.168l10-10zM11.207 2.5 13.5 4.793 14.793 3.5 12.5 1.207 11.207 2.5zm1.586 3L10.5 3.207 4 9.707V10h.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.5h.293l6.5-6.5zm-9.761 5.175-.106.106-1.528 3.821 3.821-1.528.106-.106A.5.5 0 0 1 5 12.5V12h-.5a.5.5 0 0 1-.5-.5V11h-.5a.5.5 0 0 1-.468-.325z"/></svg>
                        </button>
                        <button onClick={() => handleDelete(c.id)} className="text-slate-500 hover:text-red-400 transition-colors" title="Delete">
                          <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" fill="currentColor" viewBox="0 0 16 16"><path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/><path fillRule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/></svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 w-full max-w-md rounded-2xl p-8 shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-white">{editingId ? 'Edit Contact' : 'New Contact'}</h2>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>
            <form onSubmit={handleSave} className="space-y-4">
              {[['Name', 'name', 'text', true], ['Phone', 'phone', 'tel', false], ['Email', 'email', 'email', false], ['Company', 'company', 'text', false]].map(([label, key, type, req]) => (
                <div key={key}>
                  <label className="block text-sm font-medium text-slate-300 mb-1">{label}</label>
                  <input type={type} required={req} multiple={type === 'email'} className="w-full bg-slate-950/50 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500" value={form[key]} onChange={e => setForm({ ...form, [key]: e.target.value })} />
                </div>
              ))}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Notes</label>
                <textarea rows={2} className="w-full bg-slate-950/50 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500 resize-none" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
              </div>
              <div className="pt-4 flex justify-end gap-3">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 rounded-lg text-slate-300 hover:bg-white/5 font-medium transition-colors">Cancel</button>
                <button type="submit" disabled={saving} className="bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2 rounded-lg font-medium transition-colors disabled:opacity-50">{saving ? 'Saving...' : 'Save Contact'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
