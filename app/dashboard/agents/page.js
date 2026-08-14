'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export default function AgentsDirectory() {
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);
  
  const initialAgent = { name: '', email: '', cell_phone: '' };
  const [newAgent, setNewAgent] = useState(initialAgent);
  const [orgId, setOrgId] = useState(null);

  const fetchAgents = async (organization_id) => {
    const { data, error } = await supabase
      .from('agents')
      .select('*')
      .eq('organization_id', organization_id)
      .order('created_at', { ascending: false });
      
    if (!error && data) {
      setAgents(data);
    }
    setLoading(false);
  };

  const formatE164 = (num) => {
    if (!num) return '';
    let cleaned = num.replace(/[^\d+]/g, '');
    if (cleaned.startsWith('+')) return cleaned;
    if (cleaned.length === 10) return '+1' + cleaned;
    if (cleaned.length === 11 && cleaned.startsWith('1')) return '+' + cleaned;
    return cleaned;
  };

  useEffect(() => {
    async function loadData() {
      // Get current user's org (for MVP, we just get the first org they are attached to as an agent)
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      
      const { data: agentData } = await supabase
        .from('agents')
        .select('organization_id')
        .limit(1)
        .single();
        
      if (agentData) {
        setOrgId(agentData.organization_id);
        fetchAgents(agentData.organization_id);
      }
    }
    loadData();
  }, []);

  const startEditing = (agent) => {
    setEditingId(agent.id);
    setNewAgent({
      name: agent.name || '',
      email: agent.email || '',
      cell_phone: agent.cell_phone || ''
    });
    setShowModal(true);
  };

  async function handleSaveAgent(e) {
    e.preventDefault();
    if (!orgId) return;
    setSaving(true);

    const payload = {
      organization_id: orgId,
      name: newAgent.name,
      cell_phone: newAgent.cell_phone
    };
    
    // Attempt to add email if the column exists in the database
    if (newAgent.email) {
      payload.email = newAgent.email;
    }

    try {
      if (editingId) {
        const { data, error } = await supabase
          .from('agents')
          .update(payload)
          .eq('id', editingId)
          .select();
          
        if (error) {
          // Fallback if email column doesn't exist yet
          if (error.message.includes('email')) {
            delete payload.email;
            const fallbackRes = await supabase.from('agents').update(payload).eq('id', editingId).select();
            if (!fallbackRes.error) {
              setAgents(agents.map(a => a.id === editingId ? fallbackRes.data[0] : a));
            } else {
              throw fallbackRes.error;
            }
          } else {
            throw error;
          }
        } else {
          setAgents(agents.map(a => a.id === editingId ? data[0] : a));
        }
      } else {
        const { data, error } = await supabase
          .from('agents')
          .insert([payload])
          .select();

        if (error) {
          // Fallback if email column doesn't exist yet
          if (error.message.includes('email')) {
            delete payload.email;
            const fallbackRes = await supabase.from('agents').insert([payload]).select();
            if (!fallbackRes.error) {
              setAgents([...agents, fallbackRes.data[0]]);
            } else {
              throw fallbackRes.error;
            }
          } else {
            throw error;
          }
        } else {
          setAgents([...agents, data[0]]);
        }
      }

      // Upsert to contacts CRM as well
      if (payload.cell_phone) {
        const { data: existingContact } = await supabase
          .from('contacts')
          .select('id')
          .eq('organization_id', orgId)
          .eq('phone', payload.cell_phone)
          .maybeSingle();

        if (existingContact) {
          await supabase.from('contacts').update({
            name: payload.name,
            updated_at: new Date().toISOString(),
            custom_fields: { role: 'Agent' }
          }).eq('id', existingContact.id);
        } else {
          await supabase.from('contacts').insert({
            organization_id: orgId,
            phone: payload.cell_phone,
            name: payload.name,
            custom_fields: { role: 'Agent' }
          });
        }
      }

      setShowModal(false);
      setEditingId(null);
      setNewAgent(initialAgent);
    } catch (err) {
      console.error(err);
      alert('Failed to save agent. Check console for details.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id) {
    if (!confirm('Are you sure you want to remove this agent?')) return;
    await supabase.from('agents').delete().eq('id', id);
    setAgents(agents.filter(a => a.id !== id));
  }

  return (
    <div className="animate-in fade-in duration-500">
      <header className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white">Agents Directory</h1>
          <p className="text-slate-400 mt-1">Manage your team members and call recipients.</p>
        </div>
        <button 
          onClick={() => { setEditingId(null); setNewAgent(initialAgent); setShowModal(true); }}
          className="bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2.5 rounded-lg font-medium shadow-[0_0_15px_rgba(79,70,229,0.3)] transition-all"
        >
          + Add Agent
        </button>
      </header>

      <div className="glass-card rounded-2xl overflow-hidden shadow-2xl">
        {loading ? (
          <div className="p-8 text-center text-slate-400">Loading directory...</div>
        ) : agents.length === 0 ? (
          <div className="p-12 text-center">
            <div className="text-4xl mb-4">👥</div>
            <h3 className="text-lg font-medium text-white mb-2">No agents found</h3>
            <p className="text-slate-400">Add team members so you can route calls to them.</p>
          </div>
        ) : (
          <table className="w-full text-left">
            <thead className="bg-slate-900/40 border-b border-white/10">
              <tr>
                <th className="px-6 py-4 text-sm font-semibold text-slate-300">Name</th>
                <th className="px-6 py-4 text-sm font-semibold text-slate-300">Email</th>
                <th className="px-6 py-4 text-sm font-semibold text-slate-300">Cell Phone</th>
                <th className="px-6 py-4 text-sm font-semibold text-slate-300 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {agents.map((agent) => (
                <tr key={agent.id} className="hover:bg-white/5 transition-colors">
                  <td className="px-6 py-4 font-medium text-white">{agent.name}</td>
                  <td className="px-6 py-4 text-slate-400">{agent.email || 'N/A'}</td>
                  <td className="px-6 py-4 text-slate-300 font-mono text-sm">{agent.cell_phone}</td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-3">
                      <button 
                        onClick={() => startEditing(agent)}
                        className="text-slate-400 hover:text-white transition-colors"
                        title="Edit"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M12.146.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1 0 .708l-10 10a.5.5 0 0 1-.168.11l-5 2a.5.5 0 0 1-.65-.65l2-5a.5.5 0 0 1 .11-.168l10-10zM11.207 2.5 13.5 4.793 14.793 3.5 12.5 1.207 11.207 2.5zm1.586 3L10.5 3.207 4 9.707V10h.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.5h.293l6.5-6.5zm-9.761 5.175-.106.106-1.528 3.821 3.821-1.528.106-.106A.5.5 0 0 1 5 12.5V12h-.5a.5.5 0 0 1-.5-.5V11h-.5a.5.5 0 0 1-.468-.325z"/></svg>
                      </button>
                      <button 
                        onClick={() => handleDelete(agent.id)}
                        className="text-slate-500 hover:text-red-400 transition-colors"
                        title="Remove"
                      >
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

      {/* Add/Edit Agent Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 w-full max-w-md rounded-2xl p-8 shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-white">{editingId ? 'Edit Agent' : 'Add New Agent'}</h2>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>
            
            <form onSubmit={handleSaveAgent} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Agent Name</label>
                <input 
                  type="text" required
                  className="w-full bg-slate-950/50 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500"
                  value={newAgent.name} onChange={(e) => setNewAgent({...newAgent, name: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Email Address</label>
                <input 
                  type="email" placeholder="agent@example.com"
                  className="w-full bg-slate-950/50 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500"
                  value={newAgent.email} onChange={(e) => setNewAgent({...newAgent, email: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Cell Phone (for call routing)</label>
                <input 
                  type="tel" required placeholder="+1234567890"
                  className="w-full bg-slate-950/50 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500"
                  value={newAgent.cell_phone} onChange={(e) => setNewAgent({...newAgent, cell_phone: e.target.value})}
                />
              </div>
              
              <div className="pt-4 flex justify-end gap-3">
                <button 
                  type="button" 
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-lg text-slate-300 hover:bg-white/5 font-medium transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit" disabled={saving}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2 rounded-lg font-medium transition-colors disabled:opacity-50"
                >
                  {saving ? 'Saving...' : 'Save Agent'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
