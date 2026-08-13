'use client';
import { useState, useEffect } from 'react';

export default function BrokersPage() {
  const [brokers, setBrokers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [planFilter, setPlanFilter] = useState('all');

  useEffect(() => {
    async function fetchBrokers() {
      try {
        const token = localStorage.getItem('admin_token');
        const res = await fetch('/api/admin/organizations', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (res.ok) {
          const data = await res.json();
          setBrokers(data.organizations || []);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    fetchBrokers();
  }, []);

  return (
    <div className="animate-in fade-in duration-500">
      <header className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white">Brokers & Organizations</h1>
          <p className="text-indigo-300 mt-1">Manage tenant accounts, usage, and statuses.</p>
        </div>
        <button className="bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2.5 rounded-lg font-medium shadow-[0_0_15px_rgba(79,70,229,0.3)] transition-all">
          + New Organization
        </button>
      </header>

      <div className="glass-card rounded-2xl overflow-hidden border border-white/5">
        <div className="p-4 border-b border-white/5 bg-white/5 flex gap-4">
          <input 
            type="text" 
            placeholder="Search organizations..." 
            className="flex-1 bg-slate-900/60 border border-white/10 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-indigo-500 transition-colors text-sm"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <select 
            className="bg-slate-900/60 border border-white/10 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-indigo-500 transition-colors text-sm"
            value={planFilter}
            onChange={(e) => setPlanFilter(e.target.value)}
          >
            <option value="all">All Plans</option>
            <option value="pro">Pro</option>
            <option value="basic">Basic</option>
          </select>
        </div>

        {loading ? (
          <div className="p-8 text-center text-slate-400">Loading organizations...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left whitespace-nowrap">
              <thead className="bg-[#0a0a0e]/50 border-b border-white/10">
                <tr>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Organization</th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Contact</th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Plan</th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider text-right">Calls (Mtd)</th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider text-right">Mins (Mtd)</th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {brokers
                  .filter(broker => {
                    const matchesSearch = (broker.company_name || broker.name || '').toLowerCase().includes(searchQuery.toLowerCase());
                    const matchesPlan = planFilter === 'all' || (broker.subscription_plan || 'basic') === planFilter;
                    return matchesSearch && matchesPlan;
                  })
                  .map((broker) => (
                  <tr key={broker.id} className="hover:bg-white/5 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-medium text-white">{broker.company_name || broker.name}</div>
                      <div className="text-xs text-slate-500 mt-0.5">Joined {new Date(broker.created_at).toLocaleDateString()}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-slate-300 text-sm">{broker.notify_email || 'No email set'}</div>
                      <div className="text-slate-500 text-xs mt-0.5">{broker.organization_numbers?.[0]?.phone_number || 'No number'}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 rounded-md text-xs font-bold uppercase ${broker.subscription_plan === 'pro' ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30' : 'bg-slate-800 text-slate-400 border border-slate-700'}`}>
                        {broker.subscription_plan || 'basic'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right text-slate-300 font-mono text-sm">{broker.currentMonth?.totalCalls?.toLocaleString() || 0}</td>
                    <td className="px-6 py-4 text-right text-slate-300 font-mono text-sm">{broker.currentMonth?.totalMinutes?.toLocaleString() || 0}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1.5 text-emerald-400 text-sm font-medium`}>
                        <span className={`w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]`}></span>
                        Active
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button className="text-indigo-400 hover:text-indigo-300 text-sm font-medium mr-4">View</button>
                      <button className="text-red-400 hover:text-red-300 text-sm font-medium">
                        Disable
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
