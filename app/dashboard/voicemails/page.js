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
    await supabase.from('voicemails').update({ status: 'listened' }).eq('id', id);
    setVoicemails(voicemails.map(v => v.id === id ? { ...v, status: 'listened' } : v));
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
          <div className="p-12 text-center flex flex-col items-center border-t border-white/5">
            <div className="bg-white/5 w-16 h-16 rounded-full flex items-center justify-center mb-4">
              <span className="text-2xl">🎙️</span>
            </div>
            <h3 className="text-lg font-bold text-white mb-2">No Voicemails</h3>
            <p className="text-slate-400 text-sm">You&apos;re all caught up!</p>
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {voicemails.map((vm) => (
              <div key={vm.id} className={`p-6 transition-colors ${vm.status === 'new' ? 'bg-indigo-500/5' : 'hover:bg-white/5'}`}>
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  
                  <div className="flex items-center gap-4">
                    {vm.status === 'new' ? (
                      <div className="bg-indigo-500 rounded-full h-3 w-3 shadow-[0_0_8px_rgba(99,102,241,0.8)]"></div>
                    ) : (
                      <div className="h-3 w-3 rounded-full bg-slate-700"></div>
                    )}
                    
                    <div>
                      <h4 className="font-bold text-white text-lg">
                        {vm.from_number}
                      </h4>
                      <div className="flex items-center gap-3 text-xs text-slate-400 mt-1">
                        <span>{new Date(vm.created_at).toLocaleString()}</span>
                        {vm.duration > 0 && (
                          <>
                            <span>•</span>
                            <span>{vm.duration} sec</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 w-full md:w-auto mt-4 md:mt-0">
                    <div className="flex-1 md:w-64">
                      {vm.recording_url ? (
                        <audio 
                          controls 
                          src={vm.recording_url}
                          onPlay={() => { if(vm.status === 'new') markListened(vm.id); }}
                          className="h-8 max-w-full [&::-webkit-media-controls-panel]:bg-slate-800 [&::-webkit-media-controls-current-time-display]:text-white [&::-webkit-media-controls-time-remaining-display]:text-white"
                        />
                      ) : (
                        <div className="text-xs text-slate-500 italic">No audio available</div>
                      )}
                    </div>
                    
                    <button 
                      onClick={() => deleteVoicemail(vm.id, vm.recording_url)}
                      className="p-2 text-slate-500 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
                      title="Delete Voicemail"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                        <path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/>
                        <path fillRule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/>
                      </svg>
                    </button>
                  </div>
                  
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
