'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import StatsCard from './components/StatsCard';

export default function DashboardOverview() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalLeads: 0,
    activeProperties: 0,
    activeNumbers: 0,
    potentialInvoice: 0,
    planName: 'Basic',
    minutesUsed: 0,
    planLimit: 250
  });
  const [tasks, setTasks] = useState([]);
  useEffect(() => {
    async function loadData() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      
      const { data: agentData } = await supabase.from('agents').select('organization_id').eq('id', session.user.id).single();
      if (!agentData) return;
      const oId = agentData.organization_id;

      // Org & Billing
      const { data: orgData } = await supabase.from('organizations').select('subscription_plan').eq('id', oId).single();
      const { data: adminData } = await supabase.from('admin_settings').select('*').eq('id', 1).single();
      
      // Data counts
      const { count: leadsCount } = await supabase.from('leads').select('id', { count: 'exact', head: true }).eq('organization_id', oId);
      const { count: propsCount } = await supabase.from('properties').select('id', { count: 'exact', head: true }).eq('organization_id', oId).eq('is_active', true).eq('is_deleted', false);
      const { count: numsCount } = await supabase.from('organization_numbers').select('id', { count: 'exact', head: true }).eq('organization_id', oId);
      
      // Minutes used (Current Month only)
      const now = new Date();
      const currentMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
      const { data: callData } = await supabase.from('call_logs').select('duration').eq('organization_id', oId).gte('created_at', currentMonthStart);
      const totalSeconds = callData ? callData.reduce((acc, call) => acc + (call.duration || 0), 0) : 0;
      const totalMinutes = Math.ceil(totalSeconds / 60);

      // Estimate invoice
      let estimatedInvoice = 0;
      let planName = 'Pay As You Go';
      let planLimit = 0;

      if (orgData) {
        const plan = orgData.subscription_plan || 'pay_as_you_go';
        let baseCost = 5;
        let includedMins = 0;
        let overageRate = 0.05;

        if (plan === 'starter') {
          planName = 'Starter';
          baseCost = 39;
          includedMins = 500;
          overageRate = 0.12;
        } else if (plan === 'growth') {
          planName = 'Growth';
          baseCost = 79;
          includedMins = 1000;
          overageRate = 0.10;
        }

        planLimit = includedMins;
        const overageMins = Math.max(0, totalMinutes - includedMins);
        const overageCost = overageMins * overageRate;
        estimatedInvoice = baseCost + overageCost;
      }

      setStats({
        totalLeads: leadsCount || 0,
        activeProperties: propsCount || 0,
        activeNumbers: numsCount || 0,
        potentialInvoice: estimatedInvoice,
        planName,
        minutesUsed: totalMinutes,
        planLimit: planLimit
      });

      // Tasks
      const { data: pendingTasks } = await supabase.from('tasks')
        .select('*')
        .eq('organization_id', oId)
        .eq('status', 'pending')
        .order('due_date', { ascending: true })
        .limit(5);

      setTasks(pendingTasks || []);

      setLoading(false);
    }
    loadData();
  }, []);

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <header className="mb-10">
        <h1 className="text-3xl font-bold text-white">Dashboard Overview</h1>
        <p className="text-slate-400 mt-1">Welcome back. Here is what&apos;s happening with your properties today.</p>
      </header>

      {loading ? (
        <div className="text-slate-400">Loading overview...</div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
            <StatsCard title="Total Leads" value={stats.totalLeads} trend="3 new today" trendUp={true} />
            <StatsCard title="Active Properties" value={stats.activeProperties} />
            <StatsCard title="Active Numbers" value={stats.activeNumbers} />
            <StatsCard title="Minutes Used" value={stats.planLimit === 0 ? `${stats.minutesUsed}` : `${stats.minutesUsed}/${stats.planLimit}`} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Billing Snapshot */}
            <div className="glass-card rounded-2xl p-6 lg:col-span-1 border border-indigo-500/20 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-2xl -mr-10 -mt-10" />
              <h2 className="text-lg font-bold text-white mb-6 relative z-10">Billing Snapshot</h2>
              
              <div className="space-y-4 relative z-10">
                <div className="p-4 bg-slate-900/50 rounded-xl border border-white/5">
                  <p className="text-sm text-slate-400 mb-1">Current Plan</p>
                  <p className="text-xl font-bold text-white">{stats.planName} Plan</p>
                </div>
                
                <div className="p-4 bg-slate-900/50 rounded-xl border border-white/5">
                  <p className="text-sm text-slate-400 mb-1">Estimated Next Invoice</p>
                  <p className="text-3xl font-bold text-emerald-400">${stats.potentialInvoice.toFixed(2)}</p>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="glass-card rounded-2xl p-6 lg:col-span-2">
              <h2 className="text-lg font-bold text-white mb-6">Quick Actions</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <a href="/dashboard/properties" className="flex items-center p-4 rounded-xl bg-indigo-500/10 text-indigo-300 hover:bg-indigo-500/20 transition-colors border border-indigo-500/20 group">
                  <span className="text-2xl mr-4 group-hover:scale-110 transition-transform">🏠</span>
                  <div>
                    <span className="font-bold block">Add Property</span>
                    <span className="text-xs text-indigo-300/70">Create a new listing for IVR</span>
                  </div>
                </a>
                
                <a href="/dashboard/numbers" className="flex items-center p-4 rounded-xl bg-blue-500/10 text-blue-300 hover:bg-blue-500/20 transition-colors border border-blue-500/20 group">
                  <span className="text-2xl mr-4 group-hover:scale-110 transition-transform">📱</span>
                  <div>
                    <span className="font-bold block">Buy Number</span>
                    <span className="text-xs text-blue-300/70">Get a new Twilio local number</span>
                  </div>
                </a>
                
                <a href="/dashboard/dialer" className="flex items-center p-4 rounded-xl bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20 transition-colors border border-emerald-500/20 group">
                  <span className="text-2xl mr-4 group-hover:scale-110 transition-transform">📞</span>
                  <div>
                    <span className="font-bold block">Make a Call</span>
                    <span className="text-xs text-emerald-300/70">Use the web dialer to call leads</span>
                  </div>
                </a>
                
                <a href="/dashboard/settings" className="flex items-center p-4 rounded-xl bg-white/5 text-slate-300 hover:bg-white/10 transition-colors border border-white/5 group">
                  <span className="text-2xl mr-4 group-hover:scale-110 transition-transform">⚙️</span>
                  <div>
                    <span className="font-bold block">Settings</span>
                    <span className="text-xs text-slate-400">Update company name and profile</span>
                  </div>
                </a>
              </div>
            </div>
            {/* Pending Follow-ups */}
            <div className="glass-card rounded-2xl p-6 lg:col-span-3">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-lg font-bold text-white">Pending Follow-ups</h2>
                <Link href="/dashboard/tasks" className="text-sm text-indigo-400 hover:text-indigo-300">View All</Link>
              </div>
              
              {tasks.length === 0 ? (
                <div className="text-center py-8 text-slate-400">
                  <p>You have no pending follow-ups. Great job!</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {tasks.map(task => {
                    const isOverdue = new Date(task.due_date) < new Date();
                    return (
                      <div key={task.id} className="flex items-center justify-between p-4 bg-slate-900/50 border border-white/5 rounded-xl hover:border-white/10 transition-colors">
                        <div>
                          <h3 className="font-medium text-white">{task.title}</h3>
                          <div className="flex items-center gap-3 mt-1 text-sm">
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
                        <div className="flex items-center gap-2">
                          {task.phone_number && (
                            <Link 
                              href={`/dashboard/dialer?phone=${encodeURIComponent(task.phone_number)}`}
                              className="w-10 h-10 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center hover:bg-emerald-500/20 transition-colors"
                              title="Call Now"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M3.654 1.328a.678.678 0 0 0-1.015-.063L1.605 2.3c-.483.484-.661 1.169-.45 1.77a17.568 17.568 0 0 0 4.168 6.608 17.569 17.569 0 0 0 6.608 4.168c.601.211 1.286.033 1.77-.45l1.034-1.034a.678.678 0 0 0-.063-1.015l-2.307-1.794a.678.678 0 0 0-.58-.122l-2.19.547a1.745 1.745 0 0 1-1.657-.459L5.482 8.062a1.745 1.745 0 0 1-.46-1.657l.548-2.19a.678.678 0 0 0-.122-.58L3.654 1.328z"/></svg>
                            </Link>
                          )}
                          <button 
                            onClick={async () => {
                              await supabase.from('tasks').update({ status: 'completed' }).eq('id', task.id);
                              setTasks(tasks.filter(t => t.id !== task.id));
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
          </div>
        </>
      )}
    </div>
  );
}
