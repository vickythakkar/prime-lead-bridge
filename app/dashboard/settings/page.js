'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export default function Settings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  
  const [orgId, setOrgId] = useState(null);
  const [agentId, setAgentId] = useState(null);

  const [formData, setFormData] = useState({
    name: '',
    cell_phone: '',
    company_name: ''
  });

  useEffect(() => {
    async function loadSettings() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      
      const { data: agentData } = await supabase
        .from('agents')
        .select('*, organizations(company_name)')
        .limit(1)
        .single();
        
      if (agentData) {
        setOrgId(agentData.organization_id);
        setAgentId(agentData.id);
        setFormData({
          name: agentData.name,
          cell_phone: agentData.cell_phone,
          company_name: agentData.organizations?.company_name || ''
        });
      }
      setLoading(false);
    }
    loadSettings();
  }, []);

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    
    // Update Agent
    await supabase.from('agents').update({
      name: formData.name,
      cell_phone: formData.cell_phone
    }).eq('id', agentId);

    // Update Organization Company Name
    await supabase.from('organizations').update({
      company_name: formData.company_name
    }).eq('id', orgId);
      
    setSaving(false);
    setMessage('Settings saved successfully.');
    setTimeout(() => setMessage(''), 3000);
  }

  return (
    <div className="animate-in fade-in duration-500 max-w-3xl">
      <header className="mb-10">
        <h1 className="text-3xl font-bold text-white">Settings</h1>
        <p className="text-slate-400 mt-1">Manage your account and IVR configuration.</p>
      </header>

      <div className="glass-card rounded-2xl p-8 mb-8">
        <h2 className="text-xl font-bold text-white mb-6">Profile & Brand</h2>
        
        {loading ? (
          <div className="text-slate-400">Loading settings...</div>
        ) : (
          <form onSubmit={handleSave} className="space-y-6">
            
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Company Name (Used in IVR Greeting)</label>
              <input 
                type="text" required placeholder="e.g. Prime Real Estate"
                className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500"
                value={formData.company_name} 
                onChange={(e) => setFormData({...formData, company_name: e.target.value})}
              />
              <p className="text-xs text-slate-500 mt-2">Example: "Thank you for calling {formData.company_name || '[Company Name]'}. To connect with the office, press 1..."</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-white/10">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Your Full Name</label>
                <input 
                  type="text" required
                  className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500"
                  value={formData.name} 
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Your Cell Phone</label>
                <input 
                  type="tel" required
                  className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500"
                  value={formData.cell_phone} 
                  onChange={(e) => setFormData({...formData, cell_phone: e.target.value})}
                />
              </div>
            </div>

            <div className="pt-4 border-t border-white/10 flex items-center justify-between">
              <div className="text-sm text-emerald-400">{message}</div>
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
  );
}
