'use client';
import { useState, useEffect } from 'react';

export default function AdminActivityLog() {
  const [calls, setCalls] = useState([]);
  const [orgs, setOrgs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrg, setSelectedOrg] = useState('8a564ec4-9544-4b63-ac58-98ec66d69a76');

  const token = typeof window !== 'undefined' ? localStorage.getItem('admin_token') : '';

  useEffect(() => { fetchOrgs(); }, []);
  useEffect(() => { fetchLogs(); }, [selectedOrg]);

  async function fetchOrgs() {
    const res = await fetch('/api/admin/organizations', { headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json();
    setOrgs(data.organizations || []);
  }

  async function fetchLogs() {
    setLoading(true);
    const url = selectedOrg ? `/api/admin/call-logs?org_id=${selectedOrg}` : '/api/admin/call-logs';
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json();
    setCalls(data.logs || []);
    setLoading(false);
  }

  async function handleDeleteRecording(callId) {
    if (!confirm('Permanently delete this recording?')) return;
    const res = await fetch(`/api/recordings/${callId}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
    if (res.ok) setCalls(calls.map(c => c.id === callId ? { ...c, audio_link: null, recording_url: null } : c));
  }

  function exportCSV() {
    const headers = ['Date', 'Org', 'Type', 'From', 'To', 'Duration', 'Status'];
    const rows = calls.map(c => [
      new Date(c.created_at).toLocaleString(),
      c.organizations?.company_name || c.organizations?.name || '',
      c.call_type || 'inbound',
      c.from_number || '',
      c.to_number || '',
      `${c.duration || 0}s`,
      c.status || ''
    ]);
    const csv = 'data:text/csv;charset=utf-8,' + headers.join(',') + '\n' + rows.map(r => r.join(',')).join('\n');
    const link = document.createElement('a');
    link.href = encodeURI(csv);
    link.download = 'admin_activity_log.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  return (
    <div className="animate-in fade-in duration-500 max-w-7xl mx-auto">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white">Activity Log</h1>
          <p className="text-slate-400 mt-1">Global call history across all broker organizations.</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={selectedOrg}
            onChange={e => setSelectedOrg(e.target.value)}
            className="bg-slate-900/50 border border-slate-700 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-indigo-500"
          >
            <option value="">All Organizations</option>
            {orgs.map(o => <option key={o.id} value={o.id}>{o.company_name || o.name}</option>)}
          </select>
          <button onClick={exportCSV} disabled={calls.length === 0} className="bg-white/10 hover:bg-white/20 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50">
            Download CSV
          </button>
        </div>
      </header>

      <div className="glass-card rounded-2xl overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-400">Loading call history...</div>
        ) : calls.length === 0 ? (
          <div className="p-12 text-center">
            <div className="text-4xl mb-4">📞</div>
            <h3 className="text-lg font-medium text-white mb-2">No calls logged</h3>
            <p className="text-slate-400">Call activity will appear here once brokers make or receive calls.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left min-w-[1000px]">
              <thead className="bg-white/5 border-b border-white/10">
                <tr>
                  <th className="px-5 py-4 text-sm font-semibold text-slate-300">Type</th>
                  <th className="px-5 py-4 text-sm font-semibold text-slate-300">Organization</th>
                  <th className="px-5 py-4 text-sm font-semibold text-slate-300">Contact / Number</th>
                  <th className="px-5 py-4 text-sm font-semibold text-slate-300">Date/Time</th>
                  <th className="px-5 py-4 text-sm font-semibold text-slate-300">Duration</th>
                  <th className="px-5 py-4 text-sm font-semibold text-slate-300">Recording & Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {calls.map(call => (
                  <tr key={call.id} className="hover:bg-white/5 transition-colors">
                    <td className="px-5 py-4">
                      {call.call_type === 'outbound' ? (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">Outbound</span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">Inbound</span>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <span className="text-slate-300 text-sm font-medium">{call.organizations?.company_name || call.organizations?.name || '—'}</span>
                    </td>
                    <td className="px-5 py-4 font-medium text-white">
                      <div className="flex flex-col">
                        <span>{call.contacts?.name || (call.call_type === 'outbound' ? call.to_number : call.from_number)}</span>
                        {call.contacts?.name && <span className="text-xs text-slate-500 font-mono">{call.call_type === 'outbound' ? call.to_number : call.from_number}</span>}
                      </div>
                    </td>
                    <td className="px-5 py-4 text-slate-400 text-sm">{new Date(call.created_at).toLocaleString()}</td>
                    <td className="px-5 py-4 text-slate-300 text-sm">{call.duration ? `${call.duration}s` : '0s'}</td>
                    <td className="px-5 py-4">
                      <div className="flex flex-col gap-2 max-w-xs">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Playback</span>
                          {call.audio_link && (
                            <button
                              onClick={() => handleDeleteRecording(call.id)}
                              className="text-slate-500 hover:text-red-400 transition-colors p-1.5 rounded-full hover:bg-red-500/10"
                              title="Delete Recording"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" fill="currentColor" viewBox="0 0 16 16"><path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/><path fillRule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/></svg>
                            </button>
                          )}
                        </div>
                        {call.audio_link ? (
                          <audio controls src={call.audio_link} className="h-9 w-full min-w-[260px] rounded-full [&::-webkit-media-controls-panel]:bg-slate-200" />
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
