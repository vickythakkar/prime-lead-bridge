'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export default function LeadsDirectory() {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchLeads() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      
      const { data: agentData } = await supabase.from('agents').select('organization_id').limit(1).single();
      if (agentData) {
        const { data, error } = await supabase
          .from('leads')
          .select('*, properties(address)')
          .eq('organization_id', agentData.organization_id)
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
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
