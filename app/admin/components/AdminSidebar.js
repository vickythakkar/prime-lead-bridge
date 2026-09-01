'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useDialer } from './AdminDialerContext';
import { useState, useEffect } from 'react';
import PushNotificationManager from '@/components/PushNotificationManager';

export default function AdminSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { status } = useDialer();

  const [unreadCalls, setUnreadCalls] = useState(0);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [unreadVoicemails, setUnreadVoicemails] = useState(0);

  useEffect(() => {
    // Let's create an API for admin notifications count
    const fetchAdminCounts = async () => {
      const token = localStorage.getItem('admin_token');
      if (!token) return;
      try {
        const res = await fetch('/api/admin/notifications-count', {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const { calls, messages, voicemails } = await res.json();
          setUnreadCalls(calls);
          setUnreadMessages(messages);
          setUnreadVoicemails(voicemails);
        }
      } catch (e) {
        console.error(e);
      }
    };

    fetchAdminCounts();
    const interval = setInterval(fetchAdminCounts, 30000);
    return () => clearInterval(interval);
  }, [pathname]);

  const links = [
    { href: '/admin/dashboard', label: 'Dashboard', icon: '📈' },
    { href: '/admin/numbers', label: 'My Numbers', icon: '📱' },
    { href: '/admin/ivr', label: 'IVR Builder', icon: '🔀' },
    { href: '/admin/teammates', label: 'Teammates', icon: '👥' },
    { href: '/admin/leads', label: 'Leads', icon: '🎯' },
    { href: '/admin/contacts', label: 'Contacts', icon: '📋' },
    { href: '/admin/activity', label: 'Activity Log', icon: '📞', badge: unreadCalls },
    { href: '/admin/dialer', label: 'Admin Dialer', icon: '☎️' },
    { href: '/admin/messages', label: 'Messages', icon: '💬', badge: unreadMessages },
    { href: '/admin/voicemails', label: 'Voicemails', icon: '🎙️', badge: unreadVoicemails },
    { href: '/admin/brokers', label: 'All Clients', icon: '🏢' },
    { href: '/admin/billing', label: 'Billing & Invoices', icon: '💳' },
    { href: '/admin/rates', label: 'Rates & Settings', icon: '⚙️' },
    { href: '/admin/settings', label: 'Platform Settings', icon: '🛠️' },
    { href: '/admin/trash', label: 'System Trash', icon: '🗑️' },
  ];

  const handleLogout = () => {
    localStorage.removeItem('admin_token');
    window.location.href = '/login';
  };

  return (
    <aside className="w-64 border-r border-white/5 glass h-screen sticky top-0 flex flex-col p-4 shrink-0">
      <PushNotificationManager userType="admin" />
      <div className="flex items-center gap-3 px-2 py-4 mb-4">
        <div className="w-16 h-16 rounded-full overflow-hidden shrink-0 flex items-center justify-center">
          <img 
            src="https://alvfyayrabxzxthcjphx.supabase.co/storage/v1/object/public/public-assets/Favicon.gif" 
            alt="Logo" 
            className="w-full h-full object-cover"
          />
        </div>
        <div>
          <h2 className="font-bold text-lg text-white tracking-tight leading-tight">Prime Admin</h2>
          <p className="text-xs text-indigo-400 font-medium">Control Center</p>
        </div>
      </div>

      <nav className="flex-1 min-h-0 space-y-0.5 overflow-y-auto pr-2 custom-scrollbar">
        {links.map((link) => {
          const isActive = pathname === link.href || pathname.startsWith(link.href + '/');
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`flex items-center justify-between px-3 py-2 rounded-xl transition-all duration-200 text-sm ${
                isActive
                  ? 'bg-indigo-500 text-white font-medium shadow-lg shadow-indigo-500/20'
                  : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="text-base">{link.icon}</span>
                {link.label}
              </div>
              {link.badge > 0 && (
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  isActive ? 'bg-white text-indigo-600' : 'bg-rose-500 text-white'
                }`}>
                  {link.badge > 99 ? '99+' : link.badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto pt-4 border-t border-white/5 shrink-0 space-y-2">
        <div className="px-3 py-2 flex items-center justify-between bg-black/20 rounded-xl border border-white/5">
          <div className="flex items-center gap-2">
            <span className="text-base">☎️</span>
            <span className="text-xs font-medium text-slate-300">Dialer</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className={`h-2 w-2 rounded-full shadow-[0_0_8px_currentColor] ${
              status === 'Ready to Call' || status === 'Connected' ? 'bg-emerald-400 text-emerald-400' : 
              status.includes('Error') ? 'bg-red-400 text-red-400' : 
              status.includes('Incoming') ? 'bg-indigo-400 text-indigo-400 animate-pulse' :
              'bg-amber-400 text-amber-400'
            }`}></div>
            <span className={`text-[10px] uppercase font-bold tracking-wider ${
              status === 'Ready to Call' || status === 'Connected' ? 'text-emerald-400' : 
              status.includes('Error') ? 'text-red-400' : 
              status.includes('Incoming') ? 'text-indigo-400' :
              'text-amber-400'
            }`}>{status === 'Ready to Call' ? 'Ready' : (status.includes('Error') ? 'Error' : status)}</span>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2 w-full rounded-xl text-slate-400 hover:bg-red-500/10 hover:text-red-400 transition-all text-left text-sm"
        >
          <span className="text-base">🚪</span>
          Logout
        </button>
      </div>
    </aside>
  );
}
