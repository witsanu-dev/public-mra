'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Sidebar } from '@/components/layout/Sidebar';
import { Topbar } from '@/components/layout/Topbar';
import { Footer } from '@/components/layout/Footer';
import { useAuthStore } from '@/store/useAuthStore';

export function LayoutShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user, checkSession, initialized } = useAuthStore();

  useEffect(() => {
    if (!initialized) {
      checkSession();
    }
  }, [initialized, checkSession]);

  // Client-side guard: redirect unauthenticated users to login
  useEffect(() => {
    if (pathname === '/login') return;
    if (initialized && !user) {
      router.replace('/login');
    }
  }, [initialized, user, pathname, router]);

  // Close drawer on ESC key
  useEffect(() => {
    if (pathname === '/login') return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && sidebarOpen) {
        setSidebarOpen(false);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [sidebarOpen, pathname]);

  // Lock body scroll when mobile drawer is open (uses CSS class from globals.css)
  useEffect(() => {
    if (pathname === '/login') return;
    if (sidebarOpen) {
      document.body.classList.add('drawer-open');
    } else {
      document.body.classList.remove('drawer-open');
    }
    return () => {
      document.body.classList.remove('drawer-open');
    };
  }, [sidebarOpen, pathname]);

  // Close sidebar when viewport becomes desktop size
  useEffect(() => {
    if (pathname === '/login') return;
    const mq = window.matchMedia('(min-width: 1024px)');
    const handler = (e: MediaQueryListEvent) => {
      if (e.matches) setSidebarOpen(false);
    };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [pathname]);

  const openSidebar  = useCallback(() => setSidebarOpen(true),  []);
  const closeSidebar = useCallback(() => setSidebarOpen(false), []);

  if (pathname === '/login') {
    return <main id="main-content" className="min-h-screen bg-slate-50">{children}</main>;
  }

  // Prevent flash of protected layout if unauthenticated on client
  if (!user && initialized) {
    return null;
  }

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar: static on desktop, overlay drawer on mobile */}
      <Sidebar isOpen={sidebarOpen} onClose={closeSidebar} />

      {/* Main Content Column */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Topbar with hamburger trigger for mobile */}
        <Topbar onMenuOpen={openSidebar} />

        {/* Scrollable Page Content (on /manual, overflow is contained so only PDF scrolls) */}
        <main
          id="main-content"
          role="main"
          className={`flex-1 bg-slate-50 flex flex-col ${pathname === '/manual' ? 'overflow-hidden' : 'overflow-y-auto'}`}
        >
          <div className={`page-container flex-1 ${pathname === '/manual' ? 'h-full min-h-0 flex flex-col gap-2.5 py-2.5 sm:py-3' : 'section-gap'}`}>
            {children}
          </div>
          <Footer />
        </main>
      </div>
    </div>
  );
}
