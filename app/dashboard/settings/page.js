'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import IvrBuilder from './IvrBuilder';

export default function Settings() {
  const [activeTab, setActiveTab] = useState('Profile');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  
  const [orgId, setOrgId] = useState(null);
  const [agentId, setAgentId] = useState(null);
  
  const [invoices, setInvoices] = useState([]);
  const [currentMonthMinutes, setCurrentMonthMinutes] = useState(0);

  const [formData, setFormData] = useState({
    name: '',
    cell_phone: '',
    company_name: '',
    play_ivr_greeting: true,
    ivr_greeting: '',
    enable_listing_lookup: true,
    receive_office_calls: true,
    fallback_when_unavailable: 'voicemail',
    fallback_phone_number: '',
    contact_email: '',
    notify_email: '',
    website: '',
    contact_phone: ''
  });

  useEffect(() => {
    async function loadSettings() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      
      const { data: agentData } = await supabase
        .from('agents')
        .select(`
          id, name, cell_phone, organization_id,
          organizations(
            company_name, play_ivr_greeting, ivr_greeting, 
            enable_listing_lookup, receive_office_calls, 
            fallback_when_unavailable, fallback_phone_number,
            ivr_flow_config, contact_email, notify_email, website, contact_phone
          )
        `)
        .limit(1)
        .single();
        
      if (agentData) {
        setOrgId(agentData.organization_id);
        setAgentId(agentData.id);
        const org = agentData.organizations;
        setFormData({
          name: agentData.name || '',
          cell_phone: agentData.cell_phone || '',
          company_name: org?.company_name || '',
          play_ivr_greeting: org?.play_ivr_greeting !== false,
          ivr_greeting: org?.ivr_greeting || '',
          enable_listing_lookup: org?.enable_listing_lookup !== false,
          receive_office_calls: org?.receive_office_calls !== false,
          fallback_when_unavailable: org?.fallback_when_unavailable || 'voicemail',
          fallback_phone_number: org?.fallback_phone_number || '',
          ivr_flow_config: org?.ivr_flow_config || {},
          contact_email: org?.contact_email || '',
          notify_email: org?.notify_email || '',
          website: org?.website || '',
          contact_phone: org?.contact_phone || ''
        });

        // Load Invoices
        const { data: invoiceData } = await supabase
          .from('invoices')
          .select('*')
          .eq('organization_id', agentData.organization_id)
          .order('created_at', { ascending: false });
        if (invoiceData) setInvoices(invoiceData);

        // Calculate current month usage from call_logs
        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);

        const { data: calls } = await supabase
          .from('call_logs')
          .select('duration')
          .eq('organization_id', agentData.organization_id)
          .gte('created_at', startOfMonth.toISOString());

        if (calls) {
          const totalSeconds = calls.reduce((acc, curr) => acc + (curr.duration || 0), 0);
          setCurrentMonthMinutes(Math.ceil(totalSeconds / 60));
        }
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

    // Update Organization Settings
    await supabase.from('organizations').update({
      company_name: formData.company_name,
      play_ivr_greeting: formData.play_ivr_greeting,
      ivr_greeting: formData.ivr_greeting,
      enable_listing_lookup: formData.enable_listing_lookup,
      receive_office_calls: formData.receive_office_calls,
      fallback_when_unavailable: formData.fallback_when_unavailable,
      fallback_phone_number: formData.fallback_phone_number,
      contact_email: formData.contact_email,
      notify_email: formData.notify_email,
      website: formData.website,
      contact_phone: formData.contact_phone
    }).eq('id', orgId);
      
    setSaving(false);
    setMessage('Settings saved successfully.');
    setTimeout(() => setMessage(''), 3000);
  }

  const renderTabs = () => (
    <div className="flex space-x-6 border-b border-white/10 mb-8">
      {['Profile', 'Inbound Calls'].map(tab => (
        <button
          key={tab}
          onClick={() => setActiveTab(tab)}
          className={`pb-3 px-1 border-b-2 font-medium text-sm transition-colors ${
            activeTab === tab 
              ? 'border-indigo-500 text-indigo-400' 
              : 'border-transparent text-slate-400 hover:text-slate-300'
          }`}
        >
          {tab}
        </button>
      ))}
    </div>
  );

  return (
    <div className="animate-in fade-in duration-500 max-w-5xl">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-white">Settings</h1>
        <p className="text-slate-400 mt-1">Update your account profile and manage your settings.</p>
      </header>

      {renderTabs()}

      {loading ? (
        <div className="text-slate-400">Loading settings...</div>
      ) : (
        <div>
          {activeTab === 'Profile' && (
            <div className="glass-card rounded-2xl p-8 mb-8 max-w-3xl">
              <h2 className="text-xl font-bold text-white mb-6">Profile Settings</h2>
              <form onSubmit={handleSave} className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Company Name</label>
                  <input 
                    type="text" required placeholder="e.g. Prime Real Estate"
                    className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500"
                    value={formData.company_name} 
                    onChange={(e) => setFormData({...formData, company_name: e.target.value})}
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">Your Name</label>
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

                <div className="pt-4 border-t border-white/10 mt-6 mb-2">
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-4">Organization Details</h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">General Contact Email</label>
                    <input 
                      type="email"
                      className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500"
                      value={formData.contact_email} 
                      onChange={(e) => setFormData({...formData, contact_email: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">General Contact Phone</label>
                    <input 
                      type="tel"
                      className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500"
                      value={formData.contact_phone} 
                      onChange={(e) => setFormData({...formData, contact_phone: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">Website URL</label>
                    <input 
                      type="url" placeholder="https://"
                      className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500"
                      value={formData.website} 
                      onChange={(e) => setFormData({...formData, website: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">Billing / Notification Email</label>
                    <input 
                      type="email"
                      className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500"
                      value={formData.notify_email} 
                      onChange={(e) => setFormData({...formData, notify_email: e.target.value})}
                    />
                  </div>
                </div>
                <div className="pt-4 border-t border-white/10 flex items-center justify-between">
                  <div className="text-sm text-emerald-400">{message}</div>
                  <button type="submit" disabled={saving} className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-2.5 rounded-lg font-medium transition-colors">
                    {saving ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {activeTab === 'Inbound Calls' && (
            <div className="mb-8">
              <IvrBuilder 
                orgId={orgId} 
                initialConfig={formData.ivr_flow_config} 
                onSaved={(msg) => {
                  setMessage(msg);
                  setTimeout(() => setMessage(''), 3000);
                }}
              />
            </div>
          )}

          {activeTab === 'Billing' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="glass-card p-6 rounded-xl border border-indigo-500/30 bg-indigo-500/5">
                  <h3 className="text-indigo-400 text-sm font-semibold uppercase tracking-wider mb-2">Current Plan</h3>
                  <div className="text-3xl font-bold text-white">Starter</div>
                </div>
                <div className="glass-card p-6 rounded-xl">
                  <h3 className="text-slate-400 text-sm font-semibold uppercase tracking-wider mb-2">Current Month Usage</h3>
                  <div className="text-3xl font-bold text-white">{currentMonthMinutes} <span className="text-lg text-slate-500 font-normal">min</span></div>
                </div>
                <div className="glass-card p-6 rounded-xl">
                  <h3 className="text-slate-400 text-sm font-semibold uppercase tracking-wider mb-2">Included Minutes</h3>
                  <div className="text-3xl font-bold text-white">500 <span className="text-lg text-slate-500 font-normal">min</span></div>
                </div>
              </div>

              <div className="glass-card p-8 rounded-2xl">
                <h2 className="text-xl font-bold text-white mb-2">Current Subscription</h2>
                <p className="text-slate-400 mb-6">Choose a plan below to activate your monthly subscription. (Demo Mode)</p>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                  <div className="border border-emerald-500/30 bg-emerald-500/5 rounded-xl p-6 relative overflow-hidden">
                    <div className="absolute top-0 right-0 bg-emerald-500 text-white text-xs font-bold px-3 py-1 rounded-bl-lg">ACTIVE</div>
                    <h3 className="text-xl font-bold text-white mb-2">Starter Plan</h3>
                    <div className="text-3xl font-bold text-emerald-400 mb-4">$59.00<span className="text-lg text-slate-400 font-normal">/mo</span></div>
                    <ul className="text-slate-300 space-y-2 mb-6 text-sm">
                      <li>✓ 500 included minutes</li>
                      <li>✓ $0.12 / extra minute</li>
                      <li>✓ Recurring subscription</li>
                    </ul>
                    <button className="bg-emerald-600/20 text-emerald-400 border border-emerald-500/50 px-4 py-2 rounded-lg font-medium w-full cursor-default">Current Plan</button>
                  </div>
                  <div className="border border-white/10 bg-white/5 rounded-xl p-6">
                    <h3 className="text-xl font-bold text-white mb-2">Growth Plan</h3>
                    <div className="text-3xl font-bold text-white mb-4">$99.00<span className="text-lg text-slate-400 font-normal">/mo</span></div>
                    <ul className="text-slate-300 space-y-2 mb-6 text-sm">
                      <li>✓ 1000 included minutes</li>
                      <li>✓ $0.10 / extra minute</li>
                      <li>✓ Recurring subscription</li>
                    </ul>
                    <button className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg font-medium w-full transition-colors">Select Plan</button>
                  </div>
                </div>
              </div>

              <div className="glass-card p-8 rounded-2xl">
                <h2 className="text-xl font-bold text-white mb-6">Usage History & Invoices</h2>
                
                {invoices.length === 0 ? (
                  <div className="text-center p-8 border border-dashed border-white/10 rounded-xl">
                    <p className="text-slate-400">No generated invoices yet. Invoices are generated at the end of each billing cycle.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead className="bg-white/5 border-b border-white/10">
                        <tr>
                          <th className="px-6 py-4 text-xs font-semibold text-slate-300 uppercase tracking-wider">Month</th>
                          <th className="px-6 py-4 text-xs font-semibold text-slate-300 uppercase tracking-wider">Total Minutes</th>
                          <th className="px-6 py-4 text-xs font-semibold text-slate-300 uppercase tracking-wider">Amount Due</th>
                          <th className="px-6 py-4 text-xs font-semibold text-slate-300 uppercase tracking-wider">Status</th>
                          <th className="px-6 py-4 text-xs font-semibold text-slate-300 uppercase tracking-wider">Due Date</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5 text-sm">
                        {invoices.map((inv) => (
                          <tr key={inv.id} className="hover:bg-white/5 transition-colors">
                            <td className="px-6 py-4 font-medium text-white">{inv.month_year}</td>
                            <td className="px-6 py-4 text-slate-300">{inv.total_minutes}</td>
                            <td className="px-6 py-4 text-slate-300">${inv.amount_due}</td>
                            <td className="px-6 py-4">
                              <span className={`px-2 py-1 rounded text-xs font-medium ${
                                inv.status === 'paid' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                                inv.status === 'overdue' ? 'bg-red-500/20 text-red-400 border border-red-500/30' :
                                'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                              }`}>
                                {inv.status.toUpperCase()}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-slate-400">{new Date(inv.due_date).toLocaleDateString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
