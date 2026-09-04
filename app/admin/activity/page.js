'use client';
import { useState, useEffect } from 'react';

export default function AdminActivityLog() {
  const [calls, setCalls] = useState([]);
  const [orgs, setOrgs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrg, setSelectedOrg] = useState('8a564ec4-9544-4b63-ac58-98ec66d69a76');
  const [editingNote, setEditingNote] = useState(null); // { id: string, notes: string, saving: boolean }

  const token = typeof window !== 'undefined' ? localStorage.getItem('admin_token') : '';

  useEffect(() => { fetchOrgs(); }, []);
  useEffect(() => { fetchLogs(); }, [selectedOrg]);

  async function fetchOrgs() {
    const res = await fetch('/api/admin/organizations?include_admin=true', { headers: { Authorization: `Bearer ${token}` } });
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
    fetch('/api/admin/call-logs', { method: 'PUT', headers: { Authorization: `Bearer ${token}` } });
  }

  async function handleDeleteRecording(callId) {
    if (!confirm('Permanently delete this recording?')) return;
    const res = await fetch(`/api/recordings/${callId}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
    if (res.ok) setCalls(calls.map(c => c.id === callId ? { ...c, audio_link: null, recording_url: null } : c));
  }

  async function handleSaveNote() {
    if (!editingNote) return;
    setEditingNote(prev => ({ ...prev, saving: true }));
    
    // Instead of directly updating Supabase, Admin uses API routes or we can just fetch
    const res = await fetch(`/api/admin/crm/wrap-up`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}` 
      },
      body: JSON.stringify({
        call_id: editingNote.id,
        notes: editingNote.notes
      })
    });
      
    if (res.ok) {
      setCalls(calls.map(c => c.id === editingNote.id ? { ...c, notes: editingNote.notes } : c));
      setEditingNote(null);
    } else {
      alert("Failed to save note. Please try again.");
      setEditingNote(prev => ({ ...prev, saving: false }));
    }
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
    <div className="animate-in fade-in duration-500 w-full">
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
            <option value="8a564ec4-9544-4b63-ac58-98ec66d69a76">Prime Real Ops (Admin)</option>
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
                  <th className="px-6 py-4 text-sm font-semibold text-slate-300">Type</th>
                  <th className="px-6 py-4 text-sm font-semibold text-slate-300">Organization</th>
                  <th className="px-6 py-4 text-sm font-semibold text-slate-300">Contact / Number</th>
                  <th className="px-6 py-4 text-sm font-semibold text-slate-300 min-w-[200px]">Notes</th>
                  <th className="px-6 py-4 text-sm font-semibold text-slate-300">Date/Time</th>
                  <th className="px-6 py-4 text-sm font-semibold text-slate-300">Duration</th>
                  <th className="px-6 py-4 text-sm font-semibold text-slate-300 min-w-[350px]">Recording & Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {calls.map(call => (
                  <tr key={call.id} className="hover:bg-white/5 transition-colors">
                    <td className="px-5 py-4">
                      {call.call_type === 'outbound' ? (
                        <div className="flex flex-col gap-1 items-start">
                          <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">Outbound</span>
                          {call.status && call.status !== 'completed' && call.status !== 'in-progress' && (
                            <span className="text-[10px] uppercase tracking-wider text-slate-400">{call.status.replace('-', ' ')}</span>
                          )}
                        </div>
                      ) : (
                        <div className="flex flex-col gap-1 items-start">
                          <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">Inbound</span>
                          {call.status === 'voicemail' ? (
                            <span className="text-[10px] uppercase tracking-wider text-purple-400 font-medium">Voicemail</span>
                          ) : call.status && call.status !== 'completed' && call.status !== 'in-progress' ? (
                            <span className="text-[10px] uppercase tracking-wider text-rose-400 font-medium">{call.status.replace('-', ' ')}</span>
                          ) : null}
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-4 text-slate-300 font-medium">
                      {call.organizations?.name || call.organizations?.company_name || 'Unknown'}
                    </td>
                    <td className="px-5 py-4 font-medium text-white">
                      {call.contacts?.name ? (
                        <div className="flex flex-col">
                          <span>{call.contacts.name}</span>
                          <span className="text-xs text-slate-500 font-mono">{call.call_type === 'outbound' ? call.to_number : call.from_number}</span>
                        </div>
                      ) : (
                        <span className="font-mono">{call.call_type === 'outbound' ? call.to_number : call.from_number}</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {call.notes ? (
                        <div className="group relative">
                          <div className="text-sm text-slate-200 italic line-clamp-2">
                            "{call.notes}"
                          </div>
                          {call.notes.length > 60 && (
                            <button 
                              onClick={() => setEditingNote({ id: call.id, notes: call.notes, saving: false })}
                              className="text-xs text-indigo-400 hover:text-indigo-300 mt-1 block"
                            >
                              Read full / Edit
                            </button>
                          )}
                          {call.notes.length <= 60 && (
                            <button 
                              onClick={() => setEditingNote({ id: call.id, notes: call.notes, saving: false })}
                              className="text-xs text-slate-400 hover:text-indigo-400 mt-1 block transition-colors"
                            >
                              Edit Note
                            </button>
                          )}
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-slate-500 italic">No notes</span>
                          <button 
                            onClick={() => setEditingNote({ id: call.id, notes: '', saving: false })}
                            className="text-xs text-indigo-400/70 hover:text-indigo-400 transition-colors"
                          >
                            + Add
                          </button>
                        </div>
                      )}
                      {call.disposition && (
                        <div className="mt-1">
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-medium bg-slate-800 text-slate-400 border border-slate-700 uppercase tracking-wider">{call.disposition}</span>
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-4 text-slate-400 text-sm">
                      {new Date(call.created_at + (call.created_at.includes('T') && !call.created_at.endsWith('Z') && !call.created_at.includes('+') ? 'Z' : '')).toLocaleString(undefined, {
                        year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true
                      })}
                    </td>
                    <td className="px-5 py-4 text-slate-300 text-sm">{call.duration ? `${call.duration}s` : '0s'}</td>
                    <td className="px-5 py-4">
                      <div className="flex flex-col gap-2 w-[320px] shrink-0">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Playback</span>
                          <div className="flex items-center gap-2">
                            <a 
                              href={`/admin/dialer?phone=${encodeURIComponent(call.call_type === 'outbound' ? call.to_number : call.from_number)}`}
                              className="text-slate-400 hover:text-emerald-400 transition-colors p-1.5 rounded-full hover:bg-emerald-500/10 flex items-center gap-1 text-xs"
                              title="Call Back"
                            >
                              <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path fillRule="evenodd" d="M1.5 4.5a3 3 0 0 1 3-3h1.372c.86 0 1.61.586 1.819 1.42l1.105 4.423a1.875 1.875 0 0 1-.694 1.955l-1.293.97c-.135.101-.164.249-.126.352a11.285 11.285 0 0 0 6.697 6.697c.103.038.25.009.352-.126l.97-1.293a1.875 1.875 0 0 1 1.955-.694l4.423 1.105c.834.209 1.42.959 1.42 1.82V19.5a3 3 0 0 1-3 3h-2.25C8.552 22.5 1.5 15.448 1.5 6.75V4.5Z" clipRule="evenodd" /></svg>
                              <span className="font-medium hidden sm:inline">Call Back</span>
                            </a>
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
                        </div>
                        {call.audio_link ? (
                          <audio controls src={call.audio_link} className="h-9 w-[300px] rounded-full [&::-webkit-media-controls-panel]:bg-slate-200" />
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

      {editingNote && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-white/10 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl relative">
            <button 
              onClick={() => setEditingNote(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 16 16">
                <path d="M2.146 2.854a.5.5 0 1 1 .708-.708L8 7.293l5.146-5.147a.5.5 0 0 1 .708.708L8.707 8l5.147 5.146a.5.5 0 0 1-.708.708L8 8.707l-5.146 5.147a.5.5 0 0 1-.708-.708L7.293 8 2.146 2.854Z"/>
              </svg>
            </button>
            <div className="p-6">
              <h3 className="text-xl font-bold text-white mb-4">Edit Note</h3>
              <textarea 
                value={editingNote.notes}
                onChange={(e) => setEditingNote({...editingNote, notes: e.target.value})}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl p-4 text-slate-200 h-48 focus:outline-none focus:border-indigo-500 transition-colors resize-none"
                placeholder="Enter call notes..."
              />
              <div className="flex justify-end gap-3 mt-6">
                <button 
                  onClick={() => setEditingNote(null)}
                  className="px-5 py-2.5 rounded-xl font-medium text-slate-300 hover:text-white hover:bg-white/5 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleSaveNote}
                  disabled={editingNote.saving}
                  className="px-5 py-2.5 rounded-xl font-bold text-white bg-indigo-500 hover:bg-indigo-600 transition-colors disabled:opacity-50"
                >
                  {editingNote.saving ? 'Saving...' : 'Save Note'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
