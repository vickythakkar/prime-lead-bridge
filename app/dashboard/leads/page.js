'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export default function LeadsDirectory() {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);

  const deleteLead = async (id) => {
    if (!confirm('Send this lead to the trash?')) return;
    const { error } = await supabase.from('leads').update({ is_deleted: true }).eq('id', id);
    if (!error) {
      setLeads(leads.filter(l => l.id !== id));
    }
  };

  useEffect(() => {
    async function fetchLeads() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      
      const { data: agentData } = await supabase.from('agents').select('organization_id').eq('id', session.user.id).single();
      if (agentData) {
        const { data, error } = await supabase
          .from('leads')
          .select('*, properties(address)')
          .eq('organization_id', agentData.organization_id)
          .eq('is_deleted', false)
          .order('created_at', { ascending: false });
          
        if (!error && data) {
          setLeads(data);
        }
      }
      setLoading(false);
    }
    fetchLeads();
  }, []);

  return (
    <div className="animate-in fade-in duration-500">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-white">Leads Pipeline</h1>
        <p className="text-slate-400 mt-1">Buyers who inquired about your properties.</p>
      </header>

      <div className="glass-card rounded-2xl overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-400">Loading leads...</div>
        ) : leads.length === 0 ? (
          <div className="p-12 text-center">
            <div className="text-4xl mb-4">🎯</div>
            <h3 className="text-lg font-medium text-white mb-2">No leads captured yet</h3>
            <p className="text-slate-400">When callers inquire about your properties, they will appear here.</p>
          </div>
        ) : (
          <table className="w-full text-left">
            <thead className="bg-white/5 border-b border-white/10">
              <tr>
                <th className="px-6 py-4 text-sm font-semibold text-slate-300">Caller Phone</th>
                <th className="px-6 py-4 text-sm font-semibold text-slate-300">Property Inquired</th>
                <th className="px-6 py-4 text-sm font-semibold text-slate-300">Date/Time</th>
                <th className="px-6 py-4 text-sm font-semibold text-slate-300">Status</th>
                <th className="px-6 py-4 text-right text-sm font-semibold text-slate-300">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {leads.map((lead) => (
                <tr key={lead.id} className="hover:bg-white/5 transition-colors">
                  <td className="px-6 py-4 font-medium text-white">{lead.caller_phone}</td>
                  <td className="px-6 py-4 text-slate-300">{lead.properties?.address || 'Unknown'}</td>
                  <td className="px-6 py-4 text-slate-400 text-sm">
                    {new Date(lead.created_at).toLocaleString()}
                  </td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      {lead.status || 'New'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button 
                      onClick={() => deleteLead(lead.id)} 
                      className="text-slate-500 hover:text-rose-400 transition-colors"
                      title="Send to Trash"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/><path fillRule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/></svg>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
