'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function FloatingDialerButton({ basePath = '/dashboard' }) {
  const pathname = usePathname();
  const dialerPath = `${basePath}/dialer`;

  // Hide the button if we are already on the dialer page
  if (pathname === dialerPath) {
    return null;
  }

  return (
    <Link 
      href={dialerPath}
      className="fixed bottom-8 right-8 z-50 flex items-center justify-center w-16 h-16 bg-indigo-600 hover:bg-indigo-500 text-white rounded-full shadow-[0_0_20px_rgba(79,70,229,0.5)] hover:shadow-[0_0_30px_rgba(79,70,229,0.7)] transition-all transform hover:scale-105 active:scale-95 group"
      title="Open Dialer"
    >
      <svg 
        xmlns="http://www.w3.org/2000/svg" 
        width="28" 
        height="28" 
        fill="currentColor" 
        viewBox="0 0 16 16"
        className="animate-[pulse_2s_ease-in-out_infinite]"
      >
        <path fillRule="evenodd" d="M1.885.511a1.745 1.745 0 0 1 2.61.163L6.29 2.98c.329.423.445.974.315 1.494l-.547 2.19a.678.678 0 0 0 .178.643l2.457 2.457a.678.678 0 0 0 .644.178l2.189-.547a1.745 1.745 0 0 1 1.494.315l2.306 1.794c.829.645.905 1.87.163 2.611l-1.034 1.034c-.74.74-1.846 1.065-2.877.702a18.634 18.634 0 0 1-7.01-4.42 18.634 18.634 0 0 1-4.42-7.009c-.362-1.03-.037-2.137.703-2.877L1.885.511z"/>
      </svg>
    </Link>
  );
}
