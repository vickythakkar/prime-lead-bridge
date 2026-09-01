'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export default function MyNumbers() {
  const [numbers, setNumbers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [orgId, setOrgId] = useState(null);
  const [agentPhone, setAgentPhone] = useState(null);
  
  // Admin Rates
  const [rates, setRates] = useState({ monthly: 0, setup: 0, perMinute: 0 });

  // Search state
  const [areaCode, setAreaCode] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [selectedNumber, setSelectedNumber] = useState(null);

  // Voice Selection State
  const [previewingId, setPreviewingId] = useState(null);
  const [updatingId, setUpdatingId] = useState(null);

  const AVAILABLE_VOICES = [
    { id: 'Polly.Matthew-Neural', name: 'Matthew (Male, US)' },
    { id: 'Polly.Joanna-Neural', name: 'Joanna (Female, US)' },
    { id: 'Polly.Salli-Neural', name: 'Salli (Female, US - Friendly)' },
    { id: 'Polly.Brian-Neural', name: 'Brian (Male, UK)' },
    { id: 'Polly.Amy-Neural', name: 'Amy (Female, UK)' }
  ];

  const fetchNumbers = async (oId) => {
    const { data, error } = await supabase
      .from('organization_numbers')
      .select('*')
      .eq('organization_id', oId)
      .order('purchased_at', { ascending: false });
    if (!error && data) setNumbers(data);
    setLoading(false);
  };

  useEffect(() => {
    async function loadData() {
      // Load Admin Rates
      const { data: adminData } = await supabase.from('admin_settings').select('*').eq('id', 1).single();
      if (adminData) {
        setRates({
          monthly: adminData.monthly_number_charge,
          setup: adminData.one_time_number_charge,
          perMinute: adminData.broker_per_minute_charge
        });
      }

      // Load Org Numbers
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setLoading(false);
        return;
      }
      
      const { data: agentData, error: agentError } = await supabase.from('agents').select('organization_id, cell_phone').eq('id', session.user.id).single();
      
      if (agentError) {
        console.error("Error fetching agent:", agentError);
        // Try fallback to just get the first agent if RLS isn't strict yet
        const { data: fallback } = await supabase.from('agents').select('organization_id, cell_phone').eq('id', session.user.id).single();
        if (fallback) {
          setOrgId(fallback.organization_id);
          setAgentPhone(fallback.cell_phone);
          fetchNumbers(fallback.organization_id);
        } else {
          setLoading(false);
        }
      } else if (agentData) {
        setOrgId(agentData.organization_id);
        setAgentPhone(agentData.cell_phone);
        fetchNumbers(agentData.organization_id);
      } else {
        setLoading(false);
      }
    }
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSearch(e) {
    e.preventDefault();
    setSearching(true);
    setSelectedNumber(null);
    setSearchResults([]);
    
    try {
      const res = await fetch(`/api/twilio/search-numbers?areaCode=${areaCode}`);
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.error || 'Failed to fetch numbers');
      
      setSearchResults(data.numbers || []);
    } catch (err) {
      console.error(err);
      alert("Error searching numbers: " + err.message);
    } finally {
      setSearching(false);
    }
  }

  async function handlePurchase() {
    if (!selectedNumber || !orgId) return;

    // Send request to live provisioning API
    try {
      const res = await fetch('/api/twilio/provision-number', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber: selectedNumber, orgId })
      });
      
      const data = await res.json();
      
      if (res.ok && data.success && data.number) {
        setNumbers([data.number, ...numbers]);
        setSelectedNumber(null);
        setSearchResults([]);
        setAreaCode('');
        alert("Number purchased and provisioned successfully! It is now active.");
      } else {
        alert("Failed to purchase number: " + (data.error || 'Unknown error'));
      }
    } catch (err) {
      console.error(err);
      alert("Error purchasing number: " + err.message);
    }
  }

  async function handleRelease(id) {
    if (confirm("Are you sure you want to release this number? Any properties using it will be deactivated.")) {
      try {
        const res = await fetch(`/api/twilio/release-number?id=${id}`, { method: 'DELETE' });
        if (res.ok) {
          setNumbers(numbers.filter(n => n.id !== id));
        } else {
          alert('Failed to release number.');
        }
      } catch (err) {
      console.error(err);
      alert(err.message);
    }
  }

  async function handlePreviewVoice(voiceId) {
    if (!agentPhone) {
      alert("No cell phone number found in your profile to call for the preview. Please update your profile.");
      return;
    }
    setPreviewingId(voiceId);
    try {
      const res = await fetch('/api/twilio/preview-voice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ voice_id: voiceId, phone_number: agentPhone })
      });
      if (!res.ok) throw new Error('Failed to initiate preview call');
      alert(`Preview initiated! You will receive a phone call at ${agentPhone} in a few seconds.`);
    } catch (err) {
      console.error(err);
      alert(err.message);
    } finally {
      setPreviewingId(null);
    }
  }

  async function handleUpdateVoice(numberId, voiceId) {
    setUpdatingId(numberId);
    try {
      const { error } = await supabase
        .from('organization_numbers')
        .update({ voice_id: voiceId })
        .eq('id', numberId);
      
      if (error) throw error;
      
      // Update local state
      setNumbers(prev => prev.map(n => n.id === numberId ? { ...n, voice_id: voiceId } : n));
    } catch (err) {
      console.error(err);
      alert('Failed to update voice: ' + err.message);
    } finally {
      setUpdatingId(null);
    }
  }

  if (loading) return (
    <div className="animate-in fade-in duration-500">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-white">My Numbers</h1>
        <p className="text-slate-400 mt-1">Manage your active Twilio numbers or purchase new ones.</p>
      </header>
      <div className="p-8 text-center text-slate-400">Loading numbers...</div>
    </div>
  );

  return (
    <div className="animate-in fade-in duration-500">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-white">My Numbers</h1>
        <p className="text-slate-400 mt-1">Manage your active Twilio numbers or purchase new ones.</p>
      </header>

      {/* Active Numbers */}
      <div className="glass-card rounded-2xl overflow-hidden mb-12">
        <div className="p-6 border-b border-white/10">
          <h2 className="text-xl font-bold text-white">Active Numbers</h2>
        </div>
        {loading ? (
          <div className="p-8 text-center text-slate-400">Loading numbers...</div>
        ) : numbers.length === 0 ? (
          <div className="p-8 text-center text-slate-400">You have no active numbers. Search below to purchase one.</div>
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
              {numbers.map((num) => (
                <tr key={num.id} className="hover:bg-white/5 transition-colors">
                  <td className="px-6 py-4 font-bold text-white">{num.phone_number}</td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      {num.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-slate-400 text-sm">
                    {new Date(num.purchased_at).toLocaleDateString()}
                  </td>
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
                    <button 
                      onClick={() => handleRelease(num.id)}
                      className="text-red-400 hover:text-red-300 text-sm font-medium"
                    >
                      Release Number
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Buy New Number */}
      <div className="glass-card rounded-2xl p-6">
        <h2 className="text-xl font-bold text-white mb-6">Purchase New Number</h2>
        
        <form onSubmit={handleSearch} className="flex gap-4 mb-8">
          <input 
            type="text" 
            placeholder="Search by Area Code (e.g. 929)" 
            maxLength={3} required
            className="flex-1 max-w-xs bg-slate-900/50 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500"
            value={areaCode} onChange={(e) => setAreaCode(e.target.value)}
          />
          <button 
            type="submit" disabled={searching}
            className="bg-white/10 hover:bg-white/20 text-white px-6 py-2.5 rounded-lg font-medium transition-colors disabled:opacity-50"
          >
            {searching ? 'Searching...' : 'Search'}
          </button>
        </form>

        {searchResults.length > 0 ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-slate-400 mb-3">Available Numbers:</h3>
              {searchResults.map((res) => (
                <div 
                  key={res.phoneNumber || res} 
                  onClick={() => setSelectedNumber(res.phoneNumber || res)}
                  className={`p-4 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${
                    selectedNumber === (res.phoneNumber || res)
                      ? 'bg-indigo-500/20 border-indigo-500 text-white' 
                      : 'bg-slate-900/50 border-slate-700 text-slate-300 hover:border-slate-500'
                  }`}
                >
                  <div>
                    <span className="font-bold text-lg">{res.phoneNumber || res}</span>
                    <span className="text-xs text-slate-500 ml-2">
                      {res.locality ? `${res.locality}, ${res.region}` : 'United States'}
                    </span>
                  </div>
                  {selectedNumber === (res.phoneNumber || res) && <span className="text-indigo-400 font-bold">✓ Selected</span>}
                </div>
              ))}
            </div>

            {selectedNumber && (
              <div className="bg-slate-900/80 rounded-xl p-6 border border-indigo-500/30">
                <h3 className="text-lg font-bold text-white mb-4">Confirm Purchase</h3>
                <div className="space-y-3 mb-6">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400">Selected Number:</span>
                    <span className="text-white font-bold">{selectedNumber}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400">One-time Setup Fee:</span>
                    <span className="text-white">${rates.setup}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400">Monthly Recurring Fee:</span>
                    <span className="text-white">${rates.monthly}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400">Per-Minute Usage Rate:</span>
                    <span className="text-white">${rates.perMinute}/min</span>
                  </div>
                </div>
                <button 
                  onClick={handlePurchase}
                  className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-3 rounded-lg font-bold shadow-[0_0_15px_rgba(79,70,229,0.3)] transition-all"
                >
                  Confirm & Buy Number
                </button>
              </div>
            )}
          </div>
        ) : (
          !searching && areaCode.length === 3 && searchResults.length === 0 && (
            <div className="text-slate-400">No numbers found for this area code.</div>
          )
        )}
      </div>
    </div>
  );
}
