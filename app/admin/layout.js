'use client';
import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import AdminSidebar from './components/AdminSidebar';
import { AdminDialerProvider } from './components/AdminDialerContext';
import FloatingDialerButton from '@/components/FloatingDialerButton';

export default function AdminLayout({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    // Check if on login page
    if (pathname === '/admin') {
      setAuthorized(true);
      return;
    }

    const token = localStorage.getItem('admin_token');
    if (!token) {
      router.push('/admin');
    } else {
      setAuthorized(true);
    }
  }, [pathname, router]);

  if (!authorized) {
    return <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white">Loading secure environment...</div>;
  }

  // If on login page, don't show layout
  if (pathname === '/admin') {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-screen bg-slate-900 text-slate-200 selection:bg-indigo-500/30 font-sans">
      <AdminDialerProvider>
        <AdminSidebar />
        <main className="flex-1 overflow-y-auto relative">
          {/* Subtle background glow for admin area */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[300px] bg-indigo-600/5 blur-[120px] rounded-full pointer-events-none" />
          
          <div className="p-8 w-full relative z-10">
            {children}
          </div>
          <FloatingDialerButton basePath="/admin" />
        </main>
      </AdminDialerProvider>
    </div>
  );
}
