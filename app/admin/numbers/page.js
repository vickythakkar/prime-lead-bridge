'use client';
import { useState, useEffect } from 'react';

const ADMIN_ORG_ID = '8a564ec4-9544-4b63-ac58-98ec66d69a76';

export default function AdminNumbers() {
  const [numbers, setNumbers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [areaCode, setAreaCode] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [selectedNumber, setSelectedNumber] = useState(null);
  const [purchasing, setPurchasing] = useState(false);

  // Voice Selection State
  const [previewingId, setPreviewingId] = useState(null);
  const [updatingId, setUpdatingId] = useState(null);

  // Toast State
  const [toast, setToast] = useState(null);
  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const AVAILABLE_VOICES = [
    { id: 'Polly.Matthew-Neural', name: 'Matthew (Male, Professional)' },
    { id: 'Polly.Stephen-Neural', name: 'Stephen (Male, Conversational)' },
    { id: 'Polly.Justin-Neural', name: 'Justin (Male, Energetic)' },
    { id: 'Polly.Joanna-Neural', name: 'Joanna (Female, Professional)' },
    { id: 'Polly.Salli-Neural', name: 'Salli (Female, Friendly)' },
    { id: 'Polly.Kendra-Neural', name: 'Kendra (Female, Authoritative)' },
    { id: 'Polly.Kimberly-Neural', name: 'Kimberly (Female, Warm)' },
    { id: 'Polly.Ruth-Neural', name: 'Ruth (Female, Conversational)' },
    { id: 'Polly.Brian-Neural', name: 'Brian (Male, UK)' },
    { id: 'Polly.Amy-Neural', name: 'Amy (Female, UK)' }
  ];

  const token = typeof window !== 'undefined' ? localStorage.getItem('admin_token') : '';

  useEffect(() => { fetchNumbers(); }, []);

  async function fetchNumbers() {
    setLoading(true);
    const { createClient } = await import('@supabase/supabase-js');
    const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
    const { data } = await sb.from('organization_numbers').select('*').eq('organization_id', ADMIN_ORG_ID).order('purchased_at', { ascending: false });
    setNumbers(data || []);
    setLoading(false);
  }

  async function handleSearch(e) {
    e.preventDefault();
    setSearching(true);
    setSelectedNumber(null);
    setSearchResults([]);
    try {
      const res = await fetch(`/api/admin/twilio/available-numbers?areaCode=${areaCode}`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      setSearchResults(data.numbers || []);
    } catch (err) {
      showToast('Error: ' + err.message, 'error');
    } finally {
      setSearching(false);
    }
  }

  async function handlePurchase() {
    if (!selectedNumber) return;
    setPurchasing(true);
    try {
      const res = await fetch('/api/twilio/provision-number', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber: selectedNumber.phoneNumber, orgId: ADMIN_ORG_ID })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to purchase');
      setNumbers([data.number, ...numbers]);
      setSelectedNumber(null);
      setSearchResults([]);
      setAreaCode('');
      showToast('Number purchased and provisioned!');
    } catch (err) {
      showToast('Error: ' + err.message, 'error');
    } finally {
      setPurchasing(false);
    }
  }

  async function handleRelease(id) {
    if (!confirm('Release this number? It will be returned to Twilio.')) return;
    try {
      const res = await fetch(`/api/twilio/release-number?id=${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        setNumbers(numbers.filter(n => n.id !== id));
        showToast("Number released successfully!");
      } else {
        showToast('Failed to release number.', 'error');
      }
    } catch (err) {
      showToast('Error: ' + err.message, 'error');
    }
  }

  async function handlePreviewVoice(voiceId) {
    const testPhone = prompt("Enter a phone number (e.g. +1234567890) to call for the voice preview:", "");
    if (!testPhone) return;

    setPreviewingId(voiceId);
    try {
      const res = await fetch('/api/twilio/preview-voice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ voice_id: voiceId, phone_number: testPhone })
      });
      if (!res.ok) throw new Error('Failed to initiate preview call');
      showToast(`Preview initiated! You will receive a phone call at ${testPhone} in a few seconds.`);
    } catch (err) {
      console.error(err);
      showToast('Error: ' + err.message, 'error');
    } finally {
      setPreviewingId(null);
    }
  }

  async function handleUpdateVoice(numberId, voiceId) {
    setUpdatingId(numberId);
    try {
      const { createClient } = await import('@supabase/supabase-js');
      const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
      
      const { error } = await sb
        .from('organization_numbers')
        .update({ voice_id: voiceId })
        .eq('id', numberId);
      
      if (error) throw error;
      
      setNumbers(prev => prev.map(n => n.id === numberId ? { ...n, voice_id: voiceId } : n));
      const voiceName = AVAILABLE_VOICES.find(v => v.id === voiceId)?.name || 'the selected voice';
      showToast(`Voice successfully set to ${voiceName}!`);
    } catch (err) {
      console.error(err);
      showToast('Failed to update voice: ' + err.message, 'error');
    } finally {
      setUpdatingId(null);
    }
  }

  return (
    <div className="animate-in fade-in duration-500">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-white">My Numbers</h1>
        <p className="text-slate-400 mt-1">Manage Twilio numbers assigned to the admin platform.</p>
      </header>

      {/* Active Numbers */}
      <div className="glass-card rounded-2xl overflow-hidden mb-10">
        <div className="p-6 border-b border-white/10 flex items-center justify-between">
          <h2 className="text-xl font-bold text-white">Active Numbers</h2>
          <span className="text-slate-400 text-sm">{numbers.length} number{numbers.length !== 1 ? 's' : ''}</span>
        </div>
        {loading ? (
          <div className="p-8 text-center text-slate-400">Loading numbers...</div>
        ) : numbers.length === 0 ? (
          <div className="p-8 text-center text-slate-400">No numbers yet. Purchase one below.</div>
        ) : (
          <table className="w-full text-left">
            <thead className="bg-white/5 border-b border-white/10">
              <tr>
                <th className="px-6 py-4 text-sm font-semibold text-slate-300">Phone Number</th>
                <th className="px-6 py-4 text-sm font-semibold text-slate-300">Status</th>
                <th className="px-6 py-4 text-sm font-semibold text-slate-300">Purchased</th>
                <th className="px-6 py-4 text-sm font-semibold text-slate-300">AI Voice</th>
                <th className="px-6 py-4 text-sm font-semibold text-slate-300 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {numbers.map(num => (
                <tr key={num.id} className="hover:bg-white/5 transition-colors">
                  <td className="px-6 py-4 font-bold text-white font-mono">{num.phone_number}</td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">{num.status}</span>
                  </td>
                  <td className="px-6 py-4 text-slate-400 text-sm">{new Date(num.purchased_at).toLocaleDateString()}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <select
                        value={num.voice_id || 'Polly.Matthew-Neural'}
                        onChange={(e) => handleUpdateVoice(num.id, e.target.value)}
                        disabled={updatingId === num.id}
                        className="bg-slate-900 border border-slate-700 text-sm rounded-md px-2 py-1.5 text-slate-200 focus:outline-none focus:border-indigo-500 min-w-[160px]"
                      >
                        {AVAILABLE_VOICES.map(v => (
                          <option key={v.id} value={v.id}>{v.name}</option>
                        ))}
                      </select>
                      <button
                        onClick={() => handlePreviewVoice(num.voice_id || 'Polly.Matthew-Neural')}
                        disabled={previewingId === (num.voice_id || 'Polly.Matthew-Neural')}
                        className="text-xs bg-indigo-500/20 text-indigo-300 hover:bg-indigo-500/30 px-3 py-1.5 rounded-md transition-colors disabled:opacity-50"
                        title="Call me to preview this voice"
                      >
                        {previewingId === (num.voice_id || 'Polly.Matthew-Neural') ? 'Calling...' : 'Preview'}
                      </button>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button onClick={() => handleRelease(num.id)} className="text-red-400 hover:text-red-300 text-sm font-medium">Release</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Purchase New */}
      <div className="glass-card rounded-2xl p-6">
        <h2 className="text-xl font-bold text-white mb-6">Purchase New Number</h2>
        <form onSubmit={handleSearch} className="flex gap-4 mb-8">
          <input type="text" placeholder="Area Code (e.g. 929)" maxLength={3} required
            className="flex-1 max-w-xs bg-slate-900/50 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500"
            value={areaCode} onChange={e => setAreaCode(e.target.value)} />
          <button type="submit" disabled={searching} className="bg-white/10 hover:bg-white/20 text-white px-6 py-2.5 rounded-lg font-medium transition-colors disabled:opacity-50">
            {searching ? 'Searching...' : 'Search'}
          </button>
        </form>

        {searchResults.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-slate-400 mb-3">Available Numbers:</h3>
              {searchResults.map(res => (
                <div
                  key={res.phoneNumber}
                  onClick={() => setSelectedNumber(res)}
                  className={`p-4 rounded-xl border cursor-pointer transition-all ${selectedNumber?.phoneNumber === res.phoneNumber ? 'bg-indigo-500/20 border-indigo-500 text-white' : 'bg-slate-900/50 border-slate-700 text-slate-300 hover:border-slate-500'}`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-bold text-lg">{res.phoneNumber}</span>
                      {res.locality && <span className="text-xs text-slate-500 ml-2">{res.locality}, {res.region}</span>}
                    </div>
                    {selectedNumber?.phoneNumber === res.phoneNumber && <span className="text-indigo-400 font-bold">✓</span>}
                  </div>
                </div>
              ))}
            </div>
            {selectedNumber && (
              <div className="bg-slate-900/80 rounded-xl p-6 border border-indigo-500/30">
                <h3 className="text-lg font-bold text-white mb-4">Confirm Purchase</h3>
                <div className="space-y-2 mb-6 text-sm">
                  <div className="flex justify-between"><span className="text-slate-400">Number:</span><span className="text-white font-bold">{selectedNumber.phoneNumber}</span></div>
                  <div className="flex justify-between"><span className="text-slate-400">Location:</span><span className="text-white">{selectedNumber.locality || 'US'}, {selectedNumber.region || ''}</span></div>
                  <div className="flex justify-between"><span className="text-slate-400">Est. Cost:</span><span className="text-white">~$1.15/mo (Twilio)</span></div>
                </div>
                <button onClick={handlePurchase} disabled={purchasing} className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-3 rounded-lg font-bold transition-all disabled:opacity-50">
                  {purchasing ? 'Purchasing...' : 'Confirm & Buy Number'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {toast && (
        <div className={`fixed bottom-6 right-6 flex items-center gap-3 px-4 py-3 rounded-lg shadow-xl border z-50 animate-in slide-in-from-bottom-5 ${toast.type === 'error' ? 'bg-red-500/90 border-red-500/20 text-white' : 'bg-emerald-500/90 border-emerald-500/20 text-white'}`}>
          <span className="font-medium text-sm">{toast.message}</span>
          <button onClick={() => setToast(null)} className="opacity-70 hover:opacity-100">
            <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd"/></svg>
          </button>
        </div>
      )}
    </div>
  );
}
