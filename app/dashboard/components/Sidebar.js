'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function Sidebar() {
  const pathname = usePathname();

  const links = [
    { href: '/dashboard', label: 'Overview', icon: '📊' },
    { href: '/dashboard/numbers', label: 'My Numbers', icon: '📱' },
    { href: '/dashboard/properties', label: 'Properties', icon: '🏠' },
    { href: '/dashboard/agents', label: 'Agents / Directory', icon: '👥' },
    { href: '/dashboard/leads', label: 'Leads', icon: '🎯' },
    { href: '/dashboard/calls', label: 'Activity Log', icon: '📞' },
    { href: '/dashboard/dialer', label: 'Web Dialer', icon: '☎️' },
    { href: '/dashboard/billing', label: 'Billing', icon: '💳' },
    { href: '/dashboard/settings', label: 'Settings', icon: '⚙️' },
  ];

  return (
    <aside className="w-64 border-r border-white/5 glass h-screen sticky top-0 flex flex-col p-4">
      <div className="flex items-center gap-2 px-2 py-4 mb-6">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center font-bold text-white shadow-lg">
          P
        </div>
        <span className="font-bold text-lg text-white tracking-tight">Prime Lead Bridge</span>
      </div>

      <nav className="flex-1 space-y-2">
        {links.map((link) => {
          const isActive = pathname === link.href || pathname.startsWith(link.href + '/');
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 ${
                isActive 
                  ? 'bg-indigo-500/10 text-indigo-400 font-medium' 
                  : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
              }`}
            >
              <span className="text-xl">{link.icon}</span>
              {link.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto pt-4 border-t border-white/5">
        <button className="flex items-center gap-3 px-3 py-2.5 w-full rounded-xl text-slate-400 hover:bg-red-500/10 hover:text-red-400 transition-all text-left">
          <span className="text-xl">🚪</span>
          Logout
        </button>
      </div>
    </aside>
  );
}
