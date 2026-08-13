'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

export default function AdminSidebar() {
  const pathname = usePathname();
  const router = useRouter();

  const links = [
    { href: '/admin/dashboard', label: 'Dashboard', icon: '📈' },
    { href: '/admin/dialer', label: 'Admin Dialer', icon: '📞' },
    { href: '/admin/messages', label: 'Admin Messages', icon: '💬' },
    { href: '/admin/brokers', label: 'Brokers & Orgs', icon: '🏢' },
    { href: '/admin/billing', label: 'Billing & Invoices', icon: '💳' },
    { href: '/admin/rates', label: 'Rates & Settings', icon: '⚙️' },
  ];

  const handleLogout = () => {
    localStorage.removeItem('admin_token');
    router.push('/admin');
  };

  return (
    <aside className="w-64 border-r border-indigo-500/20 bg-[#06060c] h-screen sticky top-0 flex flex-col p-4 shadow-xl z-20">
      <div className="flex items-center gap-3 px-2 py-4 mb-8">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center font-bold text-white shadow-lg border border-white/10">
          🛡️
        </div>
        <div>
          <span className="font-bold text-lg text-white tracking-tight block">Prime Admin</span>
          <span className="text-xs text-indigo-400 font-medium">System Operator</span>
        </div>
      </div>

      <nav className="flex-1 space-y-2">
        {links.map((link) => {
          const isActive = pathname === link.href || pathname.startsWith(link.href + '/');
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-200 ${
                isActive 
                  ? 'bg-indigo-600 text-white font-medium shadow-[0_0_15px_rgba(79,70,229,0.3)]' 
                  : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
              }`}
            >
              <span className="text-xl">{link.icon}</span>
              {link.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto pt-4 border-t border-indigo-500/20">
        <button 
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-3 w-full rounded-xl text-slate-400 hover:bg-red-500/10 hover:text-red-400 transition-all text-left font-medium"
        >
          <span className="text-xl">🚪</span>
          Secure Logout
        </button>
      </div>
    </aside>
  );
}
