'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

export default function AdminSidebar() {
  const pathname = usePathname();
  const router = useRouter();

  const links = [
    { href: '/admin/dashboard', label: 'Dashboard', icon: '📈' },
    { href: '/admin/numbers', label: 'My Numbers', icon: '📱' },
    { href: '/admin/teammates', label: 'Teammates', icon: '👥' },
    { href: '/admin/leads', label: 'Leads', icon: '🎯' },
    { href: '/admin/contacts', label: 'Contacts', icon: '📋' },
    { href: '/admin/activity', label: 'Activity Log', icon: '📞' },
    { href: '/admin/dialer', label: 'Admin Dialer', icon: '☎️' },
    { href: '/admin/messages', label: 'Messages', icon: '💬' },
    { href: '/admin/voicemails', label: 'Voicemails', icon: '🎙️' },
    { href: '/admin/brokers', label: 'All Clients', icon: '🏢' },
    { href: '/admin/billing', label: 'Billing & Invoices', icon: '💳' },
    { href: '/admin/rates', label: 'Rates & Settings', icon: '⚙️' },
    { href: '/admin/settings', label: 'Platform Settings', icon: '🛠️' },
  ];

  const handleLogout = () => {
    localStorage.removeItem('admin_token');
    window.location.href = '/login';
  };

  return (
    <aside className="w-64 border-r border-white/5 glass h-screen sticky top-0 flex flex-col p-4 shrink-0">
      <div className="flex items-center gap-3 px-2 py-4 mb-4">
        <div className="w-9 h-9 rounded-xl bg-slate-800 flex items-center justify-center shadow-lg overflow-hidden border border-white/10 shrink-0">
          <img 
            src="https://alvfyayrabxzxthcjphx.supabase.co/storage/v1/object/public/public-assets/Favicon.gif" 
            alt="Logo" 
            className="w-full h-full object-cover"
          />
        </div>
        <div>
          <h2 className="font-bold text-base text-white tracking-tight leading-tight">Prime Admin</h2>
          <p className="text-xs text-indigo-400 font-medium">Control Center</p>
        </div>
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto">
        {links.map((link) => {
          const isActive = pathname === link.href || pathname.startsWith(link.href + '/');
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`flex items-center gap-3 px-3 py-2 rounded-xl transition-all duration-200 text-sm ${
                isActive
                  ? 'bg-indigo-500 text-white font-medium shadow-lg shadow-indigo-500/20'
                  : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
              }`}
            >
              <span className="text-base">{link.icon}</span>
              {link.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto pt-4 border-t border-white/5 shrink-0">
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
