'use client';
import { useState, useEffect } from 'react';
import { getInvoicePdfHtml } from '@/lib/pdf-templates';
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
      
      const now = new Date();
      const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

      // Load Call Logs for this billing cycle
      const { data: callData } = await supabase.from('call_logs')
        .select('duration')
        .eq('organization_id', oId)
        .gte('created_at', startOfMonth.toISOString());

      let totalSeconds = 0;
      if (callData) {
        totalSeconds = callData.reduce((acc, call) => acc + (call.duration || 0), 0);
      }

      // Load Past Invoices
      const { data: pastInvoices } = await supabase.from('invoices')
        .select('*')
        .eq('organization_id', oId)
        .order('created_at', { ascending: false });

      setStats({
        totalMinutes: Math.ceil(totalSeconds / 60),
        totalCalls: callData?.length || 0,
        activeNumbersCount: numData?.length || 0,
        activeNumbers: numData || [],
        invoices: pastInvoices || []
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
    baseMonthlyCost = 49;
    overageRate = 0.12;
  } else if (plan === 'growth') {
    planName = 'Growth Plan';
    includedMinutes = 1000;
    baseMonthlyCost = 89;
    overageRate = 0.10;
  }
  
  const overageMinutes = Math.max(0, stats.totalMinutes - includedMinutes);
  const estimatedOverageCost = overageMinutes * overageRate;
  
  const totalEstimatedBill = baseMonthlyCost + estimatedOverageCost;

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
    const invoiceWindow = window.open('', '_blank');
    const invoiceHtml = `
      <html>
      <head>
        <title>Invoice - ${org.name}</title>
        <style>
          body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #333; margin: 0; padding: 40px; }
          .invoice-box { max-width: 800px; margin: auto; padding: 40px; border: 1px solid #eee; box-shadow: 0 0 10px rgba(0, 0, 0, 0.05); font-size: 16px; line-height: 24px; color: #555; }
          .invoice-box table { width: 100%; line-height: inherit; text-align: left; border-collapse: collapse; }
          .invoice-box table td { padding: 5px; vertical-align: top; }
          .invoice-box table tr.top table td { padding-bottom: 20px; }
          .invoice-box table tr.top table td.title { font-size: 32px; line-height: 45px; color: #4f46e5; font-weight: 800; }
          .invoice-box table tr.information table td { padding-bottom: 40px; }
          .invoice-box table tr.heading td { background: #f8fafc; border-bottom: 2px solid #e2e8f0; font-weight: bold; color: #1e293b; padding: 10px; }
          .invoice-box table tr.details td { padding-bottom: 20px; }
          .invoice-box table tr.item td { border-bottom: 1px solid #f1f5f9; padding: 15px 10px; }
          .invoice-box table tr.item.last td { border-bottom: none; }
          .invoice-box table tr.total td:nth-child(2) { border-top: 2px solid #e2e8f0; font-weight: bold; font-size: 18px; color: #0f172a; padding: 15px 10px; }
        </style>
      </head>
      <body>
        <div class="invoice-box">
          <table cellpadding="0" cellspacing="0">
            <tr class="top">
              <td colspan="2">
                <table>
                  <tr>
                    <td class="title">
                      Prime Lead Bridge
                      <div style="font-size: 14px; font-weight: normal; color: #64748b; letter-spacing: 0.5px; text-transform: uppercase; margin-top: 4px;">A PrimeRealOps Product</div>
                    </td>
                    <td style="text-align: right; font-size: 14px; color: #64748b; line-height: 1.6;">
                      <strong style="color: #0f172a; font-size: 16px;">Estimated Invoice</strong><br>
                      Date: ${new Date().toLocaleDateString()}<br>
                      Org ID: ${org.id.split('-')[0].toUpperCase()}
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr class="information">
              <td colspan="2">
                <table>
                  <tr>
                    <td style="color: #475569; line-height: 1.6;">
                      <strong style="color: #0f172a;">Prime Lead Bridge</strong><br>
                      info@primerealops.com
                    </td>
                    <td style="text-align: right; color: #475569; line-height: 1.6;">
                      <strong style="color: #0f172a;">${org.company_name || org.name}</strong><br>
                      ${org.contact_name || ''}<br>
                      ${org.contact_email || ''}
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr class="heading">
              <td>Description</td>
              <td style="text-align: right;">Amount</td>
            </tr>
            <tr class="item">
              <td>${planName}</td>
              <td style="text-align: right;">$${baseMonthlyCost.toFixed(2)}</td>
            </tr>
            <tr class="item last">
              <td>Minute Overages (${overageMinutes} mins)</td>
              <td style="text-align: right;">$${estimatedOverageCost.toFixed(2)}</td>
            </tr>
            <tr class="total">
              <td></td>
              <td style="text-align: right;">Total: $${totalEstimatedBill.toFixed(2)}</td>
            </tr>
          </table>
        </div>
        <script>
          window.onload = function() {
            setTimeout(function() {
              window.print();
            }, 500);
          }
        </script>
      </body>
      </html>
    `;
    invoiceWindow.document.write(invoiceHtml);
    invoiceWindow.document.close();
  };

  const handleDownloadPastInvoice = (invoice) => {
    const orgName = org.company_name || org.name || 'Unknown';
    const period = invoice.month_year || `${invoice.billing_period_start} — ${invoice.billing_period_end}`;
    const usageCost = parseFloat(invoice.total_minutes || 0) * parseFloat(invoice.rate_per_minute || 0);
    let baseFee = parseFloat(invoice.subtotal || 0) - usageCost;
    if (baseFee < 0) baseFee = 0; // fallback rounding

    const planName = org.subscription_plan 
      ? org.subscription_plan.replace(/_/g, ' ').toUpperCase()
      : 'PAY AS YOU GO';
    
    const htmlContent = getInvoicePdfHtml(invoice, orgName, period, baseFee, usageCost, planName);

    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
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
              <p className="text-slate-400 text-sm mt-1">Renews on {new Date(new Date(org.billing_cycle_start || new Date()).setMonth(new Date().getMonth() + 1)).toLocaleDateString()}</p>
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
              <div className="text-2xl font-bold text-white mb-3">$49<span className="text-sm font-normal text-slate-400">/mo</span></div>
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
              <div className="text-2xl font-bold text-white mb-3">$89<span className="text-sm font-normal text-slate-400">/mo</span></div>
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
                {/* Current pending estimate */}
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
                
                {/* Past Invoices */}
                {(stats.invoices || []).map(inv => (
                  <tr key={inv.id} className="hover:bg-white/5 transition-colors">
                    <td className="px-4 py-3 text-slate-300">{new Date(inv.created_at).toLocaleDateString()}</td>
                    <td className="px-4 py-3 text-slate-300">${parseFloat(inv.total_amount).toFixed(2)}</td>
                    <td className="px-4 py-3">
                      {inv.status === 'paid' ? (
                        <span className="px-2 py-1 bg-emerald-500/20 text-emerald-400 text-xs rounded-full">Paid</span>
                      ) : inv.status === 'overdue' ? (
                        <span className="px-2 py-1 bg-red-500/20 text-red-400 text-xs rounded-full">Overdue</span>
                      ) : (
                        <span className="px-2 py-1 bg-indigo-500/20 text-indigo-400 text-xs rounded-full">Due</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => handleDownloadPastInvoice(inv)} className="text-indigo-400 hover:text-indigo-300 font-medium text-xs">
                        PDF
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

    </div>
  );
}
