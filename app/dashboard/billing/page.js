'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export default function BillingDashboard() {
  const [org, setOrg] = useState(null);
  const [rates, setRates] = useState(null);
  const [stats, setStats] = useState({
    totalMinutes: 0,
    totalCalls: 0,
    activeNumbersCount: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      
      const { data: agentData } = await supabase.from('agents').select('organization_id').limit(1).single();
      if (!agentData) return;
      const oId = agentData.organization_id;

      // Load Org details
      const { data: orgData } = await supabase.from('organizations').select('*').eq('id', oId).single();
      if (orgData) setOrg(orgData);

      // Load Admin Rates (which acts as pricing for the broker)
      const { data: adminData } = await supabase.from('admin_settings').select('*').eq('id', 1).single();
      if (adminData) setRates(adminData);

      // Load Active Numbers
      const { data: numData } = await supabase.from('organization_numbers').select('id').eq('organization_id', oId);
      
      // Load Call Logs for this billing cycle
      const { data: callData } = await supabase.from('call_logs')
        .select('duration')
        .eq('organization_id', oId);

      let totalSeconds = 0;
      if (callData) {
        totalSeconds = callData.reduce((acc, call) => acc + (call.duration || 0), 0);
      }

      setStats({
        totalMinutes: Math.ceil(totalSeconds / 60),
        totalCalls: callData?.length || 0,
        activeNumbersCount: numData?.length || 0
      });

      setLoading(false);
    }
    loadData();
  }, []);

  if (loading) return <div className="p-8 text-slate-400">Loading billing details...</div>;
  if (!org || !rates) return <div className="p-8 text-red-400">Error loading billing data.</div>;

  const planName = org.subscription_plan === 'pro' ? 'Pro Plan' : 'Basic Plan';
  const includedMinutes = org.subscription_plan === 'pro' ? 1000 : 250;
  const baseMonthlyCost = org.subscription_plan === 'pro' ? 99 : 29;
  
  const overageMinutes = Math.max(0, stats.totalMinutes - includedMinutes);
  const estimatedOverageCost = overageMinutes * rates.broker_per_minute_charge;
  
  const numbersCost = stats.activeNumbersCount * rates.monthly_number_charge;
  const totalEstimatedBill = baseMonthlyCost + estimatedOverageCost + numbersCost;

  return (
    <div className="animate-in fade-in duration-500 max-w-5xl">
      <header className="mb-10">
        <h1 className="text-3xl font-bold text-white">Billing & Usage</h1>
        <p className="text-slate-400 mt-1">Manage your plan, view usage, and download invoices.</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        
        {/* Current Plan */}
        <div className="glass-card rounded-2xl p-6 lg:col-span-2 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-3xl -mr-10 -mt-10" />
          <div className="flex justify-between items-start mb-6 relative z-10">
            <div>
              <h2 className="text-xl font-bold text-white">{planName}</h2>
              <p className="text-slate-400 text-sm mt-1">Renews on {new Date(new Date(org.billing_cycle_start).setMonth(new Date().getMonth() + 1)).toLocaleDateString()}</p>
            </div>
            <div className="text-right">
              <span className="text-3xl font-bold text-white">${baseMonthlyCost}</span>
              <span className="text-slate-400 text-sm">/mo</span>
            </div>
          </div>
          
          <div className="space-y-2 relative z-10">
            <div className="flex justify-between text-sm">
              <span className="text-slate-300">Minutes Used</span>
              <span className="text-white font-medium">{stats.totalMinutes} / {includedMinutes} min</span>
            </div>
            {/* Progress bar */}
            <div className="w-full bg-slate-800 rounded-full h-2.5">
              <div 
                className={`h-2.5 rounded-full ${stats.totalMinutes > includedMinutes ? 'bg-red-500' : 'bg-indigo-500'}`}
                style={{ width: `${Math.min(100, (stats.totalMinutes / includedMinutes) * 100)}%` }}
              ></div>
            </div>
            {stats.totalMinutes > includedMinutes && (
              <p className="text-xs text-red-400 mt-1">You have exceeded your included minutes. Overage rates apply.</p>
            )}
          </div>
        </div>

        {/* Next Invoice Estimate */}
        <div className="glass-card rounded-2xl p-6 flex flex-col justify-between">
          <div>
            <h2 className="text-lg font-bold text-white mb-1">Estimated Next Bill</h2>
            <p className="text-slate-400 text-xs mb-4">Subject to change based on usage</p>
            <div className="text-4xl font-bold text-white mb-6">
              ${totalEstimatedBill.toFixed(2)}
            </div>
            
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-400">Plan Base</span>
                <span className="text-slate-200">${baseMonthlyCost.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Phone Numbers ({stats.activeNumbersCount})</span>
                <span className="text-slate-200">${numbersCost.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Minute Overages</span>
                <span className="text-slate-200">${estimatedOverageCost.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* Available Plans */}
      <h2 className="text-xl font-bold text-white mb-6">Available Plans</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Basic Plan */}
        <div className={`glass-card rounded-2xl p-6 border ${org.subscription_plan === 'basic' ? 'border-indigo-500 shadow-[0_0_20px_rgba(79,70,229,0.2)]' : 'border-white/10'}`}>
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-bold text-white">Basic</h3>
            {org.subscription_plan === 'basic' && <span className="px-3 py-1 bg-indigo-500/20 text-indigo-300 text-xs font-bold rounded-full">Current Plan</span>}
          </div>
          <div className="text-3xl font-bold text-white mb-4">$29<span className="text-base font-normal text-slate-400">/mo</span></div>
          <ul className="space-y-3 text-sm text-slate-300 mb-6">
            <li className="flex items-center gap-2"><span>✓</span> 250 Included Minutes</li>
            <li className="flex items-center gap-2"><span>✓</span> Standard IVR Routing</li>
            <li className="flex items-center gap-2"><span>✓</span> Basic Analytics</li>
            <li className="flex items-center gap-2"><span>✓</span> ${rates.broker_per_minute_charge}/min Overage</li>
          </ul>
          {org.subscription_plan !== 'basic' && (
            <button className="w-full py-2.5 rounded-lg bg-white/5 hover:bg-white/10 text-white font-medium transition-colors border border-white/10">
              Downgrade to Basic
            </button>
          )}
        </div>

        {/* Pro Plan */}
        <div className={`glass-card rounded-2xl p-6 border ${org.subscription_plan === 'pro' ? 'border-indigo-500 shadow-[0_0_20px_rgba(79,70,229,0.2)]' : 'border-white/10'}`}>
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-bold text-white">Pro</h3>
            {org.subscription_plan === 'pro' && <span className="px-3 py-1 bg-indigo-500/20 text-indigo-300 text-xs font-bold rounded-full">Current Plan</span>}
          </div>
          <div className="text-3xl font-bold text-white mb-4">$99<span className="text-base font-normal text-slate-400">/mo</span></div>
          <ul className="space-y-3 text-sm text-slate-300 mb-6">
            <li className="flex items-center gap-2 text-indigo-300 font-medium"><span>✓</span> 1000 Included Minutes</li>
            <li className="flex items-center gap-2"><span>✓</span> Advanced IVR Routing</li>
            <li className="flex items-center gap-2"><span>✓</span> Outbound Web Dialer</li>
            <li className="flex items-center gap-2"><span>✓</span> Priority Support</li>
          </ul>
          {org.subscription_plan !== 'pro' && (
            <button className="w-full py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium transition-colors">
              Upgrade to Pro
            </button>
          )}
        </div>

      </div>

    </div>
  );
}
