'use client';
import { useState, useEffect } from 'react';

export default function AdminVoicemails() {
  const [voicemails, setVoicemails] = useState([]);
  const [orgs, setOrgs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrg, setSelectedOrg] = useState('');

  const token = typeof window !== 'undefined' ? localStorage.getItem('admin_token') : '';


  async function fetchOrgs() {
    const res = await fetch('/api/admin/organizations', { headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json();
    setOrgs(data.organizations || []);
  }

  async function fetchVoicemails() {
    setLoading(true);
    const url = selectedOrg ? `/api/admin/voicemails?org_id=${selectedOrg}` : '/api/admin/voicemails';
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json();
    setVoicemails(data.voicemails || []);
    setLoading(false);
  }

  useEffect(() => { fetchOrgs(); }, []);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchVoicemails(); }, [selectedOrg]);

  async function markListened(id) {
    await fetch('/api/admin/voicemails', { method: 'PATCH', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
    setVoicemails(voicemails.map(v => v.id === id ? { ...v, status: 'listened' } : v));
  }

  async function deleteVoicemail(id) {
    if (!confirm('Permanently delete this voicemail?')) return;
    const res = await fetch('/api/admin/voicemails', { method: 'DELETE', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
    if (res.ok) setVoicemails(voicemails.filter(v => v.id !== id));
  }

  const unreadCount = voicemails.filter(v => !v.listened).length;

  return (
    <div className="animate-in fade-in duration-500">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white">Voicemails</h1>
          <p className="text-slate-400 mt-1">
            {unreadCount > 0 ? <span className="text-indigo-400 font-medium">{unreadCount} new</span> : 'All caught up'} — global voicemail inbox.
          </p>
        </div>
        <select
          value={selectedOrg}
          onChange={e => setSelectedOrg(e.target.value)}
          className="bg-slate-900/50 border border-slate-700 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-indigo-500"
        >
          <option value="">All Organizations</option>
          {orgs.map(o => <option key={o.id} value={o.id}>{o.company_name || o.name}</option>)}
        </select>
      </header>

      <div className="glass-card rounded-2xl overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-400">Loading voicemails...</div>
        ) : voicemails.length === 0 ? (
          <div className="p-12 text-center flex flex-col items-center">
            <div className="bg-white/5 w-16 h-16 rounded-full flex items-center justify-center mb-4">
              <span className="text-2xl">🎙️</span>
            </div>
            <h3 className="text-lg font-bold text-white mb-2">No Voicemails</h3>
            <p className="text-slate-400 text-sm">All caught up across all organizations!</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left min-w-[1000px]">
              <thead className="bg-white/5 border-b border-white/10">
                <tr>
                  <th className="px-5 py-4 text-sm font-semibold text-slate-300 w-16">Status</th>
                  <th className="px-5 py-4 text-sm font-semibold text-slate-300">Organization</th>
                  <th className="px-5 py-4 text-sm font-semibold text-slate-300">Contact / Number</th>
                  <th className="px-5 py-4 text-sm font-semibold text-slate-300">Date/Time</th>
                  <th className="px-5 py-4 text-sm font-semibold text-slate-300">Duration</th>
                  <th className="px-5 py-4 text-sm font-semibold text-slate-300 min-w-[350px]">Recording & Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {voicemails.map(vm => (
                  <tr key={vm.id} className={`transition-colors ${!vm.listened ? 'bg-indigo-500/5' : 'hover:bg-white/5'}`}>
                    <td className="px-5 py-4 text-center">
                      {!vm.listened ? (
                        <div className="inline-block bg-indigo-500 rounded-full h-3 w-3 shadow-[0_0_8px_rgba(99,102,241,0.8)]" title="New"></div>
                      ) : (
                        <div className="inline-block h-3 w-3 rounded-full bg-slate-700" title="Listened"></div>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <span className="text-slate-300 text-sm font-medium">{vm.organizations?.company_name || vm.organizations?.name || 'Unknown Org'}</span>
                    </td>
                    <td className="px-5 py-4 font-medium text-white">
                      {vm.from_number}
                    </td>
                    <td className="px-5 py-4 text-slate-400 text-sm">{new Date(vm.created_at).toLocaleString()}</td>
                    <td className="px-5 py-4 text-slate-300 text-sm">{vm.duration ? `${vm.duration}s` : '0s'}</td>
                    <td className="px-5 py-4">
                      <div className="flex flex-col gap-2 w-[320px] shrink-0">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Playback</span>
                          <div className="flex items-center gap-1">
                            {!vm.listened && (
                              <button
                                onClick={() => markListened(vm.id)}
                                className="text-indigo-400 hover:text-indigo-300 transition-colors p-1.5 rounded-full hover:bg-indigo-500/10 flex items-center gap-1 text-xs font-medium"
                                title="Mark as Listened"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" fill="currentColor" viewBox="0 0 16 16"><path d="M10.97 4.97a.75.75 0 0 1 1.07 1.05l-3.99 4.99a.75.75 0 0 1-1.08.02L4.324 8.384a.75.75 0 1 1 1.06-1.06l2.094 2.093 3.473-4.425a.267.267 0 0 1 .02-.022z"/></svg>
                                Mark Read
                              </button>
                            )}
                            <button
                              onClick={() => deleteVoicemail(vm.id)}
                              className="text-slate-500 hover:text-red-400 transition-colors p-1.5 rounded-full hover:bg-red-500/10"
                              title="Delete"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" fill="currentColor" viewBox="0 0 16 16"><path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/><path fillRule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/></svg>
                            </button>
                          </div>
                        </div>
                        {vm.audio_link ? (
                          <audio 
                            controls 
                            src={vm.audio_link} 
                            onPlay={() => { if (!vm.listened) markListened(vm.id); }}
                            className="h-9 w-[300px] rounded-full [&::-webkit-media-controls-panel]:bg-slate-200" 
                          />
                        ) : (
                          <div className="h-9 w-full bg-white/5 rounded-full flex items-center justify-center border border-white/5">
                            <span className="text-xs text-slate-500">No recording</span>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
