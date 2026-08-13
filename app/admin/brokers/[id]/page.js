'use client';
import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';

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
  const [device, setDevice] = useState(null);
  const [deviceStatus, setDeviceStatus] = useState('Offline');
  const [activeCall, setActiveCall] = useState(null);

  useEffect(() => {
    fetchOrgDetails();
    initTwilioDevice();
    
    return () => {
      if (device) {
        device.destroy();
      }
    };
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
          subscription_plan: json.organization.subscription_plan || 'basic',
          ivr_greeting: json.organization.ivr_greeting || '',
          play_ivr_greeting: json.organization.play_ivr_greeting !== false,
          receive_office_calls: json.organization.receive_office_calls !== false,
          enable_listing_lookup: json.organization.enable_listing_lookup !== false,
          notify_email: json.organization.notify_email || ''
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

  async function initTwilioDevice() {
    try {
      const token = localStorage.getItem('admin_token');
      const res = await fetch('/api/twilio/token', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const { token: twilioToken } = await res.json();
        const { Device } = await import('@twilio/voice-sdk');
        const newDevice = new Device(twilioToken, {
          codecPreferences: ['opus', 'pcmu'],
          fakeLocalDTMF: true,
          enableRingingState: true
        });

        newDevice.on('ready', () => setDeviceStatus('Ready'));
        newDevice.on('error', (err) => setDeviceStatus(`Error: ${err.message}`));
        newDevice.on('connect', (call) => {
          setDeviceStatus('On Call');
          setActiveCall(call);
          call.on('disconnect', () => {
            setDeviceStatus('Ready');
            setActiveCall(null);
          });
        });

        newDevice.register().catch(e => console.warn(e));
        setDevice(newDevice);
      }
    } catch (err) {
      console.error('Twilio init failed:', err);
      setDeviceStatus('Failed to init');
    }
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

  async function handleDial(number) {
    if (!device) return alert('Dialer not ready');
    try {
      await device.connect({ params: { targetNumber: number } });
    } catch (err) {
      alert('Failed to place call');
    }
  }

  function handleHangup() {
    if (activeCall) {
      activeCall.disconnect();
    } else if (device) {
      device.disconnectAll();
    }
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
        <div className="bg-slate-900 border border-white/10 rounded-xl px-4 py-3 flex items-center space-x-4">
          <div className="flex flex-col">
            <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Dialer Status</span>
            <span className="text-sm font-medium text-emerald-400 flex items-center">
              <span className="w-2 h-2 rounded-full bg-emerald-400 mr-2 animate-pulse"></span>
              {deviceStatus}
            </span>
          </div>
          {activeCall && (
            <button onClick={handleHangup} className="bg-red-500/20 text-red-400 hover:bg-red-500/30 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors">
              End Call
            </button>
          )}
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
                    <option value="basic">Basic ($59/mo)</option>
                    <option value="pro">Pro ($99/mo)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Notification Email</label>
                <input type="email" className="w-full bg-slate-900/60 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500" value={settings.notify_email} onChange={e => setSettings({...settings, notify_email: e.target.value})} placeholder="Alerts sent here" />
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
                    <div className="text-white font-medium">{agent.full_name || 'Unnamed Agent'}</div>
                    <div className="text-xs text-slate-400">{agent.email}</div>
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
                  <div className="flex justify-between items-center text-xs">
                    <span className={`px-2 py-0.5 rounded uppercase font-bold tracking-wider ${
                      log.status === 'completed' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 
                      log.status === 'missed' ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 
                      'bg-slate-800 text-slate-300 border border-slate-700'
                    }`}>
                      {log.status}
                    </span>
                    <span className="text-slate-400 font-mono">{log.duration}s</span>
                  </div>
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
