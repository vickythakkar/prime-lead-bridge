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
      
      // Minutes used
      const { data: callData } = await supabase.from('call_logs').select('duration').eq('organization_id', oId);
      const totalSeconds = callData ? callData.reduce((acc, call) => acc + (call.duration || 0), 0) : 0;
      const totalMinutes = Math.ceil(totalSeconds / 60);

      // Estimate invoice
      let estimatedInvoice = 0;
      let planName = 'Basic';
      if (orgData && adminData) {
        planName = orgData.subscription_plan === 'pro' ? 'Pro' : 'Basic';
        const baseCost = planName === 'Pro' ? 99 : 29;
        const includedMins = planName === 'Pro' ? 1000 : 250;
        const overageMins = Math.max(0, totalMinutes - includedMins);
        const overageCost = overageMins * adminData.broker_per_minute_charge;
        const numsCost = (numsCount || 0) * adminData.monthly_number_charge;
        estimatedInvoice = baseCost + overageCost + numsCost;
      }

      setStats({
        totalLeads: leadsCount || 0,
        activeProperties: propsCount || 0,
        activeNumbers: numsCount || 0,
        potentialInvoice: estimatedInvoice,
        planName,
        minutesUsed: totalMinutes,
        planLimit: planName === 'Pro' ? 1000 : 250
      });

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
            <StatsCard title="Minutes Used" value={`${stats.minutesUsed}/${stats.planLimit}`} />
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
          </div>
        </>
      )}
    </div>
  );
}
