'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export default function CallLogs() {
  const [calls, setCalls] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchCalls() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      
      const { data: agentData } = await supabase.from('agents').select('organization_id').eq('id', session.user.id).single();
      if (agentData) {
        const { data, error } = await supabase
          .from('call_logs')
          .select('*, properties(address), contacts(name)')
          .eq('organization_id', agentData.organization_id)
          .order('created_at', { ascending: false });
          
        if (!error && data) {
          // Resolve public URLs for recordings
          const callsWithUrls = data.map(call => {
            if (call.recording_url) {
              if (call.recording_url.includes('api.twilio.com')) {
                return { ...call, audio_link: `/api/twilio/recording?url=${encodeURIComponent(call.recording_url)}` };
              } else {
                const { data: urlData } = supabase.storage
                  .from('call_recordings')
                  .getPublicUrl(call.recording_url);
                return { ...call, audio_link: urlData.publicUrl };
              }
            }
            return call;
          });
          setCalls(callsWithUrls);

          // Mark as seen
          const unseenIds = data.filter(c => !c.seen).map(c => c.id);
          if (unseenIds.length > 0) {
            await supabase.from('call_logs').update({ seen: true }).in('id', unseenIds);
          }
        }
      }
      setLoading(false);
    }
    fetchCalls();
  }, []);

  function exportCSV() {
    const headers = ['Date', 'Type', 'Contact / Number', 'Property', 'Duration (seconds)', 'Recording URL'];
    const rows = calls.map(c => [
      new Date(c.created_at).toLocaleString(),
      c.call_type || 'inbound',
      c.contacts?.name || (c.call_type === 'outbound' ? c.to_number : c.from_number) || '',
      c.properties?.address || 'Office Menu',
      c.duration || 0,
      c.audio_link || ''
    ]);
    
    let csvContent = "data:text/csv;charset=utf-8," 
      + headers.join(",") + "\n"
      + rows.map(e => e.join(",")).join("\n");
      
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "call_activity_log.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  return (
    <div className="animate-in fade-in duration-500 max-w-6xl mx-auto">
      <header className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white">Call Activity Log</h1>
          <p className="text-slate-400 mt-1">A detailed history of all incoming calls to your routing number.</p>
        </div>
        <button 
          onClick={exportCSV}
          disabled={calls.length === 0}
          className="bg-white/10 hover:bg-white/20 text-white px-5 py-2.5 rounded-lg font-medium transition-colors disabled:opacity-50"
        >
          Download CSV
        </button>
      </header>

      <div className="glass-card rounded-2xl overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-400">Loading call history...</div>
        ) : calls.length === 0 ? (
          <div className="p-12 text-center">
            <div className="text-4xl mb-4">📞</div>
            <h3 className="text-lg font-medium text-white mb-2">No calls logged yet</h3>
            <p className="text-slate-400">Incoming calls from your Twilio number will appear here.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left min-w-[1000px]">
              <thead className="bg-white/5 border-b border-white/10">
                <tr>
                  <th className="px-6 py-4 text-sm font-semibold text-slate-300">Type</th>
                  <th className="px-6 py-4 text-sm font-semibold text-slate-300">Contact / Number</th>
                  <th className="px-6 py-4 text-sm font-semibold text-slate-300">Property / Route</th>
                  <th className="px-6 py-4 text-sm font-semibold text-slate-300">Date/Time</th>
                  <th className="px-6 py-4 text-sm font-semibold text-slate-300">Duration</th>
                  <th className="px-6 py-4 text-sm font-semibold text-slate-300 min-w-[350px]">Recording & Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {calls.map((call) => (
                  <tr key={call.id} className="hover:bg-white/5 transition-colors">
                    <td className="px-6 py-4">
                      {call.call_type === 'outbound' ? (
                        <div className="flex flex-col gap-1 items-start">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">Outbound</span>
                          {call.status && call.status !== 'completed' && call.status !== 'in-progress' && (
                            <span className="text-[10px] uppercase tracking-wider text-slate-400">{call.status.replace('-', ' ')}</span>
                          )}
                        </div>
                      ) : (
                        <div className="flex flex-col gap-1 items-start">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">Inbound</span>
                          {call.status === 'voicemail' ? (
                            <span className="text-[10px] uppercase tracking-wider text-purple-400 font-medium">Voicemail</span>
                          ) : call.status && call.status !== 'completed' && call.status !== 'in-progress' ? (
                            <span className="text-[10px] uppercase tracking-wider text-rose-400 font-medium">{call.status.replace('-', ' ')}</span>
                          ) : null}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 font-medium text-white">
                      {call.contacts?.name ? (
                        <div className="flex flex-col">
                          <span>{call.contacts.name}</span>
                          <span className="text-xs text-slate-500 font-mono">{call.call_type === 'outbound' ? call.to_number : call.from_number}</span>
                        </div>
                      ) : (
                        <span className="font-mono">{call.call_type === 'outbound' ? call.to_number : call.from_number}</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-slate-300">{call.properties?.address || 'Office Menu'}</td>
                    <td className="px-6 py-4 text-slate-400 text-sm">
                      {new Date(call.created_at).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-slate-300 text-sm">
                      {call.duration ? `${call.duration}s` : '0s'}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-2 w-[320px] shrink-0">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Playback</span>
                          <div className="flex items-center gap-2">
                            <a 
                              href={`/dashboard/dialer?phone=${encodeURIComponent(call.call_type === 'outbound' ? call.to_number : call.from_number)}`}
                              className="text-slate-400 hover:text-emerald-400 transition-colors p-1.5 rounded-full hover:bg-emerald-500/10 flex items-center gap-1 text-xs"
                              title="Call Back"
                            >
                              <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path fillRule="evenodd" d="M1.5 4.5a3 3 0 0 1 3-3h1.372c.86 0 1.61.586 1.819 1.42l1.105 4.423a1.875 1.875 0 0 1-.694 1.955l-1.293.97c-.135.101-.164.249-.126.352a11.285 11.285 0 0 0 6.697 6.697c.103.038.25.009.352-.126l.97-1.293a1.875 1.875 0 0 1 1.955-.694l4.423 1.105c.834.209 1.42.959 1.42 1.82V19.5a3 3 0 0 1-3 3h-2.25C8.552 22.5 1.5 15.448 1.5 6.75V4.5Z" clipRule="evenodd" /></svg>
                              <span className="font-medium hidden sm:inline">Call Back</span>
                            </a>
                            {call.audio_link && (
                              <button 
                                onClick={async () => {
                                  if(confirm('Are you sure you want to permanently delete this recording?')) {
                                    try {
                                      const res = await fetch(`/api/recordings/${call.id}`, { method: 'DELETE' });
                                      if (res.ok) {
                                        setCalls(calls.map(c => c.id === call.id ? {...c, audio_link: null} : c));
                                      }
                                    } catch (e) {
                                      console.error(e);
                                    }
                                  }
                                }}
                                className="text-slate-500 hover:text-red-400 transition-colors p-1.5 rounded-full hover:bg-red-500/10"
                                title="Delete Recording"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 16 16">
                                  <path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/>
                                  <path fillRule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/>
                                </svg>
                              </button>
                            )}
                          </div>
                        </div>
                        {call.audio_link ? (
                          <div className="w-full">
                            <audio 
                              controls 
                              src={call.audio_link}
                              className="h-10 w-[300px] rounded-full [&::-webkit-media-controls-panel]:bg-slate-200"
                            />
                          </div>
                        ) : (
                          <div className="h-10 w-full bg-white/5 rounded-full flex items-center justify-center border border-white/5">
                            <span className="text-xs text-slate-500 font-medium">No recording available</span>
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
