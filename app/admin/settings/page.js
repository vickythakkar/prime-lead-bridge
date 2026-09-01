'use client';
import { useState, useEffect } from 'react';

const ADMIN_ORG_ID = '8a564ec4-9544-4b63-ac58-98ec66d69a76';



export default function AdminSettings() {
  const [activeTab, setActiveTab] = useState('Profile');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [profile, setProfile] = useState({ 
    company_name: 'Prime Real Ops', 
    notify_email: 'info@primerealops.com',
    website: '',
    contact_name: '',
    contact_email: '',
    contact_phone: ''
  });
  const [ivr, setIvr] = useState(DEFAULT_IVR);
  const [teammates, setTeammates] = useState([]);

  const token = typeof window !== 'undefined' ? localStorage.getItem('admin_token') : '';

  useEffect(() => {
    async function load() {
      const { createClient } = await import('@supabase/supabase-js');
      const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
      const { data } = await sb.from('organizations').select('company_name, notify_email, ivr_flow_config, ivr_greeting, website, contact_name, contact_email, contact_phone').eq('id', ADMIN_ORG_ID).single();
      if (data) {
        setProfile({ 
          company_name: data.company_name || 'Prime Real Ops', 
          notify_email: data.notify_email || '',
          website: data.website || '',
          contact_name: data.contact_name || '',
          contact_email: data.contact_email || '',
          contact_phone: data.contact_phone || ''
        });
        if (data.ivr_flow_config && data.ivr_flow_config.flow) {
          setIvr({ greeting: data.ivr_greeting || DEFAULT_IVR.greeting, flow: data.ivr_flow_config.flow });
        } else if (data.ivr_flow_config && data.ivr_flow_config.options) {
          // Migration from old flat array to new tree
          const newFlow = {};
          data.ivr_flow_config.options.forEach(opt => {
            let action = 'ring_team';
            if (opt.action === 'route_number') action = 'forward_call';
            if (opt.action === 'voicemail') action = 'voicemail';
            newFlow[opt.key] = { action, duration: 20 };
            if (action === 'forward_call') newFlow[opt.key].phoneNumber = opt.target;
            if (action === 'ring_team') newFlow[opt.key].teamRole = opt.action; 
          });
          setIvr({ greeting: data.ivr_greeting || DEFAULT_IVR.greeting, flow: newFlow });
        }
      }
      
      const { data: teamData } = await sb.from('contacts')
        .select('id, name, phone, custom_fields')
        .eq('organization_id', ADMIN_ORG_ID)
        .order('name');
      if (teamData) setTeammates(teamData.filter(t => t.custom_fields && t.custom_fields.role));
    }
    load();
  }, []);

  async function saveProfile(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const { createClient } = await import('@supabase/supabase-js');
      const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
      await sb.from('organizations').update({ 
        company_name: profile.company_name, 
        notify_email: profile.notify_email,
        website: profile.website,
        contact_name: profile.contact_name,
        contact_email: profile.contact_email,
        contact_phone: profile.contact_phone
      }).eq('id', ADMIN_ORG_ID);
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
      await sb.from('organizations').update({ ivr_greeting: ivr.greeting, ivr_flow_config: { flow: ivr.flow } }).eq('id', ADMIN_ORG_ID);
      setMessage('IVR settings saved!');
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      alert('Error saving IVR');
    } finally {
      setSaving(false);
    }
  }



  const tabs = ['Profile'];

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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Organization Name</label>
              <input type="text" className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500"
                value={profile.company_name} onChange={e => setProfile({ ...profile, company_name: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Website</label>
              <input type="text" placeholder="https://..." className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500"
                value={profile.website} onChange={e => setProfile({ ...profile, website: e.target.value })} />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Contact Person</label>
              <input type="text" className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500"
                value={profile.contact_name} onChange={e => setProfile({ ...profile, contact_name: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Contact Phone</label>
              <input type="tel" className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500"
                value={profile.contact_phone} onChange={e => setProfile({ ...profile, contact_phone: e.target.value })} />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Contact Email</label>
              <input type="email" className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500"
                value={profile.contact_email} onChange={e => setProfile({ ...profile, contact_email: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Notification Email</label>
              <input type="email" placeholder="For alerts..." className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500"
                value={profile.notify_email} onChange={e => setProfile({ ...profile, notify_email: e.target.value })} />
            </div>
          </div>
          <div className="pt-2">
            <button type="submit" disabled={saving} className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-2.5 rounded-lg font-medium transition-colors disabled:opacity-50">
              {saving ? 'Saving...' : 'Save Profile'}
            </button>
          </div>
        </form>
      )}


    </div>
  );
}
