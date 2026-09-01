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
    <div className="fixed bottom-8 right-8 z-50 group">
      {/* Animated glowing aura behind the button */}
      <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 rounded-full blur-xl opacity-60 group-hover:opacity-100 transition-opacity duration-500 animate-pulse"></div>
      
      {/* The actual button */}
      <Link 
        href={dialerPath}
        className="relative flex items-center justify-center w-16 h-16 bg-gradient-to-br from-indigo-500 via-purple-600 to-blue-600 text-white rounded-full shadow-2xl border border-white/20 transition-all duration-300 transform group-hover:scale-110 active:scale-95"
        title="Open Dialer"
      >
        {/* Inner glass reflection */}
        <div className="absolute inset-0 rounded-full bg-gradient-to-b from-white/20 to-transparent opacity-50"></div>
        
        <svg 
          xmlns="http://www.w3.org/2000/svg" 
          width="26" 
          height="26" 
          fill="currentColor" 
          viewBox="0 0 16 16"
          className="relative z-10 drop-shadow-md animate-[bounce_2s_infinite]"
        >
          <path fillRule="evenodd" d="M1.885.511a1.745 1.745 0 0 1 2.61.163L6.29 2.98c.329.423.445.974.315 1.494l-.547 2.19a.678.678 0 0 0 .178.643l2.457 2.457a.678.678 0 0 0 .644.178l2.189-.547a1.745 1.745 0 0 1 1.494.315l2.306 1.794c.829.645.905 1.87.163 2.611l-1.034 1.034c-.74.74-1.846 1.065-2.877.702a18.634 18.634 0 0 1-7.01-4.42 18.634 18.634 0 0 1-4.42-7.009c-.362-1.03-.037-2.137.703-2.877L1.885.511z"/>
        </svg>
      </Link>
    </div>
  );
}
