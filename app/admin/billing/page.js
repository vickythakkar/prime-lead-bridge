'use client';
import { useState, useEffect } from 'react';

export default function AdminBilling() {
  const [invoices, setInvoices] = useState([]);
  const [summary, setSummary] = useState({ totalDue: 0, totalOverdue: 0, totalPaid: 0, due: 0, overdue: 0, paid: 0 });
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [markingPaid, setMarkingPaid] = useState(null);

  const token = typeof window !== 'undefined' ? localStorage.getItem('admin_token') : '';

  useEffect(() => { fetchData(); }, [statusFilter]);

  async function fetchData() {
    setLoading(true);
    try {
      // Fetch invoices
      const url = statusFilter === 'all' ? '/api/admin/invoices' : `/api/admin/invoices?status=${statusFilter}`;
      const [invRes, statsRes] = await Promise.all([
        fetch(url, { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/admin/stats', { headers: { Authorization: `Bearer ${token}` } })
      ]);

      const invData = await invRes.json();
      const statsData = await statsRes.json();

      setInvoices(invData.invoices || []);
      if (statsData.invoiceSummary) setSummary(statsData.invoiceSummary);
    } catch (err) {
      console.error('Error loading billing data:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleMarkPaid(invoice) {
    if (!confirm(`Mark invoice for ${invoice.organizations?.company_name || invoice.organizations?.name || 'this org'} as paid?`)) return;
    setMarkingPaid(invoice.id);
    try {
      const res = await fetch('/api/admin/invoices', {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoice_id: invoice.id, paid_amount: invoice.total_amount })
      });
      if (res.ok) {
        setInvoices(invoices.map(inv => inv.id === invoice.id ? { ...inv, status: 'paid', paid_date: new Date().toISOString().split('T')[0] } : inv));
        setSummary(prev => ({
          ...prev,
          paid: prev.paid + 1,
          [invoice.status]: prev[invoice.status] - 1,
          totalPaid: prev.totalPaid + parseFloat(invoice.total_amount || 0),
          [`total${invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}`]: prev[`total${invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}`] - parseFloat(invoice.total_amount || 0)
        }));
      } else {
        alert('Failed to mark as paid. Please try again.');
      }
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setMarkingPaid(null);
    }
  }

  function handleDownload(invoice) {
    const orgName = invoice.organizations?.company_name || invoice.organizations?.name || 'Unknown';
    const period = invoice.month_year || `${invoice.billing_period_start} — ${invoice.billing_period_end}`;
    const content = `
INVOICE
=======================================================
Prime Real Ops — Platform Invoice
=======================================================
Invoice ID:     ${invoice.id}
Organization:   ${orgName}
Billing Period: ${period}
Issue Date:     ${new Date(invoice.created_at).toLocaleDateString()}
Due Date:       ${invoice.due_date || 'N/A'}
Status:         ${invoice.status?.toUpperCase()}

-------------------------------------------------------
USAGE BREAKDOWN
-------------------------------------------------------
Total Calls:        ${invoice.total_calls || 0}
Total Minutes:      ${invoice.total_minutes || 0} min
Rate Per Minute:    $${parseFloat(invoice.rate_per_minute || 0).toFixed(4)}/min
Subtotal:           $${parseFloat(invoice.subtotal || 0).toFixed(2)}
Overage Charges:    $${parseFloat(invoice.overage_amount || 0).toFixed(2)}

-------------------------------------------------------
TOTAL DUE:          $${parseFloat(invoice.total_amount || invoice.amount_due || 0).toFixed(2)}
-------------------------------------------------------
${invoice.status === 'paid' ? `PAID ON: ${invoice.paid_date || 'N/A'}\nAMOUNT PAID: $${parseFloat(invoice.paid_amount || invoice.total_amount || 0).toFixed(2)}` : ''}

Thank you for your business!
Prime Real Ops — info@primerealops.com
    `.trim();

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Invoice_${orgName.replace(/\s+/g, '_')}_${period.replace(/\s+/g, '_')}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  const filtered = invoices.filter(inv => {
    const orgName = (inv.organizations?.company_name || inv.organizations?.name || '').toLowerCase();
    return !search || orgName.includes(search.toLowerCase()) || (inv.id || '').toLowerCase().includes(search.toLowerCase());
  });

  const statusBadge = {
    paid: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    due: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    overdue: 'bg-red-500/20 text-red-400 border-red-500/30'
  };

  return (
    <div className="animate-in fade-in duration-500">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-white">Billing & Invoices</h1>
        <p className="text-slate-400 mt-1">Track payments, due invoices, and manage overages across all organizations.</p>
      </header>

      {/* Summary Cards — Live Data */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="glass-card p-6 rounded-xl border border-emerald-500/20 bg-emerald-900/10">
          <h3 className="text-emerald-400 text-sm font-bold uppercase tracking-wider mb-1">Collected (All Time)</h3>
          <p className="text-3xl font-bold text-white">${summary.totalPaid?.toFixed(2) || '0.00'}</p>
          <p className="text-xs text-slate-500 mt-1">{summary.paid || 0} paid invoice{summary.paid !== 1 ? 's' : ''}</p>
        </div>
        <div className="glass-card p-6 rounded-xl border border-yellow-500/20 bg-yellow-900/10">
          <h3 className="text-yellow-400 text-sm font-bold uppercase tracking-wider mb-1">Pending / Due</h3>
          <p className="text-3xl font-bold text-white">${summary.totalDue?.toFixed(2) || '0.00'}</p>
          <p className="text-xs text-slate-500 mt-1">{summary.due || 0} invoice{summary.due !== 1 ? 's' : ''} outstanding</p>
        </div>
        <div className="glass-card p-6 rounded-xl border border-red-500/20 bg-red-900/10">
          <h3 className="text-red-400 text-sm font-bold uppercase tracking-wider mb-1">Overdue</h3>
          <p className="text-3xl font-bold text-white">${summary.totalOverdue?.toFixed(2) || '0.00'}</p>
          <p className="text-xs text-slate-500 mt-1">{summary.overdue || 0} invoice{summary.overdue !== 1 ? 's' : ''} past due</p>
        </div>
      </div>

      {/* Invoices Table */}
      <div className="glass-card rounded-2xl overflow-hidden border border-white/5">
        <div className="p-4 border-b border-white/5 bg-white/5 flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            placeholder="Search by org or invoice ID..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="flex-1 max-w-sm bg-slate-900/60 border border-white/10 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-indigo-500 text-sm"
          />
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="bg-slate-900/60 border border-white/10 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-indigo-500 text-sm"
          >
            <option value="all">All Statuses</option>
            <option value="due">Due</option>
            <option value="overdue">Overdue</option>
            <option value="paid">Paid</option>
          </select>
        </div>

        {loading ? (
          <div className="p-8 text-center text-slate-400">Loading invoices...</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <div className="text-4xl mb-4">💳</div>
            <h3 className="text-lg font-medium text-white mb-2">No invoices found</h3>
            <p className="text-slate-400 text-sm">Invoices are generated monthly by the automated billing cron job.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left whitespace-nowrap">
              <thead className="bg-[#0a0a0e]/50 border-b border-white/10">
                <tr>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Invoice</th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Organization</th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Period</th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider text-right">Usage</th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider text-right">Overage</th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider text-right">Total</th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filtered.map(inv => (
                  <tr key={inv.id} className="hover:bg-white/5 transition-colors">
                    <td className="px-6 py-4 font-mono text-xs text-indigo-300 font-medium">{inv.id.slice(0, 8).toUpperCase()}</td>
                    <td className="px-6 py-4 font-medium text-white">{inv.organizations?.company_name || inv.organizations?.name || '—'}</td>
                    <td className="px-6 py-4 text-slate-300 text-sm">{inv.month_year || `${inv.billing_period_start || '—'}`}</td>
                    <td className="px-6 py-4 text-right text-sm">
                      <div className="text-slate-300">{inv.total_minutes || 0} min</div>
                      <div className="text-xs text-slate-500">{inv.total_calls || 0} calls</div>
                    </td>
                    <td className="px-6 py-4 text-right text-sm">
                      {parseFloat(inv.overage_amount || 0) > 0 ? (
                        <span className="text-red-400">+${parseFloat(inv.overage_amount).toFixed(2)}</span>
                      ) : (
                        <span className="text-slate-600">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right font-bold text-white">
                      ${parseFloat(inv.total_amount || inv.amount_due || 0).toFixed(2)}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 rounded-md text-xs font-bold uppercase border ${statusBadge[inv.status] || statusBadge.due}`}>
                        {inv.status}
                      </span>
                      <div className="text-[10px] text-slate-500 mt-1">
                        {inv.status === 'paid' ? `Paid ${inv.paid_date ? new Date(inv.paid_date).toLocaleDateString() : ''}` : `Due ${inv.due_date ? new Date(inv.due_date).toLocaleDateString() : 'N/A'}`}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-3">
                        {inv.status !== 'paid' ? (
                          <button
                            onClick={() => handleMarkPaid(inv)}
                            disabled={markingPaid === inv.id}
                            className="text-emerald-400 hover:text-emerald-300 text-xs font-semibold disabled:opacity-50 transition-colors"
                          >
                            {markingPaid === inv.id ? '...' : 'Mark Paid'}
                          </button>
                        ) : (
                          <span className="text-slate-600 text-xs font-semibold">Paid ✓</span>
                        )}
                        <button
                          onClick={() => handleDownload(inv)}
                          className="text-slate-400 hover:text-white text-xs font-semibold transition-colors border border-white/10 hover:border-white/30 px-2.5 py-1 rounded-lg"
                        >
                          Download
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
    </div>
  );
}
