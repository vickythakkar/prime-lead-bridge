'use client';
import { useState, useEffect } from 'react';

export default function BillingPage() {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchInvoices() {
      try {
        const token = localStorage.getItem('admin_token');
        const res = await fetch('/api/admin/billing', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (res.ok) {
          const data = await res.json();
          setInvoices(data.invoices || []);
        } else {
          // Mock data
          setInvoices([
            { id: 'INV-1001', orgName: 'Acme Realty', period: 'July 2026', baseFee: 99, overageMins: 200, overageFee: 10, totalAmount: 109.00, status: 'paid', dueDate: '2026-08-01' },
            { id: 'INV-1002', orgName: 'Smith Brokerage', period: 'July 2026', baseFee: 29, overageMins: 90, overageFee: 4.50, totalAmount: 33.50, status: 'due', dueDate: '2026-08-15' },
            { id: 'INV-1003', orgName: 'Elite Homes', period: 'June 2026', baseFee: 99, overageMins: 1100, overageFee: 55, totalAmount: 154.00, status: 'overdue', dueDate: '2026-07-01' },
          ]);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    fetchInvoices();
  }, []);

  const markAsPaid = (id) => {
    setInvoices(invoices.map(inv => inv.id === id ? { ...inv, status: 'paid' } : inv));
  };

  return (
    <div className="animate-in fade-in duration-500">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-white">Billing & Invoices</h1>
        <p className="text-indigo-300 mt-1">Track payments, due invoices, and calculate overages.</p>
      </header>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="glass-card p-6 rounded-xl border border-emerald-500/20 bg-emerald-900/10">
          <h3 className="text-emerald-400 text-sm font-bold uppercase tracking-wider mb-2">Collected (Last 30d)</h3>
          <p className="text-3xl font-bold text-white">$14,520.00</p>
        </div>
        <div className="glass-card p-6 rounded-xl border border-yellow-500/20 bg-yellow-900/10">
          <h3 className="text-yellow-400 text-sm font-bold uppercase tracking-wider mb-2">Pending / Due</h3>
          <p className="text-3xl font-bold text-white">$3,240.50</p>
        </div>
        <div className="glass-card p-6 rounded-xl border border-red-500/20 bg-red-900/10">
          <h3 className="text-red-400 text-sm font-bold uppercase tracking-wider mb-2">Overdue</h3>
          <p className="text-3xl font-bold text-white">$890.00</p>
        </div>
      </div>

      <div className="glass-card rounded-2xl overflow-hidden border border-white/5">
        <div className="p-4 border-b border-white/5 bg-white/5 flex gap-4">
          <input 
            type="text" 
            placeholder="Search invoice or org..." 
            className="flex-1 max-w-sm bg-slate-900/60 border border-white/10 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-indigo-500 transition-colors text-sm"
          />
          <select className="bg-slate-900/60 border border-white/10 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-indigo-500 transition-colors text-sm">
            <option value="all">All Statuses</option>
            <option value="due">Due</option>
            <option value="overdue">Overdue</option>
            <option value="paid">Paid</option>
          </select>
        </div>

        {loading ? (
          <div className="p-8 text-center text-slate-400">Loading invoices...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left whitespace-nowrap">
              <thead className="bg-[#0a0a0e]/50 border-b border-white/10">
                <tr>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Invoice ID</th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Organization</th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Period</th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider text-right">Overage Calc</th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider text-right">Total Amount</th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {invoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-white/5 transition-colors">
                    <td className="px-6 py-4 font-mono text-sm text-indigo-300 font-medium">{inv.id}</td>
                    <td className="px-6 py-4 font-medium text-white">{inv.orgName}</td>
                    <td className="px-6 py-4 text-slate-300 text-sm">{inv.period}</td>
                    <td className="px-6 py-4 text-right text-sm">
                      <div className="text-slate-300">{inv.overageMins} mins extra</div>
                      <div className="text-xs text-slate-500">+${inv.overageFee.toFixed(2)}</div>
                    </td>
                    <td className="px-6 py-4 text-right font-bold text-white">${inv.totalAmount.toFixed(2)}</td>
                    <td className="px-6 py-4">
                      {inv.status === 'paid' && <span className="px-2.5 py-1 rounded-md text-xs font-bold uppercase bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">Paid</span>}
                      {inv.status === 'due' && <span className="px-2.5 py-1 rounded-md text-xs font-bold uppercase bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">Due</span>}
                      {inv.status === 'overdue' && <span className="px-2.5 py-1 rounded-md text-xs font-bold uppercase bg-red-500/20 text-red-400 border border-red-500/30">Overdue</span>}
                      <div className="text-[10px] text-slate-500 mt-1">Due: {new Date(inv.dueDate).toLocaleDateString()}</div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      {inv.status !== 'paid' ? (
                        <button 
                          onClick={() => markAsPaid(inv.id)}
                          className="text-emerald-400 hover:text-emerald-300 text-sm font-medium mr-4"
                        >
                          Mark Paid
                        </button>
                      ) : (
                        <span className="text-slate-600 text-sm font-medium mr-4 cursor-not-allowed">Mark Paid</span>
                      )}
                      <button className="text-slate-400 hover:text-white text-sm font-medium">Download</button>
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
