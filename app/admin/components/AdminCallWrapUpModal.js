'use client';
import { useState, useEffect } from 'react';

export default function AdminCallWrapUpModal({ isOpen, onClose, callDetails, initialData }) {
  const [dispositions, setDispositions] = useState(["Left Voicemail", "Spoke to Client", "Not Interested", "Wrong Number", "Follow Up Required"]);
  const [newDisposition, setNewDisposition] = useState('');
  const [isAddingDisposition, setIsAddingDisposition] = useState(false);
  
  const [form, setForm] = useState({
    disposition: '',
    notes: '',
    scheduleFollowUp: false,
    followUpDate: '',
    followUpTime: '',
    followUpTitle: ''
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const getTomorrowDateString = () => {
        const d = new Date();
        d.setDate(d.getDate() + 1);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      };

      setForm({
        disposition: initialData?.disposition || '',
        notes: initialData?.notes || '',
        scheduleFollowUp: false,
        followUpDate: getTomorrowDateString(),
        followUpTime: '09:00',
        followUpTitle: 'Follow up call'
      });
    }
  }, [isOpen, initialData]);

  async function handleAddDisposition() {
    if (!newDisposition.trim()) return;
    const updated = [...dispositions, newDisposition.trim()];
    setDispositions(updated);
    setForm({ ...form, disposition: newDisposition.trim() });
    setNewDisposition('');
    setIsAddingDisposition(false);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    
    try {
      const token = localStorage.getItem('admin_token');
      
      const res = await fetch('/api/admin/crm/wrap-up', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          callDetails,
          form,
          callId: initialData?.id
        })
      });

      if (res.ok) {
        window.dispatchEvent(new CustomEvent('tasksUpdated'));
        
        const toastEl = document.createElement('div');
        toastEl.className = 'fixed bottom-10 left-1/2 -translate-x-1/2 flex items-center gap-3 px-5 py-3.5 rounded-full shadow-2xl border z-[9999] animate-in fade-in slide-in-from-bottom-5 bg-emerald-500/90 border-emerald-500/20 text-white backdrop-blur-md font-semibold text-sm whitespace-nowrap';
        toastEl.innerText = 'Wrap-up details saved!';
        document.body.appendChild(toastEl);
        setTimeout(() => { toastEl.remove(); }, 3000);

        onClose(true);
      } else {
        alert('Failed to save details');
      }
    } catch (err) {
      console.error('Error saving admin wrap-up:', err);
      alert('Failed to save wrap-up details.');
    } finally {
      setSaving(false);
    }
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-md rounded-2xl p-6 shadow-2xl animate-in zoom-in-95">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-white">Admin Call Wrap-Up</h2>
          <button onClick={() => onClose(false)} className="text-slate-400 hover:text-white transition-colors">
            ✕
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-5">
          
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Outcome / Disposition</label>
            {!isAddingDisposition ? (
              <div className="flex gap-2">
                <select 
                  className="flex-1 bg-slate-950/50 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500"
                  value={form.disposition}
                  onChange={e => setForm({...form, disposition: e.target.value})}
                >
                  <option value="">Select an outcome...</option>
                  {dispositions.map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
                <button type="button" onClick={() => setIsAddingDisposition(true)} className="px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors">
                  + Add
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <input 
                  type="text" 
                  placeholder="e.g. Sent Contract"
                  className="flex-1 bg-slate-950/50 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500"
                  value={newDisposition}
                  onChange={e => setNewDisposition(e.target.value)}
                  autoFocus
                />
                <button type="button" onClick={handleAddDisposition} className="px-3 py-2 bg-indigo-600 rounded-lg text-white font-medium hover:bg-indigo-500 transition-colors">Save</button>
                <button type="button" onClick={() => setIsAddingDisposition(false)} className="px-3 py-2 bg-white/5 rounded-lg text-slate-300 hover:bg-white/10 transition-colors">Cancel</button>
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Notes</label>
            <textarea 
              rows={3} 
              className="w-full bg-slate-950/50 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500 resize-none"
              placeholder="What happened on the call?"
              value={form.notes}
              onChange={e => setForm({...form, notes: e.target.value})}
            />
          </div>

          <div className="bg-white/5 border border-white/10 rounded-xl p-4">
            <label className="flex items-center gap-3 cursor-pointer select-none">
              <input 
                type="checkbox" 
                className="w-5 h-5 rounded border-slate-700 bg-slate-900 text-indigo-500 focus:ring-indigo-500 focus:ring-offset-slate-900"
                checked={form.scheduleFollowUp}
                onChange={e => setForm({...form, scheduleFollowUp: e.target.checked})}
              />
              <span className="font-medium text-white">Schedule Follow-up</span>
            </label>

            {form.scheduleFollowUp && (
              <div className="mt-4 space-y-4 animate-in slide-in-from-top-2 fade-in">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Reminder Title</label>
                  <input 
                    type="text" 
                    className="w-full bg-slate-950/50 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500 text-sm"
                    value={form.followUpTitle}
                    onChange={e => setForm({...form, followUpTitle: e.target.value})}
                    required
                  />
                </div>
                <div className="flex gap-4">
                  <div className="flex-1">
                    <label className="block text-xs font-medium text-slate-400 mb-1">Date</label>
                    <input 
                      type="date" 
                      className="w-full bg-slate-950/50 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500 text-sm"
                      value={form.followUpDate}
                      onChange={e => setForm({...form, followUpDate: e.target.value})}
                      required
                    />
                  </div>
                  <div className="flex-1">
                    <label className="block text-xs font-medium text-slate-400 mb-1">Time</label>
                    <input 
                      type="time" 
                      className="w-full bg-slate-950/50 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500 text-sm"
                      value={form.followUpTime}
                      onChange={e => setForm({...form, followUpTime: e.target.value})}
                      required
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
          
          <div className="pt-2 flex justify-between gap-3 items-center">
            {initialData?.notes || initialData?.disposition ? (
              <button 
                type="button" 
                onClick={async () => {
                  if (confirm('Are you sure you want to clear these details?')) {
                    setSaving(true);
                    const token = localStorage.getItem('admin_token');
                    await fetch('/api/admin/crm/wrap-up', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                      body: JSON.stringify({
                        callDetails,
                        callId: initialData?.id,
                        form: { disposition: null, notes: null, scheduleFollowUp: false }
                      })
                    });
                    setSaving(false);
                    onClose(true); // pass true to indicate changes
                  }
                }}
                className="px-4 py-2 rounded-lg text-rose-400 hover:bg-rose-500/10 font-medium transition-colors text-sm"
              >
                Clear Details
              </button>
            ) : (
              <div></div>
            )}
            <div className="flex gap-3">
              <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-slate-300 hover:bg-white/5 font-medium transition-colors">
                Cancel
              </button>
              <button type="submit" disabled={saving} className="bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2 rounded-lg font-medium transition-colors disabled:opacity-50">
                {saving ? 'Saving...' : 'Save Details'}
              </button>
            </div>
          </div>

        </form>
      </div>
    </div>
  );
}
