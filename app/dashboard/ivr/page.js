'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import NumberIVRBuilder from './NumberIVRBuilder';

export default function IVRPage() {
  const [numbers, setNumbers] = useState([]);
  const [selectedNumber, setSelectedNumber] = useState(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    async function loadData() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const { data: agentData } = await supabase.from('agents').select('organization_id').eq('id', session.user.id).single();
      if (!agentData) return;

      const { data: nums } = await supabase
        .from('organization_numbers')
        .select('*')
        .eq('organization_id', agentData.organization_id)
        .eq('status', 'active');
      
      setNumbers(nums || []);
      if (nums && nums.length > 0) {
        setSelectedNumber(nums[0]);
      }
      setLoading(false);
    }
    loadData();
  }, []);

  if (loading) {
    return <div className="text-slate-400 p-8">Loading your numbers...</div>;
  }

  return (
    <div className="animate-in fade-in duration-500">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white tracking-tight mb-2">IVR Builder</h1>
        <p className="text-slate-400">Create custom call routing workflows for each of your phone numbers.</p>
      </div>

      {numbers.length === 0 ? (
        <div className="glass-card rounded-2xl p-8 border border-white/10 text-center">
          <p className="text-slate-400 mb-4">You don't have any active phone numbers yet.</p>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="glass-card rounded-2xl p-6 border border-white/10 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white">Select a Phone Number</h2>
              <p className="text-sm text-slate-400">Choose the number you want to configure</p>
            </div>
            <select
              className="bg-slate-900 border border-slate-700 text-white rounded-xl px-4 py-2 outline-none focus:border-indigo-500"
              value={selectedNumber?.id || ''}
              onChange={(e) => {
                const num = numbers.find(n => n.id === e.target.value);
                setSelectedNumber(num);
              }}
            >
              {numbers.map(n => (
                <option key={n.id} value={n.id}>{n.phone_number}</option>
              ))}
            </select>
          </div>

          {selectedNumber && (
            <NumberIVRBuilder 
              key={selectedNumber.id} 
              numberData={selectedNumber} 
              onSaved={(msg) => showToast(msg)}
            />
          )}
        </div>
      )}

      {toast && (
        <div className={`fixed bottom-10 left-1/2 -translate-x-1/2 flex items-center gap-3 px-5 py-3.5 rounded-full shadow-2xl border z-50 animate-in fade-in slide-in-from-bottom-5 ${toast.type === 'error' ? 'bg-red-500/90 border-red-500/20 text-white' : 'bg-emerald-500/90 border-emerald-500/20 text-white backdrop-blur-md'}`}>
          <span className="font-semibold text-sm whitespace-nowrap">{toast.message}</span>
          <button onClick={() => setToast(null)} className="opacity-70 hover:opacity-100 ml-2">
            <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd"/></svg>
          </button>
        </div>
      )}
    </div>
  );
}
