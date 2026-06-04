"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function Navigation() {
  const pathname = usePathname();

  const navItems = [
    { 
      name: "En cours", 
      href: "/", 
      icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"></path></svg> 
    },
    { 
      name: "Livres", 
      href: "/bibliotheque", 
      icon: <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"></path></svg> 
    },
    { 
      name: "Journal", 
      href: "/journal", 
      icon: <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg> 
    },
    { 
      name: "Dashboard", 
      href: "/dashboard", 
      icon: <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"></path></svg> 
    }
  ];

  return (
    <div className="fixed bottom-4 md:bottom-8 left-1/2 -translate-x-1/2 w-[95%] max-w-md z-50">
      <nav className="bg-[#1C1C1E]/90 backdrop-blur-xl border border-gray-800/60 rounded-[2rem] flex justify-between items-center h-[72px] px-2 shadow-[0_20px_40px_rgba(0,0,0,0.4)]">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link key={item.name} href={item.href} className="flex-1 flex flex-col items-center justify-center h-full group">
              <div className={`flex flex-col items-center justify-center w-[72px] h-[56px] rounded-2xl transition-all duration-300 ${isActive ? 'bg-white/10' : 'group-hover:bg-white/5'}`}>
                <div className={`mb-1 transition-colors ${isActive ? 'text-white' : 'text-gray-400'}`}>
                  {item.icon}
                </div>
                <span className={`text-[10px] font-bold tracking-wide transition-colors ${isActive ? 'text-white' : 'text-gray-500'}`}>
                  {item.name}
                </span>
              </div>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}