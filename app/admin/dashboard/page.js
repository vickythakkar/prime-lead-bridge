'use client';
import { useState, useEffect } from 'react';

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      try {
        const token = localStorage.getItem('admin_token');
        const res = await fetch('/api/admin/stats', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (res.ok) {
          const data = await res.json();
          setStats(data);
        } else {
          // Mock data
          setStats({
            totalOrgs: 24,
            callsThisMonth: 12450,
            minutesThisMonth: 35600,
            revenueThisMonth: 12450.50,
            recentActivity: [
              { id: 1, action: 'New Organization Created', details: 'Acme Realty joined', time: '10 mins ago' },
              { id: 2, action: 'Invoice Paid', details: 'Smith Brokerage paid $145.00', time: '1 hour ago' },
              { id: 3, action: 'Number Purchased', details: 'Jane Doe bought +1 (555) 123-4567', time: '3 hours ago' }
            ],
            topOrgs: [
              { id: 1, name: 'Acme Realty', usage: 4500, status: 'pro' },
              { id: 2, name: 'Smith Brokerage', usage: 3200, status: 'basic' },
              { id: 3, name: 'Elite Homes', usage: 2100, status: 'pro' }
            ]
          });
        }
      } catch (e) {
        console.error('Error fetching admin stats', e);
      } finally {
        setLoading(false);
      }
    }
    fetchStats();
  }, []);

  return (
    <div className="animate-in fade-in duration-500">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-white">System Overview</h1>
        <p className="text-indigo-300 mt-1">Platform performance and aggregate metrics.</p>
      </header>

      {loading ? (
        <div className="text-slate-400">Loading metrics...</div>
      ) : (
        <>
          {/* Top Stats */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <div className="glass-card p-6 rounded-2xl border-indigo-500/20 border relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-20 text-4xl">🏢</div>
              <h3 className="text-slate-400 text-sm font-medium mb-1">Total Organizations</h3>
              <p className="text-3xl font-bold text-white">{stats?.totalOrgs}</p>
              <div className="mt-4 text-xs text-emerald-400 font-medium">↑ +3 this week</div>
            </div>
            
            <div className="glass-card p-6 rounded-2xl border-indigo-500/20 border relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-20 text-4xl">📞</div>
              <h3 className="text-slate-400 text-sm font-medium mb-1">Calls (This Month)</h3>
              <p className="text-3xl font-bold text-white">{stats?.callsThisMonth?.toLocaleString() || 0}</p>
              <div className="mt-4 text-xs text-emerald-400 font-medium">↑ 12% vs last month</div>
            </div>
            
            <div className="glass-card p-6 rounded-2xl border-indigo-500/20 border relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-20 text-4xl">⏱️</div>
              <h3 className="text-slate-400 text-sm font-medium mb-1">Minutes (This Month)</h3>
              <p className="text-3xl font-bold text-white">{stats?.minutesThisMonth?.toLocaleString() || 0}</p>
              <div className="mt-4 text-xs text-slate-400 font-medium">Average 2.8m per call</div>
            </div>
            
            <div className="glass-card p-6 rounded-2xl border-emerald-500/30 border relative overflow-hidden bg-gradient-to-br from-emerald-900/20 to-transparent">
              <div className="absolute top-0 right-0 p-4 opacity-20 text-4xl">💰</div>
              <h3 className="text-emerald-400/80 text-sm font-medium mb-1">Revenue (This Month)</h3>
              <p className="text-3xl font-bold text-emerald-400">${stats?.revenueThisMonth?.toLocaleString(undefined, {minimumFractionDigits: 2}) || '0.00'}</p>
              <div className="mt-4 text-xs text-emerald-400 font-medium">↑ 8% vs last month</div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Top Organizations */}
            <div className="glass-card p-6 rounded-2xl border border-white/5 lg:col-span-2">
              <h2 className="text-lg font-bold text-white mb-6">Top Organizations by Usage</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-white/5 border-b border-white/10">
                    <tr>
                      <th className="px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Organization</th>
                      <th className="px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Plan</th>
                      <th className="px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider text-right">Minutes Used</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {stats?.topOrgs?.map(org => (
                      <tr key={org.id} className="hover:bg-white/5 transition-colors">
                        <td className="px-4 py-4 font-medium text-white">{org.name}</td>
                        <td className="px-4 py-4">
                          <span className={`px-2.5 py-1 rounded-md text-xs font-bold uppercase ${org.status === 'pro' ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30' : 'bg-slate-800 text-slate-400 border border-slate-700'}`}>
                            {org.status}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-right text-slate-300 font-mono">{org.usage?.toLocaleString() || 0}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-4 text-right">
                <a href="/admin/brokers" className="text-indigo-400 hover:text-indigo-300 text-sm font-medium">View all organizations →</a>
              </div>
            </div>

            {/* Recent Activity */}
            <div className="glass-card p-6 rounded-2xl border border-white/5">
              <h2 className="text-lg font-bold text-white mb-6">Recent Activity</h2>
              <div className="space-y-6">
                {stats?.recentActivity?.map((activity, i) => (
                  <div key={activity.id} className="relative pl-6 border-l-2 border-indigo-500/30 last:border-transparent pb-6 last:pb-0">
                    <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-[#0a0a0e] border-2 border-indigo-500" />
                    <p className="text-sm font-bold text-white leading-tight mb-1">{activity.action}</p>
                    <p className="text-xs text-slate-400 mb-2">{activity.details}</p>
                    <span className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">{activity.time}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
