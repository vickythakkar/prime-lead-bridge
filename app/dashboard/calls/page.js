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
      
      const { data: agentData } = await supabase.from('agents').select('organization_id').limit(1).single();
      if (agentData) {
        const { data, error } = await supabase
          .from('call_logs')
          .select('*, properties(address)')
          .eq('organization_id', agentData.organization_id)
          .order('created_at', { ascending: false });
          
        if (!error && data) {
          // Resolve public URLs for recordings
          const callsWithUrls = data.map(call => {
            if (call.recording_url) {
              const { data: urlData } = supabase.storage
                .from('call_recordings')
                .getPublicUrl(call.recording_url);
              return { ...call, audio_link: urlData.publicUrl };
            }
            return call;
          });
          setCalls(callsWithUrls);
        }
      }
      setLoading(false);
    }
    fetchCalls();
  }, []);

  function exportCSV() {
    const headers = ['Date', 'Caller', 'Property', 'Duration (seconds)', 'Recording URL'];
    const rows = calls.map(c => [
      new Date(c.created_at).toLocaleString(),
      c.caller_number || '',
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
    <div className="animate-in fade-in duration-500 max-w-6xl">
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
            <table className="w-full text-left min-w-[800px]">
              <thead className="bg-white/5 border-b border-white/10">
                <tr>
                  <th className="px-6 py-4 text-sm font-semibold text-slate-300">Caller</th>
                  <th className="px-6 py-4 text-sm font-semibold text-slate-300">Property / Route</th>
                  <th className="px-6 py-4 text-sm font-semibold text-slate-300">Date/Time</th>
                  <th className="px-6 py-4 text-sm font-semibold text-slate-300">Duration</th>
                  <th className="px-6 py-4 text-sm font-semibold text-slate-300 text-right">Recording</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {calls.map((call) => (
                  <tr key={call.id} className="hover:bg-white/5 transition-colors">
                    <td className="px-6 py-4 font-medium text-white">{call.caller_number}</td>
                    <td className="px-6 py-4 text-slate-300">{call.properties?.address || 'Office Menu'}</td>
                    <td className="px-6 py-4 text-slate-400 text-sm">
                      {new Date(call.created_at).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-slate-300 text-sm">
                      {call.duration ? `${call.duration}s` : 'Unknown'}
                    </td>
                    <td className="px-6 py-4 text-right">
                      {call.audio_link ? (
                        <audio 
                          controls 
                          src={call.audio_link}
                          className="h-8 max-w-[200px] ml-auto [&::-webkit-media-controls-panel]:bg-slate-800 [&::-webkit-media-controls-current-time-display]:text-white [&::-webkit-media-controls-time-remaining-display]:text-white"
                        />
                      ) : (
                        <span className="text-xs text-slate-500">No recording</span>
                      )}
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
