import Sidebar from './components/Sidebar';
import { BrokerDialerProvider } from './components/BrokerDialerContext';
import FloatingDialerButton from '@/components/FloatingDialerButton';

export default function DashboardLayout({ children }) {
  return (
    <div className="flex min-h-screen bg-slate-900 text-slate-200">
      <BrokerDialerProvider>
        <Sidebar />
        <main className="flex-1 overflow-y-auto relative z-10">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-emerald-500/5 blur-[120px] rounded-full pointer-events-none" />
          
          <div className="p-4 sm:p-8 w-full relative z-10 pb-24 sm:pb-8 pt-20 sm:pt-8">
            {children}
          </div>
          <FloatingDialerButton basePath="/dashboard" />
        </main>
      </BrokerDialerProvider>
    </div>
  );
}
