'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useBrokerDialer } from './BrokerDialerContext';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import PushNotificationManager from '@/components/PushNotificationManager';

export default function Sidebar() {
  const pathname = usePathname();
  const { status: dialerStatus } = useBrokerDialer();
  const [realtyStatus, setRealtyStatus] = useState('onboarded');
  
  const [unreadCalls, setUnreadCalls] = useState(0);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [unreadVoicemails, setUnreadVoicemails] = useState(0);

  useEffect(() => {
    async function fetchRealtyStatusAndCounts() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const { data: agentData } = await supabase.from('agents').select('organization_id').eq('id', session.user.id).single();
      if (agentData) {
        const { data: orgData } = await supabase.from('organizations').select('service_active').eq('id', agentData.organization_id).single();
        if (orgData) {
          setRealtyStatus(orgData.service_active !== false ? 'onboarded' : 'offboarded');
        }
        
        // Fetch Unread Counts
        const fetchCounts = async () => {
          try {
            const [calls, msgs, vms] = await Promise.all([
              supabase.from('call_logs').select('id', { count: 'exact', head: true }).eq('organization_id', agentData.organization_id).eq('seen', false),
              supabase.from('messages').select('id', { count: 'exact', head: true }).eq('organization_id', agentData.organization_id).eq('is_read', false),
              supabase.from('voicemails').select('id', { count: 'exact', head: true }).eq('organization_id', agentData.organization_id).eq('listened', false)
            ]);
            setUnreadCalls(calls.count || 0);
            setUnreadMessages(msgs.count || 0);
            setUnreadVoicemails(vms.count || 0);
          } catch (e) {
            console.error('Error fetching unread counts:', e);
          }
        };

        fetchCounts();
        // Poll every 30 seconds
        const interval = setInterval(fetchCounts, 30000);
        return () => clearInterval(interval);
      }
    }
    fetchRealtyStatusAndCounts();
  }, [pathname]); // Re-fetch when pathname changes (user navigates to clear it)

  const links = [
    { href: '/dashboard', label: 'Overview', icon: '📊' },
    { href: '/dashboard/numbers', label: 'My Numbers', icon: '📱' },
    { href: '/dashboard/ivr', label: 'IVR Builder', icon: '🔀' },
    { href: '/dashboard/properties', label: 'Properties', icon: '🏠' },
    { href: '/dashboard/agents', label: 'Agents / Directory', icon: '👥' },
    { href: '/dashboard/leads', label: 'Leads', icon: '🎯' },
    { href: '/dashboard/messages', label: 'Messages', icon: '💬', badge: unreadMessages },
    { href: '/dashboard/contacts', label: 'Contacts', icon: '👥' },
    { href: '/dashboard/calls', label: 'Activity Log', icon: '📞', badge: unreadCalls },
    { href: '/dashboard/voicemails', label: 'Voicemails', icon: '📼', badge: unreadVoicemails },
    { href: '/dashboard/dialer', label: 'Web Dialer', icon: '☎️' },
    { href: '/dashboard/billing', label: 'Billing', icon: '💳' },
    { href: '/dashboard/settings', label: 'Settings', icon: '⚙️' },
    { href: '/dashboard/trash', label: 'Trash', icon: '🗑️' },
  ];

  const handleLogout = async () => {
    try {
      const { supabase } = await import('@/lib/supabase');
      await supabase.auth.signOut();
    } catch (e) {
      console.error(e);
    }
    window.location.href = '/login';
  };

  return (
    <aside className="w-64 border-r border-white/5 glass h-screen sticky top-0 flex flex-col p-4">
      <PushNotificationManager userType="broker" />
      <div className="flex items-center gap-3 px-2 py-4 mb-6">
        <div className="w-16 h-16 rounded-full overflow-hidden shrink-0 flex items-center justify-center">
          <img 
            src="https://alvfyayrabxzxthcjphx.supabase.co/storage/v1/object/public/public-assets/Favicon.gif" 
            alt="Logo" 
            className="w-full h-full object-cover"
          />
        </div>
        <span className="font-bold text-xl text-white tracking-tight leading-tight">Prime Lead Bridge</span>
      </div>

      <nav className="flex-1 min-h-0 space-y-2 overflow-y-auto pr-2 custom-scrollbar">
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

      <div className="mt-auto pt-4 border-t border-white/5 space-y-3">
        <div className="px-3 py-2 bg-slate-900/50 rounded-xl border border-white/5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-slate-400 font-medium">Dialer Status</span>
            <div className="flex items-center gap-1.5">
              <div className={`w-2 h-2 rounded-full ${dialerStatus === 'Ready to Call' || dialerStatus === 'Connected' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]' : 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.8)]'}`}></div>
              <span className="text-xs font-bold text-white">
                {dialerStatus === 'Ready to Call' || dialerStatus === 'Connected' ? 'Active' : dialerStatus === 'Initializing...' ? 'Connecting' : 'Error'}
              </span>
            </div>
          </div>
          
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 font-medium">Realty Status</span>
            <div className="flex items-center gap-1.5">
              <div className={`w-2 h-2 rounded-full ${realtyStatus === 'offboarded' ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]' : 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]'}`}></div>
              <span className={`text-xs font-bold ${realtyStatus === 'offboarded' ? 'text-red-400' : 'text-emerald-400'}`}>
                {realtyStatus === 'offboarded' ? 'Offboarded' : 'Onboarded'}
              </span>
            </div>
          </div>
        </div>

        <button 
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2.5 w-full rounded-xl text-slate-400 hover:bg-red-500/10 hover:text-red-400 transition-all text-left"
        >
          <span className="text-xl">🚪</span>
          Logout
        </button>
      </div>
    </aside>
  );
}
