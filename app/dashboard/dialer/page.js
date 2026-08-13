'use client';
import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';

// We import the Device dynamically to prevent SSR issues with browser APIs
let Device = null;
if (typeof window !== 'undefined') {
  const Twilio = require('@twilio/voice-sdk');
  Device = Twilio.Device;
}

export default function WebDialer() {
  const [loading, setLoading] = useState(true);
  const [device, setDevice] = useState(null);
  const [status, setStatus] = useState('Initializing...');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [activeCall, setActiveCall] = useState(null);
  const [callerId, setCallerId] = useState(''); // The Twilio number the agent is dialing from

  const [callDuration, setCallDuration] = useState(0);
  const timerRef = useRef(null);

  useEffect(() => {
    async function setupDevice() {
      // Fetch caller ID (Twilio Number)
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const { data: agentData } = await supabase.from('agents').select('organization_id').limit(1).single();
        if (agentData) {
          const { data: numData } = await supabase
            .from('organization_numbers')
            .select('phone_number')
            .eq('organization_id', agentData.organization_id)
            .limit(1)
            .single();
          if (numData) {
            setCallerId(numData.phone_number);
          }
        }
      }

      // Fetch Token
      try {
        const response = await fetch('/api/twilio/token', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session?.access_token}`
          }
        });
        
        if (!response.ok) {
          throw new Error('Failed to fetch token');
        }

        const data = await response.json();
        const newDevice = new Device(data.token, {
          codecPreferences: ['opus', 'pcmu'],
          fakeLocalDTMF: true,
          enableRingingState: true
        });

        newDevice.on('ready', () => {
          setStatus('Ready to Call');
        });

        newDevice.on('error', (error) => {
          console.error('Twilio.Device Error:', error);
          setStatus('Error: ' + error.message);
        });

        newDevice.on('connect', (conn) => {
          setStatus('Connected');
          setActiveCall(conn);
          startTimer();
        });

        newDevice.on('disconnect', () => {
          setStatus('Ready to Call');
          setActiveCall(null);
          stopTimer();
        });

        // Do not await register() because it might block on browser microphone permissions
        // We just let it run in the background. Outbound calls will still work.
        newDevice.register().catch(e => console.warn('Registration failed (might need mic permission):', e));
        
        setDevice(newDevice);
      } catch (err) {
        setStatus('Configuration Error. Ensure TWILIO_API_KEY is set.');
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    
    if (Device) {
      setupDevice();
    }
  }, []);

  function startTimer() {
    setCallDuration(0);
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

  async function handleDial() {
    if (!device) return;
    if (!phoneNumber) {
      alert("Please enter a phone number.");
      return;
    }
    
    setStatus('Dialing...');
    try {
      // Create the outbound call
      const call = await device.connect({ 
        params: { 
          targetNumber: phoneNumber,
          callerId: callerId || ''
        } 
      });
      
      setActiveCall(call);

      // Attach event listeners to the specific Call object
      call.on('accept', () => {
        setStatus('Connected');
        startTimer();
      });

      call.on('disconnect', () => {
        setStatus('Ready to Call');
        setActiveCall(null);
        stopTimer();
      });

      call.on('error', (err) => {
        setStatus('Call Failed');
        console.error('Call error:', err);
        setActiveCall(null);
        stopTimer();
      });
      
      // Some versions of Twilio SDK use 'reject' if the call is rejected before answer
      call.on('reject', () => {
        setStatus('Call Rejected');
        setActiveCall(null);
        stopTimer();
      });

    } catch (err) {
      setStatus('Call Failed');
      console.error(err);
    }
  }

  function handleHangup() {
    if (device) {
      device.disconnectAll();
    }
  }

  function handleKeypad(digit) {
    if (activeCall) {
      activeCall.sendDigits(digit);
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
        {/* Glow effect */}
        <div className={`absolute top-0 inset-x-0 h-1 blur-xl transition-all ${activeCall ? 'bg-emerald-500 shadow-[0_0_50px_rgba(16,185,129,0.8)]' : 'bg-indigo-500 shadow-[0_0_30px_rgba(79,70,229,0.5)]'}`} />
        
        <div className="p-8 pb-4 flex flex-col items-center">
          <div className="mb-2 text-xs font-bold text-slate-500 uppercase tracking-wider">
            {callerId ? `Calling From: ${callerId}` : 'Calling From: Unknown'}
          </div>
          
          {/* Status Display */}
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

          {/* Number Display */}
          <div className="h-16 w-full flex items-center justify-center mb-6">
            <input 
              type="text" 
              value={phoneNumber} 
              onChange={(e) => setPhoneNumber(e.target.value)}
              placeholder="(555) 555-5555"
              className="bg-transparent text-center text-3xl font-light text-white tracking-wider outline-none w-full"
            />
          </div>

          {/* Call Timer */}
          {activeCall && (
            <div className="text-2xl font-mono text-emerald-400 mb-6 font-light">
              {formatDuration(callDuration)}
            </div>
          )}

          {/* Keypad */}
          <div className="grid grid-cols-3 gap-4 w-full mb-8">
            {['1','2','3','4','5','6','7','8','9','*','0','#'].map((key) => (
              <button
                key={key}
                onClick={() => handleKeypad(key)}
                className="h-16 rounded-full bg-white/5 hover:bg-white/10 active:bg-white/20 text-2xl font-light text-white flex items-center justify-center transition-colors border border-white/5"
              >
                {key}
              </button>
            ))}
          </div>

          {/* Call Controls */}
          <div className="flex justify-center w-full">
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
                onClick={handleDial}
                disabled={!device || loading}
                className="h-16 w-16 rounded-full bg-emerald-500 hover:bg-emerald-600 shadow-[0_0_20px_rgba(16,185,129,0.4)] flex items-center justify-center transition-all text-white disabled:opacity-50 disabled:hover:scale-100 transform hover:scale-105 active:scale-95"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" fill="currentColor" viewBox="0 0 16 16">
                  <path fillRule="evenodd" d="M1.885.511a1.745 1.745 0 0 1 2.61.163L6.29 2.98c.329.423.445.974.315 1.494l-.547 2.19a.678.678 0 0 0 .178.643l2.457 2.457a.678.678 0 0 0 .644.178l2.189-.547a1.745 1.745 0 0 1 1.494.315l2.306 1.794c.829.645.905 1.87.163 2.611l-1.034 1.034c-.74.74-1.846 1.065-2.877.702a18.634 18.634 0 0 1-7.01-4.42 18.634 18.634 0 0 1-4.42-7.009c-.362-1.03-.037-2.137.703-2.877L1.885.511z"/>
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>
      
      {/* Instructions / Credentials Needed Notice */}
      <div className="mt-8 text-center text-sm text-slate-500 max-w-md">
        Note: The Outbound Dialer requires Twilio API Key and Twilio TwiML App configurations in the environment variables to function properly.
      </div>
    </div>
  );
}
