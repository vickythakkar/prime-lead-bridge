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
      
      const { data: agentData } = await supabase.from('agents').select('organization_id').eq('id', session.user.id).single();
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
      
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      // Load Call Logs for this billing cycle
      const { data: callData } = await supabase.from('call_logs')
        .select('duration')
        .eq('organization_id', oId)
        .gte('created_at', startOfMonth.toISOString());

      let totalSeconds = 0;
      if (callData) {
        totalSeconds = callData.reduce((acc, call) => acc + (call.duration || 0), 0);
      }

      setStats({
        totalMinutes: Math.ceil(totalSeconds / 60),
        totalCalls: callData?.length || 0,
        activeNumbersCount: numData?.length || 0,
        activeNumbers: numData || []
      });

      setLoading(false);
    }
    loadData();
  }, []);

  if (loading) return <div className="p-8 text-slate-400">Loading billing details...</div>;
  if (!org || !rates) return <div className="p-8 text-red-400">Error loading billing data.</div>;

  const plan = org.subscription_plan || 'pay_as_you_go';
  let planName = 'Pay As You Go';
  let includedMinutes = 0;
  let baseMonthlyCost = 5;
  let overageRate = rates.broker_per_minute_charge;

  if (plan === 'starter') {
    planName = 'Starter Plan';
    includedMinutes = 500;
    baseMonthlyCost = 39;
    overageRate = 0.12;
  } else if (plan === 'growth') {
    planName = 'Growth Plan';
    includedMinutes = 1000;
    baseMonthlyCost = 79;
    overageRate = 0.10;
  }
  
  const overageMinutes = Math.max(0, stats.totalMinutes - includedMinutes);
  const estimatedOverageCost = overageMinutes * overageRate;
  
  const numbersCost = stats.activeNumbersCount * rates.monthly_number_charge;
  const totalEstimatedBill = baseMonthlyCost + estimatedOverageCost + numbersCost;

  const handlePlanChange = async (newPlan) => {
    if (!confirm(`Are you sure you want to switch to this plan?`)) return;
    const { error } = await supabase.from('organizations').update({ subscription_plan: newPlan }).eq('id', org.id);
    if (!error) {
      setOrg({ ...org, subscription_plan: newPlan });
      alert('Plan updated successfully.');
    } else {
      alert('Failed to update plan.');
    }
  };

  const handleDownloadInvoice = () => {
    // Generate a simple mock invoice for the MVP
    const invoiceContent = `
    INVOICE - Prime Real Ops
    Date: ${new Date().toLocaleDateString()}
    Organization: ${org.name}
    
    Current Plan: ${planName}
    Base Cost: $${baseMonthlyCost.toFixed(2)}
    Phone Numbers: $${numbersCost.toFixed(2)}
    Minute Overages: $${estimatedOverageCost.toFixed(2)}
    
    Total Estimated Bill: $${totalEstimatedBill.toFixed(2)}
    
    Thank you for your business!
    `;
    const blob = new Blob([invoiceContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Invoice_${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="animate-in fade-in duration-500 max-w-5xl mx-auto">
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
                className={`h-2.5 rounded-full ${includedMinutes > 0 && stats.totalMinutes > includedMinutes ? 'bg-red-500' : 'bg-indigo-500'}`}
                style={{ width: `${includedMinutes > 0 ? Math.min(100, (stats.totalMinutes / includedMinutes) * 100) : 100}%` }}
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
              {stats.activeNumbersCount > 0 && (
                <div className="pl-4 text-xs font-mono text-slate-500">
                  {stats.activeNumbers.map(n => <div key={n.id}>{n.phone_number}</div>)}
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-slate-400">Minute Overages</span>
                <span className="text-slate-200">${estimatedOverageCost.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>

      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        <div>
          {/* Available Plans */}
          <h2 className="text-xl font-bold text-white mb-6">Available Plans</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* Pay As You Go */}
            <div className={`glass-card rounded-xl p-5 border ${plan === 'pay_as_you_go' ? 'border-indigo-500 shadow-[0_0_20px_rgba(79,70,229,0.2)]' : 'border-white/10'}`}>
              <div className="flex justify-between items-center mb-3">
                <h3 className="font-bold text-white">Pay As You Go</h3>
                {plan === 'pay_as_you_go' && <span className="px-2 py-0.5 bg-indigo-500/20 text-indigo-300 text-[10px] font-bold rounded uppercase">Current</span>}
              </div>
              <div className="text-2xl font-bold text-white mb-3">$5<span className="text-sm font-normal text-slate-400">/mo</span></div>
              <ul className="space-y-2 text-xs text-slate-300 mb-4">
                <li className="flex items-center gap-2"><span>✓</span> 0 Included Minutes</li>
                <li className="flex items-center gap-2"><span>✓</span> $0.05 / minute</li>
                <li className="flex items-center gap-2"><span>✓</span> Basic Analytics</li>
              </ul>
              {plan !== 'pay_as_you_go' && (
                <button onClick={() => handlePlanChange('pay_as_you_go')} className="w-full py-2 rounded bg-white/5 hover:bg-white/10 text-white text-sm font-medium transition-colors border border-white/10">
                  Switch to PAYG
                </button>
              )}
            </div>

            {/* Starter Plan */}
            <div className={`glass-card rounded-xl p-5 border ${plan === 'starter' ? 'border-indigo-500 shadow-[0_0_20px_rgba(79,70,229,0.2)]' : 'border-white/10'}`}>
              <div className="flex justify-between items-center mb-3">
                <h3 className="font-bold text-white">Starter</h3>
                {plan === 'starter' && <span className="px-2 py-0.5 bg-indigo-500/20 text-indigo-300 text-[10px] font-bold rounded uppercase">Current</span>}
              </div>
              <div className="text-2xl font-bold text-white mb-3">$39<span className="text-sm font-normal text-slate-400">/mo</span></div>
              <ul className="space-y-2 text-xs text-slate-300 mb-4">
                <li className="flex items-center gap-2"><span>✓</span> 500 Included Minutes</li>
                <li className="flex items-center gap-2"><span>✓</span> $0.12 / extra minute</li>
                <li className="flex items-center gap-2"><span>✓</span> Incoming & Outgoing Calls</li>
              </ul>
              {plan !== 'starter' && (
                <button onClick={() => handlePlanChange('starter')} className="w-full py-2 rounded bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-colors">
                  {plan === 'growth' ? 'Downgrade to Starter' : 'Upgrade to Starter'}
                </button>
              )}
            </div>

            {/* Growth Plan */}
            <div className={`glass-card rounded-xl p-5 border ${plan === 'growth' ? 'border-indigo-500 shadow-[0_0_20px_rgba(79,70,229,0.2)]' : 'border-white/10'}`}>
              <div className="flex justify-between items-center mb-3">
                <h3 className="font-bold text-white">Growth</h3>
                {plan === 'growth' && <span className="px-2 py-0.5 bg-indigo-500/20 text-indigo-300 text-[10px] font-bold rounded uppercase">Current</span>}
              </div>
              <div className="text-2xl font-bold text-white mb-3">$79<span className="text-sm font-normal text-slate-400">/mo</span></div>
              <ul className="space-y-2 text-xs text-slate-300 mb-4">
                <li className="flex items-center gap-2 text-indigo-300 font-medium"><span>✓</span> 1000 Included Minutes</li>
                <li className="flex items-center gap-2"><span>✓</span> $0.10 / extra minute</li>
                <li className="flex items-center gap-2"><span>✓</span> Advanced Analytics</li>
              </ul>
              {plan !== 'growth' && (
                <button onClick={() => handlePlanChange('growth')} className="w-full py-2 rounded bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-colors">
                  Upgrade to Growth
                </button>
              )}
            </div>

          </div>
        </div>

        <div>
          {/* Invoice History */}
          <h2 className="text-xl font-bold text-white mb-6">Invoice History</h2>
          <div className="glass-card rounded-xl overflow-hidden">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-900/40 border-b border-white/10">
                <tr>
                  <th className="px-4 py-3 font-semibold text-slate-400">Date</th>
                  <th className="px-4 py-3 font-semibold text-slate-400">Amount</th>
                  <th className="px-4 py-3 font-semibold text-slate-400">Status</th>
                  <th className="px-4 py-3 font-semibold text-slate-400 text-right">Download</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {/* Mock historical invoice row */}
                <tr className="hover:bg-white/5 transition-colors">
                  <td className="px-4 py-3 text-slate-300">{new Date().toLocaleDateString()} (Current)</td>
                  <td className="px-4 py-3 text-slate-300">${totalEstimatedBill.toFixed(2)}</td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-1 bg-yellow-500/20 text-yellow-400 text-xs rounded-full">Pending</span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={handleDownloadInvoice} className="text-indigo-400 hover:text-indigo-300 font-medium text-xs">
                      PDF
                    </button>
                  </td>
                </tr>
                {/* Mock paid invoice row */}
                <tr className="hover:bg-white/5 transition-colors">
                  <td className="px-4 py-3 text-slate-300">{new Date(new Date().setMonth(new Date().getMonth() - 1)).toLocaleDateString()}</td>
                  <td className="px-4 py-3 text-slate-300">${baseMonthlyCost.toFixed(2)}</td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-1 bg-emerald-500/20 text-emerald-400 text-xs rounded-full">Paid</span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={handleDownloadInvoice} className="text-indigo-400 hover:text-indigo-300 font-medium text-xs">
                      PDF
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

    </div>
  );
}
