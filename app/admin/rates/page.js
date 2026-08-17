'use client';
import { useState, useEffect } from 'react';

export default function RatesPage() {
  const [rate, setRate] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    async function fetchRate() {
      try {
        const token = localStorage.getItem('admin_token');
        const res = await fetch('/api/admin/rates', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (res.ok) {
          const data = await res.json();
          setRate(data.rate);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    fetchRate();
  }, []);

  const handleSave = async (e) => {
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
    }
  };

  if (loading) {
    return <div className="p-8 text-slate-400">Loading rate configuration...</div>;
  }

  return (
    <div className="animate-in fade-in duration-500 max-w-3xl">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-white">Rates & Settings</h1>
        <p className="text-indigo-300 mt-1">Configure global platform billing rates and overage penalties.</p>
      </header>

      <div className="glass-card rounded-2xl overflow-hidden border border-white/5 p-6">
        <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
          <span>⚙️</span> Platform Billing Configuration
        </h2>

        <form onSubmit={handleSave} className="space-y-6">
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
    </div>
  );
}
