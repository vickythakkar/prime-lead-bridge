'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';

export default function ContactsPage() {
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({ name: '', phone: '' });
  const [saving, setSaving] = useState(false);
  
  const [orgId, setOrgId] = useState(null);

  useEffect(() => {
    async function loadData() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      
      const { data: agentData } = await supabase
        .from('agents')
        .select('organization_id')
        .limit(1)
        .single();
        
      if (agentData) {
        setOrgId(agentData.organization_id);
        
        const { data } = await supabase
          .from('contacts')
          .select('*')
          .eq('organization_id', agentData.organization_id)
          .order('updated_at', { ascending: false });
          
        if (data) setContacts(data);
      }
      setLoading(false);
    }
    loadData();
  }, []);

  const startEditing = (contact) => {
    setEditingId(contact.id);
    setFormData({ name: contact.name || '', phone: contact.phone || '' });
    setShowModal(true);
  };

  const saveContact = async (e) => {
    e.preventDefault();
    setSaving(true);
    
    if (editingId) {
      const { data, error } = await supabase
        .from('contacts')
        .update({ name: formData.name, phone: formData.phone, updated_at: new Date().toISOString() })
        .eq('id', editingId)
        .select();
        
      if (!error && data) {
        setContacts(contacts.map(c => c.id === editingId ? data[0] : c));
        setShowModal(false);
      } else {
        alert('Failed to update contact.');
      }
    } else {
      const { data, error } = await supabase
        .from('contacts')
        .insert([{ organization_id: orgId, name: formData.name, phone: formData.phone }])
        .select();
        
      if (!error && data) {
        setContacts([data[0], ...contacts]);
        setShowModal(false);
      } else {
        alert('Failed to add contact.');
      }
    }
    setSaving(false);
  };

  return (
    <div className="animate-in fade-in duration-500 max-w-7xl mx-auto">
      <header className="mb-8 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-white">Contacts CRM</h1>
          <p className="text-slate-400 mt-1">Manage leads, sellers, and agents.</p>
        </div>
        <button 
          onClick={() => { setEditingId(null); setFormData({name: '', phone: ''}); setShowModal(true); }}
          className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-2.5 rounded-xl font-medium transition-colors shadow-lg"
        >
          + Add Contact
        </button>
      </header>

      <div className="glass-card rounded-2xl overflow-hidden shadow-2xl">
        {loading ? (
          <div className="p-8 text-center text-slate-400">Loading contacts...</div>
        ) : contacts.length === 0 ? (
          <div className="p-12 text-center flex flex-col items-center">
            <div className="bg-white/5 w-16 h-16 rounded-full flex items-center justify-center mb-4">
              <span className="text-2xl">👥</span>
            </div>
            <h3 className="text-lg font-bold text-white mb-2">No Contacts Yet</h3>
            <p className="text-slate-400 text-sm">When someone calls or is added as a seller, they will appear here automatically.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-900/40 border-b border-white/10">
                <tr>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Name</th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Phone Number</th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Last Updated</th>
                  <th className="px-6 py-4 text-right text-xs font-semibold text-slate-400 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {contacts.map((contact) => (
                  <tr key={contact.id} className="hover:bg-white/5 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-indigo-500/20 border border-indigo-500/30 text-indigo-400 flex items-center justify-center font-bold">
                          {(contact.name || contact.phone || '?').charAt(0).toUpperCase()}
                        </div>
                        <div className="font-medium text-white">{contact.name || 'Unknown Contact'}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-300 font-mono text-sm">{contact.phone}</td>
                    <td className="px-6 py-4 text-slate-400 text-sm">
                      {new Date(contact.updated_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-3 items-center">
                        <a 
                          href={`/dashboard/messages?phone=${encodeURIComponent(contact.phone)}`} 
                          className="bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 hover:bg-indigo-500/20 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
                        >
                          Message
                        </a>
                        <a 
                          href={`/dashboard/dialer?phone=${encodeURIComponent(contact.phone)}`} 
                          className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
                        >
                          Call
                        </a>
                        <button 
                          onClick={() => startEditing(contact)} 
                          className="text-slate-400 hover:text-white transition-colors ml-2"
                          title="Edit"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="currentColor" viewBox="0 0 16 16"><path d="M12.146.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1 0 .708l-10 10a.5.5 0 0 1-.168.11l-5 2a.5.5 0 0 1-.65-.65l2-5a.5.5 0 0 1 .11-.168l10-10zM11.207 2.5 13.5 4.793 14.793 3.5 12.5 1.207 11.207 2.5zm1.586 3L10.5 3.207 4 9.707V10h.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.5h.293l6.5-6.5zm-9.761 5.175-.106.106-1.528 3.821 3.821-1.528.106-.106A.5.5 0 0 1 5 12.5V12h-.5a.5.5 0 0 1-.5-.5V11h-.5a.5.5 0 0 1-.468-.325z"/></svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-8 max-w-md w-full shadow-2xl">
            <h2 className="text-2xl font-bold text-white mb-6">{editingId ? 'Edit Contact' : 'Add Contact'}</h2>
            <form onSubmit={saveContact} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Name</label>
                <input 
                  type="text" required
                  className="w-full bg-slate-950/50 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500"
                  value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Phone Number</label>
                <input 
                  type="tel" required
                  className="w-full bg-slate-950/50 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500"
                  value={formData.phone} onChange={(e) => setFormData({...formData, phone: e.target.value})}
                />
              </div>
              <div className="pt-6 flex justify-end gap-3">
                <button type="button" onClick={() => setShowModal(false)} className="px-6 py-2.5 rounded-lg font-medium text-slate-400 hover:text-white hover:bg-white/5">
                  Cancel
                </button>
                <button type="submit" disabled={saving} className="bg-indigo-600 hover:bg-indigo-500 text-white px-8 py-2.5 rounded-lg font-bold shadow-lg disabled:opacity-50">
                  {saving ? 'Saving...' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
