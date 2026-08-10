'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export default function AdminDashboard() {
  const [settings, setSettings] = useState({
    twilio_per_minute_cost: 0,
    broker_per_minute_charge: 0,
    monthly_number_charge: 0,
    one_time_number_charge: 0
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    async function loadSettings() {
      const { data, error } = await supabase
        .from('admin_settings')
        .select('*')
        .eq('id', 1)
        .single();
        
      if (data) {
        setSettings({
          twilio_per_minute_cost: data.twilio_per_minute_cost,
          broker_per_minute_charge: data.broker_per_minute_charge,
          monthly_number_charge: data.monthly_number_charge,
          one_time_number_charge: data.one_time_number_charge
        });
      }
      setLoading(false);
    }
    loadSettings();
  }, []);

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    
    const { error } = await supabase
      .from('admin_settings')
      .update({
        twilio_per_minute_cost: settings.twilio_per_minute_cost,
        broker_per_minute_charge: settings.broker_per_minute_charge,
        monthly_number_charge: settings.monthly_number_charge,
        one_time_number_charge: settings.one_time_number_charge
      })
      .eq('id', 1);
      
    setSaving(false);
    if (!error) {
      setMessage('Settings saved successfully.');
      setTimeout(() => setMessage(''), 3000);
    } else {
      setMessage('Error saving settings.');
    }
  }

  // Calculate earnings per minute
  const earningsPerMinute = (settings.broker_per_minute_charge - settings.twilio_per_minute_cost).toFixed(4);

  return (
    <div className="min-h-screen bg-[#0a0a0e] text-slate-200 p-8">
      <div className="max-w-4xl mx-auto">
        <header className="mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-500/10 text-red-400 text-sm font-medium mb-4">
            Platform Admin Access
          </div>
          <h1 className="text-3xl font-bold text-white">Prime Lead Bridge Admin</h1>
          <p className="text-slate-400 mt-1">Configure global platform billing rates and markups.</p>
        </header>

        <div className="glass-card rounded-2xl p-8 mb-8">
          <h2 className="text-xl font-bold text-white mb-6">Billing Rates Configuration</h2>
          
          {loading ? (
            <div className="text-slate-400">Loading settings...</div>
          ) : (
            <form onSubmit={handleSave} className="space-y-6">
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Fixed Fees */}
                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider border-b border-white/10 pb-2">Number Pricing</h3>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">One-Time Setup Fee ($)</label>
                    <input 
                      type="number" step="0.01" required
                      className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500"
                      value={settings.one_time_number_charge} 
                      onChange={(e) => setSettings({...settings, one_time_number_charge: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">Monthly Recurring Fee ($)</label>
                    <input 
                      type="number" step="0.01" required
                      className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500"
                      value={settings.monthly_number_charge} 
                      onChange={(e) => setSettings({...settings, monthly_number_charge: e.target.value})}
                    />
                  </div>
                </div>

                {/* Usage Fees */}
                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider border-b border-white/10 pb-2">Per-Minute Calling Rates</h3>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">Twilio Base Cost ($/min)</label>
                    <input 
                      type="number" step="0.0001" required
                      className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-4 py-2.5 text-slate-400 focus:outline-none focus:border-indigo-500"
                      value={settings.twilio_per_minute_cost} 
                      onChange={(e) => setSettings({...settings, twilio_per_minute_cost: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">Broker Charge / Markup ($/min)</label>
                    <input 
                      type="number" step="0.0001" required
                      className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500"
                      value={settings.broker_per_minute_charge} 
                      onChange={(e) => setSettings({...settings, broker_per_minute_charge: e.target.value})}
                    />
                  </div>
                  <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                    <span className="text-emerald-400 font-medium text-sm">
                      Admin Earnings: ${earningsPerMinute} per minute
                    </span>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-white/10 flex items-center justify-between">
                <div className="text-sm text-indigo-400">{message}</div>
                <button 
                  type="submit" disabled={saving}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-2.5 rounded-lg font-medium transition-colors"
                >
                  {saving ? 'Saving...' : 'Save Settings'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
