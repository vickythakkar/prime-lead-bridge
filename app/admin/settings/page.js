'use client';
import { useState, useEffect } from 'react';

const ADMIN_ORG_ID = '8a564ec4-9544-4b63-ac58-98ec66d69a76';

const IVR_ACTIONS = [
  { value: 'route_browser', label: '📞 Route to Browser Dialer' },
  { value: 'route_number', label: '📱 Forward to Phone Number' },
  { value: 'voicemail', label: '🎙️ Send to Voicemail' },
  { value: 'sales', label: '💼 Sales Team' },
  { value: 'support', label: '🛠️ Support Team' },
];

const DEFAULT_IVR = {
  greeting: 'Thank you for calling Prime Real Ops. Please listen carefully as our menu has changed.',
  options: [
    { key: '1', label: 'Sales', action: 'sales', target: '' },
    { key: '2', label: 'Support', action: 'support', target: '' },
    { key: '0', label: 'Operator', action: 'route_browser', target: '' },
  ]
};

export default function AdminSettings() {
  const [activeTab, setActiveTab] = useState('Profile');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [profile, setProfile] = useState({ company_name: 'Prime Real Ops', notify_email: 'info@primerealops.com' });
  const [ivr, setIvr] = useState(DEFAULT_IVR);

  const token = typeof window !== 'undefined' ? localStorage.getItem('admin_token') : '';

  useEffect(() => {
    async function load() {
      const { createClient } = await import('@supabase/supabase-js');
      const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
      const { data } = await sb.from('organizations').select('company_name, notify_email, ivr_flow_config, ivr_greeting').eq('id', ADMIN_ORG_ID).single();
      if (data) {
        setProfile({ company_name: data.company_name || 'Prime Real Ops', notify_email: data.notify_email || '' });
        if (data.ivr_flow_config && data.ivr_flow_config.options) {
          setIvr({ greeting: data.ivr_greeting || DEFAULT_IVR.greeting, options: data.ivr_flow_config.options });
        }
      }
    }
    load();
  }, []);

  async function saveProfile(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const { createClient } = await import('@supabase/supabase-js');
      const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
      await sb.from('organizations').update({ company_name: profile.company_name, notify_email: profile.notify_email }).eq('id', ADMIN_ORG_ID);
      setMessage('Profile saved!');
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      alert('Error saving profile');
    } finally {
      setSaving(false);
    }
  }

  async function saveIvr(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const { createClient } = await import('@supabase/supabase-js');
      const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
      await sb.from('organizations').update({ ivr_greeting: ivr.greeting, ivr_flow_config: { options: ivr.options } }).eq('id', ADMIN_ORG_ID);
      setMessage('IVR settings saved!');
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      alert('Error saving IVR');
    } finally {
      setSaving(false);
    }
  }

  function updateOption(idx, field, value) {
    const opts = [...ivr.options];
    opts[idx] = { ...opts[idx], [field]: value };
    setIvr({ ...ivr, options: opts });
  }

  function addOption() {
    const usedKeys = ivr.options.map(o => o.key);
    const next = ['1','2','3','4','5','6','7','8','9','0','*','#'].find(k => !usedKeys.includes(k)) || '';
    setIvr({ ...ivr, options: [...ivr.options, { key: next, label: 'New Option', action: 'route_browser', target: '' }] });
  }

  function removeOption(idx) {
    setIvr({ ...ivr, options: ivr.options.filter((_, i) => i !== idx) });
  }

  const tabs = ['Profile', 'IVR Flow'];

  return (
    <div className="animate-in fade-in duration-500 max-w-3xl">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-white">Platform Settings</h1>
        <p className="text-slate-400 mt-1">Configure the admin organization profile and IVR routing.</p>
      </header>

      {message && (
        <div className="mb-6 px-4 py-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400 text-sm font-medium">
          ✓ {message}
        </div>
      )}

      <div className="flex gap-1 mb-6 bg-white/5 p-1 rounded-xl w-fit">
        {tabs.map(t => (
          <button key={t} onClick={() => setActiveTab(t)}
            className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === t ? 'bg-indigo-500 text-white shadow' : 'text-slate-400 hover:text-white'}`}>
            {t}
          </button>
        ))}
      </div>

      {activeTab === 'Profile' && (
        <form onSubmit={saveProfile} className="glass-card rounded-2xl p-6 space-y-5">
          <h2 className="text-lg font-bold text-white mb-2">Organization Profile</h2>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Organization Name</label>
            <input type="text" className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500"
              value={profile.company_name} onChange={e => setProfile({ ...profile, company_name: e.target.value })} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Notification Email</label>
            <input type="email" className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500"
              value={profile.notify_email} onChange={e => setProfile({ ...profile, notify_email: e.target.value })} />
          </div>
          <div className="pt-2">
            <button type="submit" disabled={saving} className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-2.5 rounded-lg font-medium transition-colors disabled:opacity-50">
              {saving ? 'Saving...' : 'Save Profile'}
            </button>
          </div>
        </form>
      )}

      {activeTab === 'IVR Flow' && (
        <form onSubmit={saveIvr} className="space-y-6">
          <div className="glass-card rounded-2xl p-6">
            <h2 className="text-lg font-bold text-white mb-4">IVR Greeting</h2>
            <textarea
              rows={3}
              className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500 resize-none"
              value={ivr.greeting}
              onChange={e => setIvr({ ...ivr, greeting: e.target.value })}
              placeholder="Welcome message read by the IVR..."
            />
          </div>

          <div className="glass-card rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-white">Menu Options</h2>
              <button type="button" onClick={addOption}
                className="text-indigo-400 hover:text-indigo-300 text-sm font-medium border border-indigo-500/30 px-3 py-1.5 rounded-lg hover:bg-indigo-500/10 transition-colors">
                + Add Option
              </button>
            </div>
            <div className="space-y-3">
              {ivr.options.map((opt, idx) => (
                <div key={idx} className="flex items-center gap-3 p-4 bg-slate-900/50 rounded-xl border border-white/5">
                  <div className="w-10 h-10 rounded-lg bg-indigo-500/20 flex items-center justify-center text-indigo-400 font-bold shrink-0">
                    {opt.key}
                  </div>
                  <input type="text" placeholder="Label (e.g. Sales)" value={opt.label} onChange={e => updateOption(idx, 'label', e.target.value)}
                    className="flex-1 bg-slate-800/50 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500 min-w-0" />
                  <select value={opt.action} onChange={e => updateOption(idx, 'action', e.target.value)}
                    className="bg-slate-800/50 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500">
                    {IVR_ACTIONS.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
                  </select>
                  {opt.action === 'route_number' && (
                    <input type="text" placeholder="+12125551234" value={opt.target} onChange={e => updateOption(idx, 'target', e.target.value)}
                      className="w-36 bg-slate-800/50 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500 font-mono" />
                  )}
                  <input type="text" placeholder="Key" maxLength={1} value={opt.key} onChange={e => updateOption(idx, 'key', e.target.value)}
                    className="w-12 bg-slate-800/50 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm text-center focus:outline-none focus:border-indigo-500 font-mono" />
                  <button type="button" onClick={() => removeOption(idx)} className="text-slate-500 hover:text-red-400 transition-colors shrink-0">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/><path fillRule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/></svg>
                  </button>
                </div>
              ))}
            </div>
          </div>

          <button type="submit" disabled={saving} className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-2.5 rounded-lg font-medium transition-colors disabled:opacity-50">
            {saving ? 'Saving...' : 'Save IVR Configuration'}
          </button>
        </form>
      )}
    </div>
  );
}
