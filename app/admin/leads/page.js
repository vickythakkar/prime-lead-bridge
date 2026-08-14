'use client';
import { useState, useEffect } from 'react';

export default function AdminLeads() {
  const [leads, setLeads] = useState([]);
  const [orgs, setOrgs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrg, setSelectedOrg] = useState('');
  const [search, setSearch] = useState('');

  const token = typeof window !== 'undefined' ? localStorage.getItem('admin_token') : '';

  useEffect(() => { fetchOrgs(); }, []);
  useEffect(() => { fetchLeads(); }, [selectedOrg]);

  async function fetchOrgs() {
    const res = await fetch('/api/admin/organizations', { headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json();
    setOrgs(data.organizations || []);
  }

  async function fetchLeads() {
    setLoading(true);
    const url = selectedOrg ? `/api/admin/leads?org_id=${selectedOrg}` : '/api/admin/leads';
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json();
    setLeads(data.leads || []);
    setLoading(false);
  }

  const filtered = leads.filter(l =>
    !search || (l.caller_phone || '').includes(search) || (l.properties?.address || '').toLowerCase().includes(search.toLowerCase())
  );

  const statusColors = { new: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20', contacted: 'bg-blue-500/10 text-blue-400 border-blue-500/20', closed: 'bg-slate-500/10 text-slate-400 border-slate-500/20' };

  return (
    <div className="animate-in fade-in duration-500">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white">Leads</h1>
          <p className="text-slate-400 mt-1">All inbound leads captured via IVR across all organizations.</p>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="text"
            placeholder="Search leads..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="bg-slate-900/50 border border-slate-700 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-indigo-500 w-48"
          />
          <select
            value={selectedOrg}
            onChange={e => setSelectedOrg(e.target.value)}
            className="bg-slate-900/50 border border-slate-700 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-indigo-500"
          >
            <option value="">All Organizations</option>
            {orgs.map(o => <option key={o.id} value={o.id}>{o.company_name || o.name}</option>)}
          </select>
        </div>
      </header>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        {[
          { label: 'Total Leads', value: leads.length, color: 'text-white' },
          { label: 'New', value: leads.filter(l => l.status === 'new' || !l.status).length, color: 'text-emerald-400' },
          { label: 'Contacted', value: leads.filter(l => l.status === 'contacted').length, color: 'text-blue-400' },
        ].map(stat => (
          <div key={stat.label} className="glass-card rounded-xl p-5">
            <p className="text-slate-400 text-sm mb-1">{stat.label}</p>
            <p className={`text-3xl font-bold ${stat.color}`}>{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="glass-card rounded-2xl overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-400">Loading leads...</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <div className="text-4xl mb-4">🎯</div>
            <h3 className="text-lg font-medium text-white mb-2">No leads found</h3>
            <p className="text-slate-400">Leads appear here when callers inquire about properties via the IVR.</p>
          </div>
        ) : (
          <table className="w-full text-left">
            <thead className="bg-white/5 border-b border-white/10">
              <tr>
                <th className="px-6 py-4 text-sm font-semibold text-slate-300">Caller Phone</th>
                <th className="px-6 py-4 text-sm font-semibold text-slate-300">Property Inquired</th>
                <th className="px-6 py-4 text-sm font-semibold text-slate-300">Organization</th>
                <th className="px-6 py-4 text-sm font-semibold text-slate-300">Date/Time</th>
                <th className="px-6 py-4 text-sm font-semibold text-slate-300">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filtered.map(lead => (
                <tr key={lead.id} className="hover:bg-white/5 transition-colors">
                  <td className="px-6 py-4 font-medium text-white font-mono">{lead.caller_phone}</td>
                  <td className="px-6 py-4 text-slate-300">{lead.properties?.address || '—'}</td>
                  <td className="px-6 py-4 text-slate-400 text-sm">{lead.organizations?.company_name || lead.organizations?.name || '—'}</td>
                  <td className="px-6 py-4 text-slate-400 text-sm">{new Date(lead.created_at).toLocaleString()}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium border ${statusColors[lead.status] || statusColors.new}`}>
                      {lead.status || 'new'}
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
