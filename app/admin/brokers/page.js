'use client';
import { useState, useEffect } from 'react';

export default function AllClientsPage() {
  const [orgs, setOrgs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [planFilter, setPlanFilter] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [editingOrg, setEditingOrg] = useState(null);
  const [saving, setSaving] = useState(false);

  const initial = { company_name: '', contact_name: '', contact_email: '', contact_phone: '', subscription_plan: 'pay_as_you_go', notify_email: '', rate_per_minute: '', overage_multiplier: '', payment_window_days: '', pending_discount_type: 'fixed', pending_discount_amount: '', email_voicemail: true, email_missed_call: true, email_invoice: true, email_follow_up_reminder: true };
  const [form, setForm] = useState(initial);

  const token = typeof window !== 'undefined' ? localStorage.getItem('admin_token') : '';

  const [plans, setPlans] = useState([]);

  useEffect(() => { 
    fetchOrgs(); 
    fetchPlans();
  }, []);

  async function fetchPlans() {
    try {
      const res = await fetch('/api/admin/subscription-plans', { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const data = await res.json();
        setPlans(data.plans || []);
      }
    } catch (e) {
      console.error(e);
    }
  }

  async function fetchOrgs() {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/organizations?t=${Date.now()}`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const data = await res.json();
        setOrgs(data.organizations || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  function openCreate() {
    setEditingOrg(null);
    setForm(initial);
    setShowModal(true);
  }

  function openEdit(org) {
    setEditingOrg(org);
    setForm({
      company_name: org.company_name || org.name || '',
      contact_name: org.contact_name || '',
      contact_email: org.notify_email || '',
      contact_phone: org.organization_numbers?.[0]?.phone_number || '',
      subscription_plan: org.subscription_plan || 'pay_as_you_go',
      notify_email: org.notify_email || '',
      rate_per_minute: org.ivr_flow_config?.rate_per_minute || '',
      overage_multiplier: org.overage_multiplier || '',
      payment_window_days: org.payment_window_days || '',
      pending_discount_type: org.pending_discount_type || 'fixed',
      pending_discount_amount: org.pending_discount_amount || '',
      email_voicemail: org.ivr_flow_config?.email_preferences?.voicemail ?? true,
      email_missed_call: org.ivr_flow_config?.email_preferences?.missed_call ?? true,
      email_invoice: org.ivr_flow_config?.email_preferences?.invoice ?? true,
      email_follow_up_reminder: org.ivr_flow_config?.email_preferences?.follow_up ?? true
    });
    setShowModal(true);
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const method = editingOrg ? 'PATCH' : 'POST';
      const url = editingOrg ? `/api/admin/organizations/${editingOrg.id}` : '/api/admin/organizations';
      const res = await fetch(url, {
        method,
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save');
      await fetchOrgs();
      setShowModal(false);
      setEditingOrg(null);
      setForm(initial);
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setSaving(false);
    }
  }

  const filtered = orgs.filter(org => {
    // Hide the master admin organization from the tenants list
    if (org.id === '8a564ec4-9544-4b63-ac58-98ec66d69a76') return false;
    
    const name = (org.company_name || org.name || '').toLowerCase();
    const matchesSearch = name.includes(searchQuery.toLowerCase()) || (org.notify_email || '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchesPlan = planFilter === 'all' || (org.subscription_plan || 'basic') === planFilter;
    return matchesSearch && matchesPlan;
  });

  async function handleDelete(org) {
    if (!confirm(`Are you sure you want to permanently delete "${org.company_name || org.name}"? This will release their numbers and delete all data.`)) return;
    
    try {
      const res = await fetch(`/api/admin/organizations/${org.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete');
      
      setOrgs(orgs.filter(o => o.id !== org.id));
    } catch (err) {
      alert('Error deleting organization: ' + err.message);
    }
  }

  return (
    <div className="animate-in fade-in duration-500">
      <header className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white">All Clients</h1>
          <p className="text-slate-400 mt-1">Manage broker accounts, usage, and configurations.</p>
        </div>
        <button
          onClick={openCreate}
          className="bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2.5 rounded-lg font-medium shadow-[0_0_15px_rgba(79,70,229,0.3)] transition-all"
        >
          + New Organization
        </button>
      </header>

      <div className="glass-card rounded-2xl overflow-hidden border border-white/5">
        <div className="p-4 border-b border-white/5 bg-white/5 flex gap-4">
          <input
            type="text"
            placeholder="Search organizations..."
            className="flex-1 bg-slate-900/60 border border-white/10 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-indigo-500 transition-colors text-sm"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <select
            className="bg-slate-900/60 border border-white/10 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-indigo-500 transition-colors text-sm"
            value={planFilter}
            onChange={(e) => setPlanFilter(e.target.value)}
          >
            <option value="all">All Plans</option>
            <option value="starter">Starter</option>
            <option value="growth">Growth</option>
            <option value="pay_as_you_go">Pay As You Go</option>
          </select>
        </div>

        {loading ? (
          <div className="p-8 text-center text-slate-400">Loading organizations...</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <div className="text-4xl mb-4">🏢</div>
            <h3 className="text-lg font-medium text-white mb-2">No organizations found</h3>
            <p className="text-slate-400 text-sm">Click "+ New Organization" to onboard a client.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left whitespace-nowrap">
              <thead className="bg-[#0a0a0e]/50 border-b border-white/10">
                <tr>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Organization</th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Contact Person</th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Plan</th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider text-right">Calls (MTD)</th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider text-right">Mins (MTD)</th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider text-right">Rev (MTD)</th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filtered.map((org) => (
                  <tr key={org.id} className="hover:bg-white/5 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-medium text-white">{org.company_name || org.name}</div>
                      <div className="text-xs text-slate-500 mt-0.5">Joined {new Date(org.created_at).toLocaleDateString()}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-white text-sm font-medium">{org.contact_name || '—'}</div>
                      <div className="text-slate-400 text-xs mt-0.5">{org.notify_email || 'No email set'}</div>
                      <div className="text-slate-500 text-xs mt-0.5 font-mono">{org.organization_numbers?.[0]?.phone_number || 'No number'}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 rounded-md text-xs font-bold uppercase ${org.subscription_plan === 'growth' ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30' : org.subscription_plan === 'starter' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-slate-800 text-slate-400 border border-slate-700'}`}>
                        {org.subscription_plan === 'pay_as_you_go' ? 'PAYG' : org.subscription_plan || 'pay_as_you_go'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right text-slate-300 font-mono text-sm">{org.currentMonth?.totalCalls?.toLocaleString() || 0}</td>
                    <td className="px-6 py-4 text-right text-slate-300 font-mono text-sm">{org.currentMonth?.totalMinutes?.toLocaleString() || 0}</td>
                    <td className="px-6 py-4 text-right text-emerald-400 font-mono text-sm">${org.currentMonth?.estimatedCost || '0.00'}</td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center gap-1.5 text-emerald-400 text-sm font-medium">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]"></span>
                        Active
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-3">
                        <a href={`/admin/brokers/${org.id}`} className="text-indigo-400 hover:text-indigo-300 text-sm font-medium">View</a>
                        <button onClick={() => openEdit(org)} className="text-slate-400 hover:text-white text-sm font-medium">Edit</button>
                        <button onClick={() => handleDelete(org)} className="text-red-400 hover:text-red-300 transition-colors ml-2" title="Delete Organization">
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/><path fillRule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/></svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create / Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 w-full max-w-lg rounded-2xl p-8 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-white">{editingOrg ? 'Edit Organization' : 'New Organization'}</h2>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-white text-xl">✕</button>
            </div>
            <form onSubmit={handleSave} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Company Name *</label>
                <input type="text" required className="w-full bg-slate-950/50 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500" value={form.company_name} onChange={e => setForm({ ...form, company_name: e.target.value })} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Contact Person Name</label>
                  <input type="text" className="w-full bg-slate-950/50 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500" value={form.contact_name} onChange={e => setForm({ ...form, contact_name: e.target.value })} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Contact Email</label>
                  <input type="email" className="w-full bg-slate-950/50 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500" value={form.contact_email} onChange={e => setForm({ ...form, contact_email: e.target.value })} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Contact Phone</label>
                  <input type="tel" placeholder="+12125551234" className="w-full bg-slate-950/50 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500" value={form.contact_phone} onChange={e => setForm({ ...form, contact_phone: e.target.value })} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Subscription Plan *</label>
                  <select required className="w-full bg-slate-950/50 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500" value={form.subscription_plan} onChange={e => setForm({ ...form, subscription_plan: e.target.value })}>
                    {plans.length > 0 ? plans.map(p => (
                      <option key={p.id} value={p.id}>{p.name} (${p.base_price}/mo — {p.included_minutes === 0 ? 'PAYG' : `${p.included_minutes} min`})</option>
                    )) : (
                      <>
                        <option value="pay_as_you_go">Pay As You Go ($5/mo — $0.05/min)</option>
                        <option value="starter">Starter ($49/mo — 500 min)</option>
                        <option value="growth">Growth ($89/mo — 1000 min)</option>
                      </>
                    )}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Notification Email</label>
                <input type="email" placeholder="alerts@company.com" className="w-full bg-slate-950/50 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500" value={form.notify_email} onChange={e => setForm({ ...form, notify_email: e.target.value })} />
              </div>

              {/* Billing Overrides */}
              <div className="border-t border-white/10 pt-5 mt-5">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-3">Billing Rate Override <span className="text-slate-500 font-normal normal-case">(leave blank for default)</span></h3>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Rate / Min ($)</label>
                    <input type="number" step="0.001" placeholder="Default" className="w-full bg-slate-950/50 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500" value={form.rate_per_minute} onChange={e => setForm({ ...form, rate_per_minute: e.target.value })} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Overage Mult.</label>
                    <input type="number" step="0.1" placeholder="Default" className="w-full bg-slate-950/50 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500" value={form.overage_multiplier} onChange={e => setForm({ ...form, overage_multiplier: e.target.value })} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Pay Window (d)</label>
                    <input type="number" placeholder="Default" className="w-full bg-slate-950/50 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500" value={form.payment_window_days} onChange={e => setForm({ ...form, payment_window_days: e.target.value })} />
                  </div>
                </div>
              </div>

              {/* Pending Discount */}
              <div className="border-t border-white/10 pt-5 mt-5">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-3">One-Time Discount <span className="text-slate-500 font-normal normal-case">(applies to next invoice)</span></h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Discount Type</label>
                    <select className="w-full bg-slate-950/50 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500" value={form.pending_discount_type} onChange={e => setForm({ ...form, pending_discount_type: e.target.value })}>
                      <option value="fixed">Fixed Amount ($)</option>
                      <option value="percentage">Percentage (%)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Amount</label>
                    <input type="number" step="0.01" min="0" placeholder="0.00" className="w-full bg-slate-950/50 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500" value={form.pending_discount_amount} onChange={e => setForm({ ...form, pending_discount_amount: e.target.value })} />
                  </div>
                </div>
              </div>

              {/* Email Notifications */}
              <div className="border-t border-white/10 pt-5 mt-5">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-3">Email Notifications</h3>
                <div className="space-y-3">
                  <label className="flex items-center gap-3">
                    <input type="checkbox" className="w-4 h-4 rounded border-slate-700 bg-slate-950/50 text-indigo-500 focus:ring-indigo-500 focus:ring-offset-slate-900" checked={form.email_voicemail} onChange={e => setForm({ ...form, email_voicemail: e.target.checked })} />
                    <span className="text-sm text-slate-300">🎙️ Voicemail Notifications</span>
                  </label>
                  <label className="flex items-center gap-3">
                    <input type="checkbox" className="w-4 h-4 rounded border-slate-700 bg-slate-950/50 text-indigo-500 focus:ring-indigo-500 focus:ring-offset-slate-900" checked={form.email_missed_call} onChange={e => setForm({ ...form, email_missed_call: e.target.checked })} />
                    <span className="text-sm text-slate-300">📞 Missed Call Notifications</span>
                  </label>
                  <label className="flex items-center gap-3">
                    <input type="checkbox" className="w-4 h-4 rounded border-slate-700 bg-slate-950/50 text-indigo-500 focus:ring-indigo-500 focus:ring-offset-slate-900" checked={form.email_invoice} onChange={e => setForm({ ...form, email_invoice: e.target.checked })} />
                    <span className="text-sm text-slate-300">📄 Monthly Invoices</span>
                  </label>
                  <label className="flex items-center gap-3">
                    <input type="checkbox" className="w-4 h-4 rounded border-slate-700 bg-slate-950/50 text-indigo-500 focus:ring-indigo-500 focus:ring-offset-slate-900" checked={form.email_follow_up_reminder} onChange={e => setForm({ ...form, email_follow_up_reminder: e.target.checked })} />
                    <span className="text-sm text-slate-300">✅ Follow-up Reminders</span>
                  </label>
                </div>
              </div>

              <div className="pt-4 flex justify-end gap-3">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 rounded-lg text-slate-300 hover:bg-white/5 font-medium transition-colors">Cancel</button>
                <button type="submit" disabled={saving} className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-2.5 rounded-lg font-medium transition-colors disabled:opacity-50">
                  {saving ? 'Saving...' : editingOrg ? 'Update Organization' : 'Create Organization'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
