'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export default function VoicemailsPage() {
  const [voicemails, setVoicemails] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchVoicemails() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data: agentData } = await supabase
        .from('agents')
        .select('organization_id')
        .eq('id', session.user.id)
        .single();

      if (agentData) {
        const { data } = await supabase
          .from('voicemails')
          .select('*')
          .eq('organization_id', agentData.organization_id)
          .order('created_at', { ascending: false });

        if (data) {
          setVoicemails(data);
        }
      }
      setLoading(false);
    }
    fetchVoicemails();
  }, []);

  const deleteVoicemail = async (id, recordingUrl) => {
    if (!confirm('Are you sure you want to delete this voicemail? This will permanently delete the audio.')) return;
    
    // Use the existing recordings delete API since voicemails are just recordings
    try {
      // First extract the CallSid or filename from the Twilio URL or Supabase URL
      // If it's a supabase storage URL, we can pass it directly
      const res = await fetch(`/api/recordings/${id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'voicemail', url: recordingUrl })
      });
      
      if (res.ok) {
        setVoicemails(voicemails.filter(v => v.id !== id));
      } else {
        alert('Failed to delete voicemail');
      }
    } catch (error) {
      console.error(error);
      alert('Error deleting voicemail');
    }
  };

  const markListened = async (id) => {
    await supabase.from('voicemails').update({ listened: true }).eq('id', id);
    setVoicemails(voicemails.map(v => v.id === id ? { ...v, listened: true } : v));
  };

  return (
    <div className="animate-in fade-in duration-500">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-white">Voicemails</h1>
        <p className="text-slate-400 mt-1">Listen to missed calls and messages.</p>
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
            <p className="text-slate-400 text-sm">You&apos;re all caught up!</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left min-w-[1000px]">
              <thead className="bg-white/5 border-b border-white/10">
                <tr>
                  <th className="px-5 py-4 text-sm font-semibold text-slate-300 w-16">Status</th>
                  <th className="px-5 py-4 text-sm font-semibold text-slate-300">Contact / Number</th>
                  <th className="px-5 py-4 text-sm font-semibold text-slate-300">Date/Time</th>
                  <th className="px-5 py-4 text-sm font-semibold text-slate-300">Duration</th>
                  <th className="px-5 py-4 text-sm font-semibold text-slate-300 min-w-[350px]">Recording & Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {voicemails.map(vm => {
                  let audioLink = vm.recording_url;
                  if (audioLink && audioLink.includes('api.twilio.com')) {
                    audioLink = `/api/twilio/recording?url=${encodeURIComponent(audioLink)}`;
                  }
                  
                  return (
                    <tr key={vm.id} className={`transition-colors ${!vm.listened ? 'bg-indigo-500/5' : 'hover:bg-white/5'}`}>
                      <td className="px-5 py-4 text-center">
                        {!vm.listened ? (
                          <div className="inline-block bg-indigo-500 rounded-full h-3 w-3 shadow-[0_0_8px_rgba(99,102,241,0.8)]" title="New"></div>
                        ) : (
                          <div className="inline-block h-3 w-3 rounded-full bg-slate-700" title="Listened"></div>
                        )}
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
                                onClick={() => deleteVoicemail(vm.id, vm.recording_url)}
                                className="text-slate-500 hover:text-red-400 transition-colors p-1.5 rounded-full hover:bg-red-500/10"
                                title="Delete"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" fill="currentColor" viewBox="0 0 16 16"><path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/><path fillRule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/></svg>
                              </button>
                            </div>
                          </div>
                          {audioLink ? (
                            <audio 
                              controls 
                              src={audioLink} 
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
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
