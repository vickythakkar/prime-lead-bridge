'use client';
import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useDialer } from '@/app/admin/components/AdminDialerContext';

export default function OrganizationDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const { id } = params;

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // Settings Form State
  const [settings, setSettings] = useState({});
  const [savingSettings, setSavingSettings] = useState(false);

  // Number Provisioning State
  const [areaCode, setAreaCode] = useState('');
  const [availableNumbers, setAvailableNumbers] = useState([]);
  const [searchingNumbers, setSearchNumbers] = useState(false);
  const [buyingNumber, setBuyingNumber] = useState(null);

  // Dialer State
  const { handleDial } = useDialer();

  useEffect(() => {
    fetchOrgDetails();
  }, [id]);

  async function fetchOrgDetails() {
    setLoading(true);
    try {
      const token = localStorage.getItem('admin_token');
      const res = await fetch(`/api/admin/organizations/${id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const json = await res.json();
        setData(json);
        setSettings({
          company_name: json.organization.company_name || '',
          subscription_plan: json.organization.subscription_plan || 'PAY_AS_YOU_GO',
          ivr_greeting: json.organization.ivr_greeting || '',
          play_ivr_greeting: json.organization.play_ivr_greeting !== false,
          receive_office_calls: json.organization.receive_office_calls !== false,
          enable_listing_lookup: json.organization.enable_listing_lookup !== false,
          notify_email: json.organization.notify_email || '',
          service_active: json.organization.ivr_flow_config?.service_active !== false,
          rate_per_minute: json.organization.ivr_flow_config?.rate_per_minute || '',
          pending_discount_type: json.organization.pending_discount_type || 'fixed',
          pending_discount_amount: json.organization.pending_discount_amount || ''
        });
      } else {
        alert('Failed to load organization');
        router.push('/admin/brokers');
      }
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  }



  async function saveSettings(e) {
    e.preventDefault();
    setSavingSettings(true);
    try {
      const token = localStorage.getItem('admin_token');
      const res = await fetch(`/api/admin/organizations/${id}/settings`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(settings)
      });
      if (res.ok) {
        alert('Settings saved successfully!');
        fetchOrgDetails();
      } else {
        alert('Failed to save settings.');
      }
    } catch (err) {
      console.error(err);
      alert('Error saving settings.');
    }
    setSavingSettings(false);
  }

  async function searchNumbers() {
    if (!areaCode || areaCode.length !== 3) return alert('Enter a 3-digit area code');
    setSearchNumbers(true);
    try {
      const token = localStorage.getItem('admin_token');
      const res = await fetch(`/api/admin/twilio/available-numbers?areaCode=${areaCode}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const json = await res.json();
        setAvailableNumbers(json.numbers || []);
      } else {
        const errText = await res.text();
        alert('Failed to search numbers: ' + errText);
      }
    } catch (e) {
      console.error(e);
      alert('Error searching numbers');
    }
    setSearchNumbers(false);
  }

  async function buyNumber(phoneNumber) {
    if (!confirm(`Are you sure you want to purchase ${phoneNumber} for this organization?`)) return;
    setBuyingNumber(phoneNumber);
    try {
      const token = localStorage.getItem('admin_token');
      const res = await fetch(`/api/admin/organizations/${id}/numbers`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ phoneNumber })
      });
      if (res.ok) {
        alert(`Successfully purchased ${phoneNumber}!`);
        setAvailableNumbers([]);
        fetchOrgDetails(); // Refresh list
      } else {
        const errText = await res.text();
        alert('Failed to purchase number: ' + errText);
      }
    } catch (e) {
      console.error(e);
      alert('Error purchasing number');
    }
    setBuyingNumber(null);
  }

  if (loading || !data) {
    return <div className="p-8 text-white">Loading organization details...</div>;
  }

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <button onClick={() => router.push('/admin/brokers')} className="text-slate-400 hover:text-white text-sm mb-2 flex items-center">
            &larr; Back to Brokers
          </button>
          <h1 className="text-3xl font-bold text-white tracking-tight">{data.organization.company_name || data.organization.name}</h1>
          <p className="text-slate-400 mt-1">ID: {data.organization.id}</p>
        </div>
        <div className="bg-slate-900 border border-white/10 rounded-xl px-4 py-3 flex items-center space-x-6">
          <div className="flex flex-col">
            <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Realty Status</span>
            <span className={`text-sm font-medium flex items-center ${settings.service_active ? 'text-emerald-400' : 'text-red-400'}`}>
              <span className={`w-2 h-2 rounded-full mr-2 ${settings.service_active ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'}`}></span>
              {settings.service_active ? 'Onboarded / Active' : 'Offboarded / Suspended'}
            </span>
          </div>
          <div className="flex flex-col border-l border-white/10 pl-6">
            <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider mb-1">Services Toggle</span>
            <button 
              onClick={async () => {
                const newState = !settings.service_active;
                if(!confirm(`Are you sure you want to ${newState ? 'resume' : 'stop'} all services for this organization?`)) return;
                setSettings({...settings, service_active: newState});
                // Optimistically save just this field
                try {
                  const token = localStorage.getItem('admin_token');
                  await fetch(`/api/admin/organizations/${id}/settings`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ service_active: newState })
                  });
                } catch(e) {}
              }}
              className={`px-3 py-1 text-xs font-bold rounded uppercase tracking-wider border ${settings.service_active ? 'bg-red-500/10 text-red-400 border-red-500/20 hover:bg-red-500/20' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20'}`}
            >
              {settings.service_active ? 'Stop Services' : 'Resume Services'}
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* LEFT COLUMN: Settings & Info */}
        <div className="lg:col-span-2 space-y-8">
          
          {/* Assigned Numbers */}
          <div className="bg-slate-900/50 border border-white/10 rounded-2xl overflow-hidden">
            <div className="px-6 py-5 border-b border-white/10 bg-white/[0.02]">
              <h2 className="text-lg font-semibold text-white">Assigned Phone Numbers</h2>
            </div>
            <div className="p-6">
              {data.numbers.length > 0 ? (
                <div className="space-y-3 mb-6">
                  {data.numbers.map(num => (
                    <div key={num.id} className="flex items-center justify-between p-3 rounded-xl border border-white/10 bg-white/5">
                      <div>
                        <div className="text-white font-medium text-lg">{num.phone_number}</div>
                        <div className="text-sm text-slate-400 mt-0.5">Added: {new Date(num.created_at).toLocaleDateString()}</div>
                      </div>
                      <div className="flex space-x-2">
                        <button onClick={() => handleDial(num.phone_number)} className="bg-indigo-500 hover:bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
                          Call Number
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-slate-400 mb-6 bg-white/5 p-4 rounded-xl border border-white/5 text-center">No numbers assigned yet.</div>
              )}

              <div className="border-t border-white/10 pt-6">
                <h3 className="text-sm font-medium text-white mb-3">Provision New Number</h3>
                <div className="flex space-x-3 mb-4">
                  <input 
                    type="text" 
                    placeholder="Area Code (e.g. 830)" 
                    maxLength={3}
                    className="bg-slate-900/60 border border-white/10 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-indigo-500"
                    value={areaCode}
                    onChange={e => setAreaCode(e.target.value.replace(/\D/g, ''))}
                  />
                  <button onClick={searchNumbers} disabled={searchingNumbers} className="bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors border border-white/10 disabled:opacity-50">
                    {searchingNumbers ? 'Searching...' : 'Search'}
                  </button>
                </div>

                {availableNumbers.length > 0 && (
                  <div className="space-y-2 mt-4 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                    {availableNumbers.map(n => (
                      <div key={n.phoneNumber} className="flex items-center justify-between p-3 rounded-lg border border-white/5 bg-slate-800/50">
                        <div>
                          <div className="text-white font-medium">{n.friendlyName}</div>
                          <div className="text-xs text-slate-400">{n.locality}, {n.region}</div>
                        </div>
                        <button 
                          onClick={() => buyNumber(n.phoneNumber)}
                          disabled={buyingNumber === n.phoneNumber}
                          className="bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 border border-emerald-500/30 px-3 py-1.5 rounded-lg text-sm font-bold transition-colors disabled:opacity-50"
                        >
                          {buyingNumber === n.phoneNumber ? 'Buying...' : 'Buy'}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Configuration Settings */}
          <div className="bg-slate-900/50 border border-white/10 rounded-2xl overflow-hidden">
            <div className="px-6 py-5 border-b border-white/10 bg-white/[0.02]">
              <h2 className="text-lg font-semibold text-white">Organization Configuration</h2>
            </div>
            <form onSubmit={saveSettings} className="p-6 space-y-5">
              
              <div className="grid grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Company Name</label>
                  <input type="text" className="w-full bg-slate-900/60 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500" value={settings.company_name} onChange={e => setSettings({...settings, company_name: e.target.value})} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Subscription Plan</label>
                  <select className="w-full bg-slate-900/60 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500" value={settings.subscription_plan} onChange={e => setSettings({...settings, subscription_plan: e.target.value})}>
                    <option value="PAY_AS_YOU_GO">Pay As You Go ($5/mo)</option>
                    <option value="STARTER">Starter ($49/mo)</option>
                    <option value="GROWTH">Growth ($89/mo)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Notification Email</label>
                  <input type="email" className="w-full bg-slate-900/60 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500" value={settings.notify_email} onChange={e => setSettings({...settings, notify_email: e.target.value})} placeholder="Alerts sent here" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Custom Per-Minute Rate ($)</label>
                  <input type="number" step="0.001" className="w-full bg-slate-900/60 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500" value={settings.rate_per_minute} onChange={e => setSettings({...settings, rate_per_minute: e.target.value === '' ? null : e.target.value})} placeholder="Leave blank for global default" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Pending Discount Type</label>
                  <select className="w-full bg-slate-900/60 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500" value={settings.pending_discount_type} onChange={e => setSettings({...settings, pending_discount_type: e.target.value})}>
                    <option value="fixed">Fixed Amount ($)</option>
                    <option value="percentage">Percentage (%)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Pending Discount Amount</label>
                  <input type="number" step="0.01" min="0" className="w-full bg-slate-900/60 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500" value={settings.pending_discount_amount} onChange={e => setSettings({...settings, pending_discount_amount: e.target.value})} placeholder="0.00" />
                </div>
              </div>

              <div className="pt-4 border-t border-white/10">
                <h3 className="text-sm font-bold text-white mb-4 uppercase tracking-wider">IVR & Routing</h3>
                
                <div className="space-y-4">
                  <label className="flex items-center space-x-3 cursor-pointer">
                    <input type="checkbox" className="form-checkbox h-5 w-5 text-indigo-500 rounded border-white/20 bg-slate-900" checked={settings.play_ivr_greeting} onChange={e => setSettings({...settings, play_ivr_greeting: e.target.checked})} />
                    <span className="text-white font-medium">Play IVR Greeting Menu</span>
                  </label>

                  {settings.play_ivr_greeting && (
                    <div className="pl-8">
                      <label className="block text-sm font-medium text-slate-400 mb-2">Custom Greeting Text (Optional)</label>
                      <textarea className="w-full bg-slate-900/60 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500 h-24" value={settings.ivr_greeting} onChange={e => setSettings({...settings, ivr_greeting: e.target.value})} placeholder="E.g. Thank you for calling Homelystic..."></textarea>
                    </div>
                  )}

                  <label className="flex items-center space-x-3 cursor-pointer">
                    <input type="checkbox" className="form-checkbox h-5 w-5 text-indigo-500 rounded border-white/20 bg-slate-900" checked={settings.receive_office_calls} onChange={e => setSettings({...settings, receive_office_calls: e.target.checked})} />
                    <span className="text-white font-medium">Route 'Press 1' directly to Web Dialer (Office)</span>
                  </label>

                  <label className="flex items-center space-x-3 cursor-pointer">
                    <input type="checkbox" className="form-checkbox h-5 w-5 text-indigo-500 rounded border-white/20 bg-slate-900" checked={settings.enable_listing_lookup} onChange={e => setSettings({...settings, enable_listing_lookup: e.target.checked})} />
                    <span className="text-white font-medium">Enable Property Lookup (Press 2)</span>
                  </label>
                </div>
              </div>

              <div className="pt-4 flex justify-end">
                <button type="submit" disabled={savingSettings} className="bg-indigo-500 hover:bg-indigo-600 text-white px-6 py-2.5 rounded-xl font-semibold transition-colors disabled:opacity-50">
                  {savingSettings ? 'Saving...' : 'Save Configuration'}
                </button>
              </div>
            </form>
          </div>

        </div>

        {/* RIGHT COLUMN: Agents & Logs */}
        <div className="space-y-8">
          
          <div className="bg-slate-900/50 border border-white/10 rounded-2xl overflow-hidden">
            <div className="px-6 py-5 border-b border-white/10 bg-white/[0.02]">
              <h2 className="text-lg font-semibold text-white">Agents</h2>
            </div>
            <div className="p-0 max-h-80 overflow-y-auto custom-scrollbar divide-y divide-white/5">
              {data.agents.map(agent => (
                <div key={agent.id} className="p-4 hover:bg-white/[0.02] transition-colors flex justify-between items-center">
                  <div>
                    <div className="text-white font-medium">{agent.name || 'Unnamed Agent'}</div>
                    <div className="text-xs text-slate-400">{agent.cell_phone || 'No phone'}</div>
                  </div>
                  {agent.cell_phone && (
                    <button onClick={() => handleDial(agent.cell_phone)} className="text-indigo-400 hover:text-indigo-300">Call</button>
                  )}
                </div>
              ))}
              {data.agents.length === 0 && <div className="p-6 text-slate-400 text-center text-sm">No agents found.</div>}
            </div>
          </div>

          <div className="bg-slate-900/50 border border-white/10 rounded-2xl overflow-hidden">
            <div className="px-6 py-5 border-b border-white/10 bg-white/[0.02]">
              <h2 className="text-lg font-semibold text-white">Recent Call Logs</h2>
            </div>
            <div className="p-0 max-h-[500px] overflow-y-auto custom-scrollbar divide-y divide-white/5">
              {data.callLogs.map(log => (
                <div key={log.id} className="p-4 hover:bg-white/[0.02] transition-colors">
                  <div className="flex justify-between items-start mb-1">
                    <span className={`text-xs font-bold uppercase ${log.call_type === 'inbound' ? 'text-emerald-400' : 'text-blue-400'}`}>
                      {log.call_type}
                    </span>
                    <span className="text-xs text-slate-500">{new Date(log.created_at).toLocaleString()}</span>
                  </div>
                  <div className="text-sm text-white mb-1">
                    <span className="text-slate-400">From:</span> {log.from_number}
                  </div>
                  <div className="text-sm text-white mb-2">
                    <span className="text-slate-400">To:</span> {log.to_number}
                  </div>
                  <div className="flex justify-between items-center text-xs mb-2">
                    <span className={`px-2 py-0.5 rounded uppercase font-bold tracking-wider ${
                      log.status === 'completed' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 
                      log.status === 'missed' ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 
                      'bg-slate-800 text-slate-300 border border-slate-700'
                    }`}>
                      {log.status}
                    </span>
                    <span className="text-slate-400 font-mono">{log.duration}s</span>
                  </div>
                  
                  {log.audio_link && (
                    <div className="flex items-center space-x-2 mt-3 pt-3 border-t border-white/5">
                      <audio 
                        controls 
                        src={log.audio_link}
                        className="h-8 w-full [&::-webkit-media-controls-panel]:bg-slate-800 [&::-webkit-media-controls-current-time-display]:text-white [&::-webkit-media-controls-time-remaining-display]:text-white"
                      />
                      <button 
                        onClick={async () => {
                          if(confirm('Permanently delete this recording?')) {
                            try {
                              const token = localStorage.getItem('admin_token');
                              const res = await fetch(`/api/recordings/${log.id}`, { 
                                method: 'DELETE',
                                headers: { 'Authorization': `Bearer ${token}` }
                              });
                              if (res.ok) {
                                setData({...data, callLogs: data.callLogs.map(c => c.id === log.id ? {...c, audio_link: null} : c)});
                              }
                            } catch (e) {
                              console.error(e);
                            }
                          }
                        }}
                        className="text-red-400 hover:text-red-300 transition-colors p-2 rounded-full hover:bg-red-500/10 shrink-0"
                        title="Delete Recording"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                          <path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/>
                          <path fillRule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/>
                        </svg>
                      </button>
                    </div>
                  )}
                </div>
              ))}
              {data.callLogs.length === 0 && <div className="p-6 text-slate-400 text-center text-sm">No recent calls.</div>}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
