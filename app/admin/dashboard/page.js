'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import EditTaskModal from '@/app/dashboard/components/EditTaskModal';

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editingTask, setEditingTask] = useState(null);

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
    
    // Real-time update listener
    const handleTasksUpdate = () => fetchStats();
    window.addEventListener('tasksUpdated', handleTasksUpdate);
    
    return () => {
      window.removeEventListener('tasksUpdated', handleTasksUpdate);
    };
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
              <div className="absolute top-0 right-0 p-4 opacity-100 text-4xl drop-shadow-md">🏢</div>
              <h3 className="text-slate-400 text-sm font-medium mb-1">Total Organizations</h3>
              <p className="text-3xl font-bold text-white">{stats?.totalOrgs}</p>
              {stats?.growth && (
                <div className={`mt-4 text-xs font-medium ${stats.growth.orgs >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {stats.growth.orgs >= 0 ? '↑' : '↓'} {Math.abs(stats.growth.orgs)}% vs last month
                </div>
              )}
            </div>
            
            <div className="glass-card p-6 rounded-2xl border-indigo-500/20 border relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-100 text-4xl drop-shadow-md">📞</div>
              <h3 className="text-slate-400 text-sm font-medium mb-1">Calls (This Month)</h3>
              <p className="text-3xl font-bold text-white">{stats?.totalCalls?.toLocaleString() || 0}</p>
              {stats?.growth && (
                <div className={`mt-4 text-xs font-medium ${stats.growth.calls >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {stats.growth.calls >= 0 ? '↑' : '↓'} {Math.abs(stats.growth.calls)}% vs last month
                </div>
              )}
            </div>
            
            <div className="glass-card p-6 rounded-2xl border-indigo-500/20 border relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-100 text-4xl drop-shadow-md">⏱️</div>
              <h3 className="text-slate-400 text-sm font-medium mb-1">Minutes (This Month)</h3>
              <p className="text-3xl font-bold text-white">{stats?.totalMinutes?.toLocaleString() || 0}</p>
              <div className="mt-4 flex justify-between items-center">
                {stats?.growth ? (
                  <div className={`text-xs font-medium ${stats.growth.minutes >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {stats.growth.minutes >= 0 ? '↑' : '↓'} {Math.abs(stats.growth.minutes)}% vs last month
                  </div>
                ) : <div />}
                <div className="text-xs text-slate-400 font-medium">Avg {stats?.totalCalls ? (stats.totalMinutes / stats.totalCalls).toFixed(1) : 0}m/call</div>
              </div>
            </div>
            
            <div className="glass-card p-6 rounded-2xl border-emerald-500/30 border relative overflow-hidden bg-gradient-to-br from-emerald-900/20 to-transparent">
              <div className="absolute top-0 right-0 p-4 opacity-100 text-4xl drop-shadow-md">💰</div>
              <h3 className="text-emerald-400/80 text-sm font-medium mb-1">Revenue (This Month)</h3>
              <p className="text-3xl font-bold text-emerald-400">${Number(stats?.totalRevenue || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</p>
              {stats?.growth && (
                <div className={`mt-4 text-xs font-medium ${stats.growth.revenue >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {stats.growth.revenue >= 0 ? '↑' : '↓'} {Math.abs(stats.growth.revenue)}% vs last month
                </div>
              )}
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
                      <th className="px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider text-right">M.T.D Revenue</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {stats?.topOrgs?.map(org => (
                      <tr key={org.id} onClick={() => window.location.href = `/admin/brokers/${org.id}`} className="hover:bg-white/5 transition-colors cursor-pointer">
                        <td className="px-4 py-4 font-medium text-white">{org.name}</td>
                        <td className="px-4 py-4">
                          <span className={`px-2.5 py-1 rounded-md text-xs font-bold uppercase ${org.status === 'pro' || org.status === 'STARTER' || org.status === 'GROWTH' ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30' : 'bg-slate-800 text-slate-400 border border-slate-700'}`}>
                            {org.status}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-right text-slate-300 font-mono">{org.usage?.toLocaleString() || 0}</td>
                        <td className="px-4 py-4 text-right text-emerald-400 font-mono">${org.estimatedCost || '0.00'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-4 text-right">
                <a href="/admin/brokers" className="text-indigo-400 hover:text-indigo-300 text-sm font-medium">View all organizations →</a>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
            {/* Pending Follow-ups */}
            <div className="glass-card p-6 rounded-2xl border-indigo-500/10 border">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-bold text-white">Pending Follow-ups</h3>
              </div>
              
              {!stats?.pendingTasks || stats.pendingTasks.length === 0 ? (
                <div className="text-center py-8 text-slate-400">
                  <p>You have no pending follow-ups. Great job!</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {stats.pendingTasks.map(task => {
                    const isOverdue = new Date(task.due_date) < new Date();
                    return (
                      <div key={task.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-slate-900/50 border border-white/5 rounded-xl hover:border-white/10 transition-colors gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h4 className="font-medium text-white">{task.title}</h4>
                            {task.disposition && (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold tracking-wide uppercase bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                                {task.disposition}
                              </span>
                            )}
                          </div>
                          
                          {task.description && (
                            <p className="text-sm text-slate-400 mt-1 line-clamp-2 italic">&quot;{task.description}&quot;</p>
                          )}
                          
                          <div className="flex items-center gap-3 mt-2 text-sm">
                            <span className={isOverdue ? 'text-red-400 font-medium' : 'text-slate-400'}>
                              {new Date(task.due_date).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                            </span>
                            {task.phone_number && (
                              <>
                                <span className="text-slate-600">•</span>
                                <span className="text-slate-400 font-mono">{task.phone_number}</span>
                              </>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 sm:self-start">
                          <button
                            onClick={() => setEditingTask(task)}
                            className="w-8 h-8 rounded-lg bg-slate-800 text-slate-400 flex items-center justify-center hover:bg-slate-700 hover:text-white transition-colors"
                            title="Edit Task"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 16 16"><path d="M12.146.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1 0 .708l-10 10a.5.5 0 0 1-.168.11l-5 2a.5.5 0 0 1-.65-.65l2-5a.5.5 0 0 1 .11-.168l10-10zM11.207 2.5 13.5 4.793 14.793 3.5 12.5 1.207 11.207 2.5zm1.586 3L10.5 3.207 4 9.707V10h.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.5h.293l6.5-6.5zm-9.761 5.175-.106.106-1.528 3.821 3.821-1.528.106-.106A.5.5 0 0 1 5 12.5V12h-.5a.5.5 0 0 1-.5-.5V11h-.5a.5.5 0 0 1-.468-.325z"/></svg>
                          </button>
                          
                          <button
                            onClick={async () => {
                              if (!confirm('Move this follow-up to trash?')) return;
                              const token = localStorage.getItem('admin_token');
                              await fetch(`/api/admin/tasks/${task.id}`, { 
                                method: 'PATCH', 
                                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                                body: JSON.stringify({ is_deleted: true, deleted_at: new Date().toISOString() })
                              });
                              const fetchStats = async () => {
                                const res = await fetch('/api/admin/stats', { headers: { 'Authorization': `Bearer ${token}` } });
                                if (res.ok) setStats(await res.json());
                              };
                              fetchStats();
                            }}
                            className="w-8 h-8 rounded-lg bg-red-500/10 text-red-400 flex items-center justify-center hover:bg-red-500/20 transition-colors"
                            title="Delete Task"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 16 16"><path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/><path fillRule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/></svg>
                          </button>
                          
                          {task.phone_number && (
                            <Link 
                              href={`/admin/dialer?phone=${encodeURIComponent(task.phone_number)}`}
                              className="w-10 h-10 ml-2 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center hover:bg-emerald-500/20 transition-colors"
                              title="Call Now"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M3.654 1.328a.678.678 0 0 0-1.015-.063L1.605 2.3c-.483.484-.661 1.169-.45 1.77a17.568 17.568 0 0 0 4.168 6.608 17.569 17.569 0 0 0 6.608 4.168c.601.211 1.286.033 1.77-.45l1.034-1.034a.678.678 0 0 0-.063-1.015l-2.307-1.794a.678.678 0 0 0-.58-.122l-2.19.547a1.745 1.745 0 0 1-1.657-.459L5.482 8.062a1.745 1.745 0 0 1-.46-1.657l.548-2.19a.678.678 0 0 0-.122-.58L3.654 1.328z"/></svg>
                            </Link>
                          )}
                          <button 
                            onClick={async () => {
                              const token = localStorage.getItem('admin_token');
                              await fetch(`/api/admin/tasks/${task.id}`, { 
                                method: 'PATCH', 
                                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                                body: JSON.stringify({ status: 'completed' })
                              });
                              const fetchStats = async () => {
                                const res = await fetch('/api/admin/stats', { headers: { 'Authorization': `Bearer ${token}` } });
                                if (res.ok) setStats(await res.json());
                              };
                              fetchStats();
                            }}
                            className="w-10 h-10 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center hover:bg-indigo-500/20 transition-colors"
                            title="Mark as Done"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M10.97 4.97a.75.75 0 0 1 1.07 1.05l-3.99 4.99a.75.75 0 0 1-1.08.02L4.324 8.384a.75.75 0 1 1 1.06-1.06l2.094 2.093 3.473-4.425a.267.267 0 0 1 .02-.022z"/></svg>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
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

      <EditTaskModal 
        isOpen={!!editingTask} 
        onClose={() => setEditingTask(null)} 
        task={editingTask} 
      />
    </div>
  );
}
