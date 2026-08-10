'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export default function AgentsDirectory() {
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [newAgent, setNewAgent] = useState({ name: '', cell_phone: '' });
  const [orgId, setOrgId] = useState(null);

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

  async function fetchAgents(organization_id) {
    const { data, error } = await supabase
      .from('agents')
      .select('*')
      .eq('organization_id', organization_id)
      .order('name');
      
    if (!error && data) {
      setAgents(data);
    }
    setLoading(false);
  }

  async function handleAddAgent(e) {
    e.preventDefault();
    if (!orgId) return;

    const { data, error } = await supabase
      .from('agents')
      .insert([{ 
        organization_id: orgId,
        name: newAgent.name,
        cell_phone: newAgent.cell_phone
      }])
      .select();

    if (!error && data) {
      setAgents([...agents, data[0]]);
      setShowModal(false);
      setNewAgent({ name: '', cell_phone: '' });
    }
  }

  async function handleDelete(id) {
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
          onClick={() => setShowModal(true)}
          className="bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2.5 rounded-lg font-medium shadow-[0_0_15px_rgba(79,70,229,0.3)] transition-all"
        >
          + Add Agent
        </button>
      </header>

      <div className="glass-card rounded-2xl overflow-hidden">
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
            <thead className="bg-white/5 border-b border-white/10">
              <tr>
                <th className="px-6 py-4 text-sm font-semibold text-slate-300">Name</th>
                <th className="px-6 py-4 text-sm font-semibold text-slate-300">Cell Phone</th>
                <th className="px-6 py-4 text-sm font-semibold text-slate-300 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {agents.map((agent) => (
                <tr key={agent.id} className="hover:bg-white/5 transition-colors">
                  <td className="px-6 py-4 font-medium text-white">{agent.name}</td>
                  <td className="px-6 py-4 text-slate-300">{agent.cell_phone}</td>
                  <td className="px-6 py-4 text-right">
                    <button 
                      onClick={() => handleDelete(agent.id)}
                      className="text-red-400 hover:text-red-300 text-sm font-medium"
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Add Agent Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="glass-card w-full max-w-md rounded-2xl p-6 border border-white/10 shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-white">Add New Agent</h2>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>
            
            <form onSubmit={handleAddAgent} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Agent Name</label>
                <input 
                  type="text" required
                  className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500"
                  value={newAgent.name} onChange={(e) => setNewAgent({...newAgent, name: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Cell Phone (for call routing)</label>
                <input 
                  type="tel" required placeholder="+1234567890"
                  className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500"
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
                  type="submit"
                  className="bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2 rounded-lg font-medium transition-colors"
                >
                  Save Agent
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
