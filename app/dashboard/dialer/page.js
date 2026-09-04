'use client';
import { useState, useEffect } from 'react';
import { useBrokerDialer } from '../components/BrokerDialerContext';
import { supabase } from '@/lib/supabase';

export default function WebDialer() {
  const {
    device, status, activeCall, callerId, isMuted, callDuration,
    handleDial, handleHangup, toggleMute, handleKeypad, formatDuration, lastDialedNumber
  } = useBrokerDialer();
  
  const [phoneNumber, setPhoneNumber] = useState('');
  const [contactName, setContactName] = useState('');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const phoneParam = urlParams.get('phone');
      if (phoneParam) {
        setPhoneNumber(decodeURIComponent(phoneParam));
      } else if (lastDialedNumber && activeCall) {
        setPhoneNumber(lastDialedNumber);
      }
      const nameParam = urlParams.get('name');
      if (nameParam) {
        setContactName(decodeURIComponent(nameParam));
      }
    }
  }, []);

  // Sync incoming call number to the dialer display
  useEffect(() => {
    if (activeCall && activeCall.parameters && activeCall.parameters.From) {
      // Check if it's an incoming call (we didn't just dial it ourselves)
      if (activeCall.direction === 'INCOMING') {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setPhoneNumber(activeCall.parameters.From);
      } else if (status === 'Connected' && !phoneNumber && lastDialedNumber) {
        setPhoneNumber(lastDialedNumber);
      }
    } else if (activeCall && !phoneNumber && lastDialedNumber) {
      setPhoneNumber(lastDialedNumber);
    }
  }, [activeCall, status, lastDialedNumber]);

  // Live lookup contact name when phone number changes
  useEffect(() => {
    async function lookupName() {
      if (!phoneNumber || phoneNumber.length < 10) {
        setContactName('');
        return;
      }
      // Remove all non-numeric characters for search
      const cleanPhone = phoneNumber.replace(/\D/g, '');
      if (cleanPhone.length < 10) return;
      
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      
      const { data: agentData } = await supabase.from('agents').select('organization_id').eq('id', session.user.id).single();
      if (!agentData) return;

      // Check contacts
      const { data: contact } = await supabase
        .from('contacts')
        .select('name')
        .eq('organization_id', agentData.organization_id)
        .ilike('phone', `%${cleanPhone.slice(-10)}%`)
        .maybeSingle();
      
      if (contact) {
        setContactName(contact.name);
        return;
      }

      // Check leads if not in contacts
      const { data: lead } = await supabase
        .from('leads')
        .select('name')
        .eq('organization_id', agentData.organization_id)
        .ilike('phone', `%${cleanPhone.slice(-10)}%`)
        .maybeSingle();

      if (lead) {
        setContactName(lead.name);
      } else {
        setContactName(''); // Clear it if neither contact nor lead is found!
      }
    }
    
    // Always run the lookup when the number changes, even if we had a name previously
    const timeoutId = setTimeout(() => lookupName(), 500);
    return () => clearTimeout(timeoutId);
  }, [phoneNumber]);

  function localHandleDial() {
    if (!phoneNumber) {
      alert("Please enter a phone number.");
      return;
    }
    handleDial(phoneNumber);
  }

  function localHandleKeypad(digit) {
    if (activeCall) {
      handleKeypad(digit);
    } else {
      setPhoneNumber(prev => prev + digit);
    }
  }

  return (
    <div className="animate-in fade-in duration-500 flex flex-col items-center justify-center min-h-[80vh]">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Web Dialer</h1>
        <p className="text-slate-400">Make outbound calls directly from your browser.</p>
      </div>

      <div className="glass-card rounded-3xl w-full max-w-sm overflow-hidden border border-white/10 shadow-2xl relative">
        <div className={`absolute top-0 inset-x-0 h-1 blur-xl transition-all ${activeCall ? 'bg-emerald-500 shadow-[0_0_50px_rgba(16,185,129,0.8)]' : 'bg-indigo-500 shadow-[0_0_30px_rgba(79,70,229,0.5)]'}`} />
        
        <div className="p-8 pb-4 flex flex-col items-center">
          <div className="mb-2 text-xs font-bold text-slate-500 uppercase tracking-wider">
            {callerId ? `Calling From: ${callerId}` : 'Calling From: Unknown'}
          </div>
          
          <div className={`text-sm font-medium mb-6 px-4 py-1.5 rounded-full border ${
            status === 'Connected' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
            status === 'Ready to Call' ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' :
            'bg-slate-800 text-slate-400 border-slate-700'
          }`}>
            <span className="flex items-center gap-2">
              {status === 'Connected' && <span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span><span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span></span>}
              {status}
            </span>
          </div>

          <div className={`h-16 w-full flex flex-col items-center justify-center ${contactName ? 'mb-2' : 'mb-6'}`}>
            <input 
              type="text" 
              value={phoneNumber} 
              onChange={(e) => setPhoneNumber(e.target.value)}
              placeholder="(555) 555-5555"
              className="bg-transparent text-center text-3xl font-light text-white tracking-wider outline-none w-full"
            />
          </div>

          {contactName && (
            <div className="text-emerald-400 font-medium mb-4 text-center">
              {contactName}
            </div>
          )}

          {activeCall && (
            <div className="text-2xl font-mono text-emerald-400 mb-6 font-light">
              {formatDuration(callDuration)}
            </div>
          )}

          <div className="grid grid-cols-3 gap-4 w-full mb-8">
            {['1','2','3','4','5','6','7','8','9','*','0','#'].map((key) => (
              <button
                key={key}
                onClick={() => localHandleKeypad(key)}
                className="h-16 rounded-full bg-white/5 hover:bg-white/10 active:bg-white/20 text-2xl font-light text-white flex items-center justify-center transition-colors border border-white/5"
              >
                {key}
              </button>
            ))}
          </div>

          <div className="flex justify-center items-center gap-6 w-full">
            {activeCall && (
              <button
                onClick={toggleMute}
                className={`h-12 w-12 rounded-full flex items-center justify-center transition-all shadow-lg ${isMuted ? 'bg-amber-500/20 text-amber-500 border border-amber-500/50' : 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700'}`}
                title={isMuted ? "Unmute" : "Mute"}
              >
                {isMuted ? (
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 16 16"><path d="M6.717 3.55A.5.5 0 0 1 7 4v8a.5.5 0 0 1-.812.39L3.825 10.5H1.5A.5.5 0 0 1 1 10V6a.5.5 0 0 1 .5-.5h2.325l2.363-1.89a.5.5 0 0 1 .529-.06zM8.5 4a.5.5 0 0 0 0 1c1.5 0 2.5 1.5 2.5 3s-1 3-2.5 3a.5.5 0 0 0 0 1c2 0 3.5-2 3.5-4s-1.5-4-3.5-4z"/><path d="M11.5 4a.5.5 0 0 0 0 1c2.5 0 4.5 2.5 4.5 5s-2 5-4.5 5a.5.5 0 0 0 0 1c3 0 5.5-3 5.5-6s-2.5-6-5.5-6z"/></svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 16 16"><path d="M11.536 14.01A8.473 8.473 0 0 0 14.026 8a2.81 2.81 0 0 1-1.28-1.503 6.474 6.474 0 0 1-2.21 4.522l.999.991zm-1.096-1.085-1.002-.992A5.474 5.474 0 0 1 7.5 13.5v-1a4.474 4.474 0 0 0 1.528-1.042l1.412 1.467zm-2.022-2.005-1.002-.992a3.475 3.475 0 0 1-.916-1.092l.988 1.018a4.475 4.475 0 0 0 .93 1.066zm-1.042-1.03-1.003-.992a2.475 2.475 0 0 1-.371-.568l.968.997a3.475 3.475 0 0 0 .406.563zm-.985-.975L5.418 7.94a1.474 1.474 0 0 1-.168-.23l.913.939c.068.083.143.16.228.232zM3.825 10.5 6.188 8.61l-.999-.99L3.825 8.5H1.5V6h2.325l.89-.713-1.048-1.04-1.343 1.074A.5.5 0 0 0 2 6v4a.5.5 0 0 0 .5.5h1.325zm2.363-1.89-1.01-1A.5.5 0 0 0 5 7.5h1.188zM7 4a.5.5 0 0 0-.283-.45l.98-.98A1.5 1.5 0 0 1 8 4v2.586l-1-1V4zM2.854.146a.5.5 0 1 0-.708.708l12 12a.5.5 0 0 0 .708-.708l-12-12z"/></svg>
                )}
              </button>
            )}

            {activeCall ? (
              <button
                onClick={handleHangup}
                className="h-16 w-16 rounded-full bg-red-500 hover:bg-red-600 shadow-[0_0_20px_rgba(239,68,68,0.4)] flex items-center justify-center transition-all text-white transform hover:scale-105 active:scale-95"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" fill="currentColor" viewBox="0 0 16 16" style={{ transform: 'rotate(135deg)' }}>
                  <path fillRule="evenodd" d="M1.885.511a1.745 1.745 0 0 1 2.61.163L6.29 2.98c.329.423.445.974.315 1.494l-.547 2.19a.678.678 0 0 0 .178.643l2.457 2.457a.678.678 0 0 0 .644.178l2.189-.547a1.745 1.745 0 0 1 1.494.315l2.306 1.794c.829.645.905 1.87.163 2.611l-1.034 1.034c-.74.74-1.846 1.065-2.877.702a18.634 18.634 0 0 1-7.01-4.42 18.634 18.634 0 0 1-4.42-7.009c-.362-1.03-.037-2.137.703-2.877L1.885.511z"/>
                </svg>
              </button>
            ) : (
              <button
                onClick={localHandleDial}
                disabled={!device || status === 'Initializing...'}
                className="h-16 w-16 rounded-full bg-emerald-500 hover:bg-emerald-600 shadow-[0_0_20px_rgba(16,185,129,0.4)] flex items-center justify-center transition-all text-white disabled:opacity-50 disabled:hover:scale-100 transform hover:scale-105 active:scale-95"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" fill="currentColor" viewBox="0 0 16 16">
                  <path fillRule="evenodd" d="M1.885.511a1.745 1.745 0 0 1 2.61.163L6.29 2.98c.329.423.445.974.315 1.494l-.547 2.19a.678.678 0 0 0 .178.643l2.457 2.457a.678.678 0 0 0 .644.178l2.189-.547a1.745 1.745 0 0 1 1.494.315l2.306 1.794c.829.645.905 1.87.163 2.611l-1.034 1.034c-.74.74-1.846 1.065-2.877.702a18.634 18.634 0 0 1-7.01-4.42 18.634 18.634 0 0 1-4.42-7.009c-.362-1.03-.037-2.137.703-2.877L1.885.511z"/>
                </svg>
              </button>
            )}

            {activeCall && (
              <div className="h-12 w-12 flex items-center justify-center flex-col gap-1 text-red-500" title="Call is being recorded">
                <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse"></div>
                <span className="text-[10px] font-bold tracking-widest uppercase">REC</span>
              </div>
            )}
          </div>
        </div>
      </div>
      
      <div className="mt-8 text-center text-sm text-slate-500 max-w-md">
        Note: The Outbound Dialer requires Twilio API Key and Twilio TwiML App configurations in the environment variables to function properly.
      </div>
    </div>
  );
}
