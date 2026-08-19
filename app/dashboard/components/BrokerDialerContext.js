'use client';
import { createContext, useContext, useState, useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

const DialerContext = createContext();

let Device = null;
if (typeof window !== 'undefined') {
  const Twilio = require('@twilio/voice-sdk');
  Device = Twilio.Device;
}

export function BrokerDialerProvider({ children }) {
  const [device, setDevice] = useState(null);
  const [status, setStatus] = useState('Initializing...');
  const [activeCall, setActiveCall] = useState(null);
  const [callerId, setCallerId] = useState('');
  const [orgId, setOrgId] = useState('');
  const [isMuted, setIsMuted] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [incomingCall, setIncomingCall] = useState(null);

  // Request Notification permissions
  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission !== 'granted' && Notification.permission !== 'denied') {
        Notification.requestPermission();
      }
    }
  }, []);

  // Handle desktop notifications for incoming calls
  useEffect(() => {
    if (incomingCall && typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      const from = incomingCall.parameters?.From || 'Unknown Caller';
      const notification = new Notification('Incoming Call', {
        body: `Incoming call from ${from}`,
        requireInteraction: true
      });

      notification.onclick = () => {
        window.focus();
        notification.close();
      };

      const closeNotification = () => notification.close();
      
      incomingCall.on('accept', closeNotification);
      incomingCall.on('reject', closeNotification);
      incomingCall.on('disconnect', closeNotification);
      incomingCall.on('cancel', closeNotification);

      return closeNotification;
    }
  }, [incomingCall]);
  
  const timerRef = useRef(null);
  const pathname = usePathname();

  useEffect(() => {
    async function setupDevice() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        // Fetch organization info
        const { data: agentData } = await supabase.from('agents').select('organization_id').eq('id', session.user.id).single();
        if (agentData) {
          setOrgId(agentData.organization_id);
          const { data: numData } = await supabase
            .from('organization_numbers')
            .select('phone_number')
            .eq('organization_id', agentData.organization_id)
            .limit(1)
            .single();
          if (numData) setCallerId(numData.phone_number);
        }

        const response = await fetch('/api/twilio/token', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${session.access_token}` }
        });
        
        if (!response.ok) throw new Error('Failed to fetch token');

        const data = await response.json();
        const newDevice = new Device(data.token, {
          codecPreferences: ['opus', 'pcmu'],
          fakeLocalDTMF: true,
          enableRingingState: true
        });

        newDevice.on('ready', () => setStatus('Ready to Call'));
        newDevice.on('error', (error) => {
          console.error('Twilio.Device Error:', error);
          if (error.message.includes('permission')) {
            setStatus('Microphone Permission Denied');
          } else {
            setStatus('Error: ' + error.message);
          }
        });
        
        newDevice.on('connect', (conn) => {
          setStatus('Connected');
          setActiveCall(conn);
          startTimer();
        });
        
        newDevice.on('incoming', (call) => {
          setStatus('Incoming Call...');
          setIncomingCall(call);

          call.on('cancel', () => {
            setIncomingCall(null);
            setStatus('Ready to Call');
          });

          call.on('disconnect', () => {
            setIncomingCall(null);
            setStatus('Ready to Call');
          });
          
          call.on('reject', () => {
            setIncomingCall(null);
            setStatus('Ready to Call');
          });
        });

        newDevice.on('disconnect', () => {
          setStatus('Ready to Call');
          setActiveCall(null);
          setIsMuted(false);
          stopTimer();
        });

        setStatus('Ready to Call');
        newDevice.register().catch(e => {
          console.warn('Registration failed:', e);
          if (e.message && e.message.includes('permission')) {
            setStatus('Mic Permission Required');
          }
        });
        
        setDevice(newDevice);
      } catch (err) {
        setStatus('Configuration Error. Ensure TWILIO_API_KEY is set.');
        console.error(err);
      }
    }
    
    if (Device && !device) {
      setupDevice();
    }
  }, []);

  function startTimer() {
    setCallDuration(0);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setCallDuration(prev => prev + 1);
    }, 1000);
  }

  function stopTimer() {
    if (timerRef.current) clearInterval(timerRef.current);
  }

  function formatDuration(sec) {
    const m = Math.floor(sec / 60).toString().padStart(2, '0');
    const s = (sec % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  }

  async function handleDial(phoneNumber) {
    if (!device) return;
    if (!phoneNumber) return;
    
    setStatus('Dialing...');
    try {
      const call = await device.connect({ 
        params: { 
          targetNumber: phoneNumber,
          callerId: callerId || '',
          orgId: orgId || ''
        } 
      });
      
      setActiveCall(call);
      setIsMuted(false);

      call.on('accept', () => {
        setStatus('Connected');
        startTimer();
      });

      call.on('disconnect', () => {
        setStatus('Ready to Call');
        setActiveCall(null);
        setIsMuted(false);
        stopTimer();
      });

      call.on('error', (err) => {
        setStatus('Call Failed');
        setActiveCall(null);
        stopTimer();
      });
      
      call.on('reject', () => {
        setStatus('Call Rejected');
        setActiveCall(null);
        stopTimer();
      });
    } catch (err) {
      setStatus('Call Failed');
    }
  }

  function handleHangup() {
    if (device) device.disconnectAll();
  }

  function acceptIncoming() {
    if (incomingCall) {
      incomingCall.accept();
      
      incomingCall.on('disconnect', () => {
        setStatus('Ready to Call');
        setActiveCall(null);
        setIsMuted(false);
        stopTimer();
      });

      incomingCall.on('error', (err) => {
        setStatus('Call Error');
        setActiveCall(null);
        stopTimer();
      });

      setActiveCall(incomingCall);
      setIncomingCall(null);
      setStatus('Connected');
      startTimer();
    }
  }

  function rejectIncoming() {
    if (incomingCall) {
      incomingCall.reject();
      setIncomingCall(null);
      setStatus('Ready to Call');
    }
  }

  function toggleMute() {
    if (activeCall) {
      const newMuted = !isMuted;
      activeCall.mute(newMuted);
      setIsMuted(newMuted);
    }
  }

  function handleKeypad(digit) {
    if (activeCall) {
      activeCall.sendDigits(digit);
    }
  }

  const showFloatingBar = activeCall && pathname !== '/dashboard/dialer';

  return (
    <DialerContext.Provider value={{
      device, status, activeCall, callerId, isMuted, callDuration,
      incomingCall, handleDial, handleHangup, toggleMute, handleKeypad, formatDuration,
      acceptIncoming, rejectIncoming
    }}>
      {children}
      
      {incomingCall && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[100] flex items-center justify-center animate-in fade-in">
          <div className="bg-slate-900 border border-slate-700 shadow-2xl rounded-3xl p-8 w-[350px] animate-in zoom-in-95 flex flex-col items-center text-center relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 via-emerald-400 to-indigo-500 animate-pulse"></div>
            <div className="w-20 h-20 bg-indigo-500/20 text-indigo-400 rounded-full flex items-center justify-center mb-6 relative">
              <span className="absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-25 animate-ping"></span>
              <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" fill="currentColor" viewBox="0 0 16 16">
                <path d="M3.654 1.328a.678.678 0 0 0-1.015-.063L1.605 2.3c-.483.484-.661 1.169-.45 1.77a17.568 17.568 0 0 0 4.168 6.608 17.569 17.569 0 0 0 6.608 4.168c.601.211 1.286.033 1.77-.45l1.034-1.034a.678.678 0 0 0-.063-1.015l-2.307-1.794a.678.678 0 0 0-.58-.122l-2.19.547a1.745 1.745 0 0 1-1.657-.459L5.482 8.062a1.745 1.745 0 0 1-.46-1.657l.548-2.19a.678.678 0 0 0-.122-.58L3.654 1.328zM1.884.511a1.745 1.745 0 0 1 2.612.163L6.29 2.98c.329.423.445.974.315 1.494l-.547 2.19a.678.678 0 0 0 .178.643l2.457 2.457a.678.678 0 0 0 .644.178l2.189-.547a1.745 1.745 0 0 1 1.494.315l2.306 1.794c.829.645.905 1.87.163 2.611l-1.034 1.034c-.74.74-1.846 1.065-2.877.702a18.634 18.634 0 0 1-7.01-4.42 18.634 18.634 0 0 1-4.42-7.009c-.362-1.03-.037-2.137.703-2.877L1.885.511z"/>
              </svg>
            </div>
            <h3 className="text-2xl font-bold text-white mb-2">Incoming Call</h3>
            <p className="text-slate-400 font-mono mb-8 text-lg">{incomingCall.parameters?.From || 'Unknown Caller'}</p>
            
            <div className="flex gap-4 w-full">
              <button 
                onClick={rejectIncoming}
                className="flex-1 bg-red-500/10 hover:bg-red-500/20 text-red-500 font-bold py-3.5 rounded-xl transition-colors border border-red-500/20"
              >
                Decline
              </button>
              <button 
                onClick={acceptIncoming}
                className="flex-1 bg-emerald-500 hover:bg-emerald-400 text-white font-bold py-3.5 rounded-xl transition-all shadow-[0_0_20px_rgba(16,185,129,0.4)] transform hover:scale-105 active:scale-95"
              >
                Accept
              </button>
            </div>
          </div>
        </div>
      )}

      {showFloatingBar && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-10 fade-in duration-300">
          <div className="glass-card bg-slate-900/90 backdrop-blur-xl border border-white/10 shadow-2xl rounded-full px-6 py-3 flex items-center gap-6">
            <div className="flex items-center gap-3">
              <div className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
              </div>
              <div className="flex flex-col">
                <span className="text-white font-medium text-sm leading-tight">Call in Progress</span>
                <span className="text-emerald-400 font-mono text-xs font-bold tracking-wider">{formatDuration(callDuration)}</span>
              </div>
            </div>
            
            <div className="h-8 w-px bg-white/10 mx-2"></div>
            
            <div className="flex items-center gap-3">
              <button
                onClick={toggleMute}
                className={`h-10 w-10 rounded-full flex items-center justify-center transition-all ${isMuted ? 'bg-amber-500/20 text-amber-500 border border-amber-500/50' : 'bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700'}`}
                title={isMuted ? "Unmute" : "Mute"}
              >
                {isMuted ? (
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M6.717 3.55A.5.5 0 0 1 7 4v8a.5.5 0 0 1-.812.39L3.825 10.5H1.5A.5.5 0 0 1 1 10V6a.5.5 0 0 1 .5-.5h2.325l2.363-1.89a.5.5 0 0 1 .529-.06zM8.5 4a.5.5 0 0 0 0 1c1.5 0 2.5 1.5 2.5 3s-1 3-2.5 3a.5.5 0 0 0 0 1c2 0 3.5-2 3.5-4s-1.5-4-3.5-4z"/><path d="M11.5 4a.5.5 0 0 0 0 1c2.5 0 4.5 2.5 4.5 5s-2 5-4.5 5a.5.5 0 0 0 0 1c3 0 5.5-3 5.5-6s-2.5-6-5.5-6z"/></svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M11.536 14.01A8.473 8.473 0 0 0 14.026 8a2.81 2.81 0 0 1-1.28-1.503 6.474 6.474 0 0 1-2.21 4.522l.999.991zm-1.096-1.085-1.002-.992A5.474 5.474 0 0 1 7.5 13.5v-1a4.474 4.474 0 0 0 1.528-1.042l1.412 1.467zm-2.022-2.005-1.002-.992a3.475 3.475 0 0 1-.916-1.092l.988 1.018a4.475 4.475 0 0 0 .93 1.066zm-1.042-1.03-1.003-.992a2.475 2.475 0 0 1-.371-.568l.968.997a3.475 3.475 0 0 0 .406.563zm-.985-.975L5.418 7.94a1.474 1.474 0 0 1-.168-.23l.913.939c.068.083.143.16.228.232zM3.825 10.5 6.188 8.61l-.999-.99L3.825 8.5H1.5V6h2.325l.89-.713-1.048-1.04-1.343 1.074A.5.5 0 0 0 2 6v4a.5.5 0 0 0 .5.5h1.325zm2.363-1.89-1.01-1A.5.5 0 0 0 5 7.5h1.188zM7 4a.5.5 0 0 0-.283-.45l.98-.98A1.5 1.5 0 0 1 8 4v2.586l-1-1V4zM2.854.146a.5.5 0 1 0-.708.708l12 12a.5.5 0 0 0 .708-.708l-12-12z"/></svg>
                )}
              </button>
              
              <Link href="/dashboard/dialer" className="h-10 w-10 rounded-full bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 flex items-center justify-center transition-all" title="Return to Dialer">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                  <path d="M14 1a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1h12zM2 0a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V2a2 2 0 0 0-2-2H2z"/>
                  <path d="M4 4h8v2H4V4zm0 3h8v2H4V7zm0 3h5v2H4v-2z"/>
                </svg>
              </Link>
              
              <button
                onClick={handleHangup}
                className="h-10 w-10 rounded-full bg-red-500 hover:bg-red-600 shadow-[0_0_15px_rgba(239,68,68,0.4)] flex items-center justify-center transition-all text-white transform hover:scale-105 active:scale-95"
                title="Hang up"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 16 16" style={{ transform: 'rotate(135deg)' }}>
                  <path fillRule="evenodd" d="M1.885.511a1.745 1.745 0 0 1 2.61.163L6.29 2.98c.329.423.445.974.315 1.494l-.547 2.19a.678.678 0 0 0 .178.643l2.457 2.457a.678.678 0 0 0 .644.178l2.189-.547a1.745 1.745 0 0 1 1.494.315l2.306 1.794c.829.645.905 1.87.163 2.611l-1.034 1.034c-.74.74-1.846 1.065-2.877.702a18.634 18.634 0 0 1-7.01-4.42 18.634 18.634 0 0 1-4.42-7.009c-.362-1.03-.037-2.137.703-2.877L1.885.511z"/>
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}
    </DialerContext.Provider>
  );
}

export function useBrokerDialer() {
  return useContext(DialerContext);
}
