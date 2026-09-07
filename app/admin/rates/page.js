'use client';
import { useState, useEffect } from 'react';

export default function RatesPage() {
  const [rate, setRate] = useState(null);
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  
  const [editingPlan, setEditingPlan] = useState(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const token = localStorage.getItem('admin_token');
        const [rateRes, planRes] = await Promise.all([
          fetch('/api/admin/rates', { headers: { 'Authorization': `Bearer ${token}` } }),
          fetch('/api/admin/subscription-plans', { headers: { 'Authorization': `Bearer ${token}` } })
        ]);
        
        if (rateRes.ok) {
          const data = await rateRes.json();
          setRate(data.rate);
        }
        if (planRes.ok) {
          const pData = await planRes.json();
          setPlans(pData.plans || []);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const handleSaveRate = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage('');

    try {
      const token = localStorage.getItem('admin_token');
      const res = await fetch('/api/admin/rates', {
        method: 'PATCH',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          rate_per_minute: parseFloat(rate.rate_per_minute),
          overage_multiplier: parseFloat(rate.overage_multiplier),
          payment_window_days: parseInt(rate.payment_window_days)
        })
      });

      if (res.ok) {
        setMessage('✅ Rates updated successfully.');
      } else {
        setMessage('❌ Failed to update rates.');
      }
    } catch (err) {
      setMessage('❌ Failed to update rates.');
    } finally {
      setSaving(false);
      setTimeout(() => setMessage(''), 3000);
    }
  };

  const handleSavePlan = async (e) => {
    e.preventDefault();
    setSaving(true);
    
    try {
      const token = localStorage.getItem('admin_token');
      const isNew = editingPlan.isNew;
      
      const payload = { ...editingPlan };
      delete payload.isNew;

      const res = await fetch('/api/admin/subscription-plans', {
        method: isNew ? 'POST' : 'PUT',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const data = await res.json();
        if (isNew) {
          setPlans([...plans, data.plan].sort((a,b) => a.base_price - b.base_price));
        } else {
          setPlans(plans.map(p => p.id === data.plan.id ? data.plan : p).sort((a,b) => a.base_price - b.base_price));
        }
        setEditingPlan(null);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-slate-400">Loading configurations...</div>;
  }

  return (
    <div className="animate-in fade-in duration-500 max-w-4xl pb-12">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-white">Rates & Settings</h1>
        <p className="text-indigo-300 mt-1">Configure global platform billing rates and subscription plans.</p>
      </header>

      <div className="glass-card rounded-2xl overflow-hidden border border-white/5 p-6 mb-8">
        <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
          <span>⚙️</span> Platform Billing Configuration
        </h2>

        <form onSubmit={handleSaveRate} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">Default Rate Per Minute ($)</label>
              <input 
                type="number" 
                step="0.001"
                required
                value={rate?.rate_per_minute ?? ''}
                onChange={(e) => setRate({...rate, rate_per_minute: e.target.value})}
                className="w-full bg-slate-900/60 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500 transition-colors"
              />
              <p className="text-xs text-slate-500">The amount charged to organizations for every minute of a call or voicemail.</p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">Payment Window (Days)</label>
              <input 
                type="number" 
                required
                value={rate?.payment_window_days ?? ''}
                onChange={(e) => setRate({...rate, payment_window_days: e.target.value})}
                className="w-full bg-slate-900/60 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500 transition-colors"
              />
              <p className="text-xs text-slate-500">Number of days before an invoice becomes overdue.</p>
            </div>
          </div>

          <div className="space-y-2 border-t border-white/5 pt-6 mt-6">
            <label className="text-sm font-medium text-slate-300">Overage Multiplier</label>
            <input 
              type="number" 
              step="0.1"
              required
              value={rate?.overage_multiplier ?? ''}
              onChange={(e) => setRate({...rate, overage_multiplier: e.target.value})}
              className="w-full md:w-1/2 bg-slate-900/60 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500 transition-colors"
            />
            <p className="text-xs text-slate-500">
              When an invoice is overdue, this multiplier is applied to their base rate per minute, added as a penalty for every week it remains overdue.
            </p>
          </div>

          <div className="border-t border-white/5 pt-6 mt-6 flex items-center gap-4">
            <button 
              type="submit"
              disabled={saving}
              className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-3 rounded-xl font-bold transition-colors disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Configuration'}
            </button>
            {message && <span className="text-sm font-medium text-emerald-400">{message}</span>}
          </div>
        </form>
      </div>

      <div className="glass-card rounded-2xl overflow-hidden border border-white/5 p-6 relative">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <span>🏷️</span> Subscription Plans
          </h2>
          <button 
            onClick={() => setEditingPlan({ isNew: true, id: '', name: '', base_price: '', included_minutes: '', overage_rate: '' })}
            className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 px-4 py-2 rounded-lg text-sm font-bold transition-colors"
          >
            + Add Plan
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-900/40 border-b border-white/10">
              <tr>
                <th className="px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Plan Name</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Base Price</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Included Mins</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Overage Rate</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-400 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {plans.map((plan) => (
                <tr key={plan.id} className="hover:bg-white/5 transition-colors">
                  <td className="px-4 py-4 font-medium text-slate-200">{plan.name} <span className="text-[10px] text-slate-600 block">{plan.id}</span></td>
                  <td className="px-4 py-4 text-emerald-400 font-mono">${parseFloat(plan.base_price).toFixed(2)}</td>
                  <td className="px-4 py-4 text-slate-300 font-mono">{plan.included_minutes}</td>
                  <td className="px-4 py-4 text-slate-300 font-mono">${parseFloat(plan.overage_rate).toFixed(3)}/min</td>
                  <td className="px-4 py-4 text-right">
                    <button 
                      onClick={() => setEditingPlan(plan)}
                      className="text-indigo-400 hover:text-indigo-300 font-medium text-sm"
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
              {plans.length === 0 && (
                <tr>
                  <td colSpan="5" className="px-4 py-8 text-center text-slate-500">
                    No subscription plans found. Run the SQL migration script to populate them.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {editingPlan && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-card rounded-2xl p-6 w-full max-w-md border border-white/10 shadow-2xl animate-in zoom-in-95 duration-200">
            <h3 className="text-xl font-bold text-white mb-6">
              {editingPlan.isNew ? 'Create New Plan' : `Edit ${editingPlan.name}`}
            </h3>
            <form onSubmit={handleSavePlan} className="space-y-4">
              {editingPlan.isNew && (
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Plan ID (Optional, generated if blank)</label>
                  <input type="text" className="w-full bg-slate-900/60 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500"
                    value={editingPlan.id} onChange={e => setEditingPlan({...editingPlan, id: e.target.value})} placeholder="e.g. enterprise_yearly" />
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Plan Name</label>
                <input type="text" required className="w-full bg-slate-900/60 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500"
                  value={editingPlan.name} onChange={e => setEditingPlan({...editingPlan, name: e.target.value})} placeholder="e.g. Enterprise" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Base Price ($)</label>
                  <input type="number" step="0.01" required className="w-full bg-slate-900/60 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500"
                    value={editingPlan.base_price} onChange={e => setEditingPlan({...editingPlan, base_price: e.target.value})} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Included Minutes</label>
                  <input type="number" required className="w-full bg-slate-900/60 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500"
                    value={editingPlan.included_minutes} onChange={e => setEditingPlan({...editingPlan, included_minutes: e.target.value})} />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Overage Rate ($ / min)</label>
                <input type="number" step="0.001" required className="w-full bg-slate-900/60 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500"
                  value={editingPlan.overage_rate} onChange={e => setEditingPlan({...editingPlan, overage_rate: e.target.value})} />
              </div>
              <div className="flex gap-3 pt-4 border-t border-white/5 mt-6">
                <button type="button" onClick={() => setEditingPlan(null)} className="flex-1 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-medium transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={saving} className="flex-1 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-medium transition-colors disabled:opacity-50">
                  {saving ? 'Saving...' : 'Save Plan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
