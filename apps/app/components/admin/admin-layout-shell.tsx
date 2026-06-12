'use client';

import React, { useEffect, useState, useRef } from 'react';
import dynamic from 'next/dynamic';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { ChevronDown } from 'lucide-react';
import { AdminSessionProvider, type SessionLike } from '@/components/admin/admin-session-context';
import { ROUTES } from '@cusown/shared';
import { useMounted } from '@cusown/shared/client';

const AdminSidebar = dynamic(() => import('@/components/admin/admin-sidebar'), {
  ssr: false,
});

const AuthLoadingSkeleton = () => (
  <div className="min-h-screen bg-background-primary flex items-center justify-center">
    <div className="flex flex-col items-center gap-3">
      <div className="w-8 h-8 border-2 border-border-primary border-t-brand-primary rounded-full animate-spin" />
      <p className="text-text-secondary text-sm">Loading...</p>
    </div>
  </div>
);

type AdminLayoutShellProps = {
  children: React.ReactNode;
  role: 'admin';
  /** Server-resolved user + profile; null when requireClientAuthCheck. */
  initialSession: SessionLike;
  initialAdminConfirmed?: boolean;
  /** Server could not see cookies (RSC); client must verify session and redirect if no admin. */
  requireClientAuthCheck?: boolean;
};

const TABS = [
  { value: 'overview', label: 'Overview' },
  { value: 'businesses', label: 'Businesses' },
  { value: 'users', label: 'Users' },
  { value: 'bookings', label: 'Bookings' },
  { value: 'audit', label: 'Audit Logs' },
  { value: 'cron-monitor', label: 'Cron Monitor' },
  { value: 'auth-management', label: 'Auth Management' },
  { value: 'storage', label: 'Storage' },
  { value: 'success-metrics', label: 'Success Metrics' },
  { value: 'analytics', label: 'Analytics' },
  { value: 'debug', label: 'Debug Console' },
];

/**
 * Admin shell: sidebar + main. Auth from server or client session check when layout could not see cookies.
 */
export function AdminLayoutShell({
  children,
  role: _role,
  initialSession,
  initialAdminConfirmed = true,
  requireClientAuthCheck = false,
}: AdminLayoutShellProps) {
  const mounted = useMounted();
  const [clientSession, setClientSession] = useState<SessionLike>(null);
  const [clientCheckDone, setClientCheckDone] = useState(!requireClientAuthCheck);
  const [sessionMissing, setSessionMissing] = useState(false);

  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (!mounted || !requireClientAuthCheck) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/auth/session', {
          credentials: 'include',
        });
        const json = await res.json();
        const data = json?.data ?? json;
        const user = data?.user ?? null;
        const profile = data?.profile ?? null;
        if (cancelled) return;
        if (!user) {
          setSessionMissing(true);
          setClientCheckDone(true);
          return;
        }
        const isAdmin = (profile as { user_type?: string } | null)?.user_type === 'admin';
        if (!isAdmin) {
          setSessionMissing(true);
          setClientCheckDone(true);
          return;
        }
        setClientSession({ user: { id: user.id, email: user.email }, profile });
      } catch {
        if (!cancelled) {
          setSessionMissing(true);
        }
      } finally {
        if (!cancelled) setClientCheckDone(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [mounted, requireClientAuthCheck]);

  const getActiveTab = () => {
    const p = pathname ?? '';
    if (p.startsWith('/admin/bookings')) return 'bookings';
    if (p.startsWith('/admin/users')) return 'users';
    if (p.startsWith('/admin/businesses')) return 'businesses';
    if (p.startsWith('/admin/audit-logs')) return 'audit';
    if (p.startsWith('/admin/debug')) return 'debug';

    const tab = searchParams?.get('tab');
    return tab || 'overview';
  };

  const activeTab = getActiveTab();
  const activeTabLabel = TABS.find((t) => t.value === activeTab)?.label || 'Overview';

  const handleTabChange = (tabValue: string) => {
    setDropdownOpen(false);
    if (tabValue === 'audit') {
      router.push('/admin/audit-logs');
    } else if (tabValue === 'debug') {
      router.push('/admin/debug');
    } else {
      router.push(`/admin/dashboard?tab=${tabValue}`);
    }
  };

  const session = initialSession ?? clientSession;
  const loginUrl =
    typeof ROUTES.AUTH_LOGIN === 'function' ? ROUTES.AUTH_LOGIN('/admin/dashboard') : '/auth/login';

  if (requireClientAuthCheck && (!mounted || !clientCheckDone)) {
    return <AuthLoadingSkeleton />;
  }

  if (requireClientAuthCheck && sessionMissing) {
    return (
      <div className="min-h-screen bg-background-primary flex items-center justify-center">
        <div className="text-center max-w-sm px-4">
          <p className="text-text-secondary mb-4">
            Your session may have expired. Sign in again to continue.
          </p>
          <a
            href={loginUrl}
            className="inline-block text-brand-primary hover:text-brand-primaryHover font-medium"
          >
            Sign in again
          </a>
        </div>
      </div>
    );
  }

  if (requireClientAuthCheck && !session?.user?.id) {
    return null;
  }

  return (
    <AdminSessionProvider
      initialSession={session}
      initialAdminConfirmed={initialAdminConfirmed || !!clientSession}
      skipClientSessionFetch
    >
      <div className="flex h-[100dvh] w-screen overflow-hidden bg-background-primary text-text-primary font-sans select-none">
        {/* Desktop Sidebar (Left) */}
        <AdminSidebar />

        {/* Main Content Area (Right) */}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          {/* Mobile Top Header */}
          <header className="flex lg:hidden sticky top-0 z-40 shrink-0 items-center justify-between pl-14 pr-4 h-14 border-b border-border-primary bg-[#111111]/80 backdrop-blur-md">
            <div className="flex items-center gap-2">
              <span className="text-brand-primary font-display font-bold text-base tracking-tight">
                Cusown
              </span>
              <span className="text-text-secondary text-[9px] uppercase tracking-wider px-2 py-0.5 rounded-md bg-background-tertiary border border-border-primary">
                Admin
              </span>
            </div>
          </header>

          {/* Desktop Top Header Bar */}
          <header className="hidden lg:flex shrink-0 items-center justify-between px-8 h-14 border-b border-border-primary bg-[#111111]/80 backdrop-blur-md z-30">
            <div className="flex items-center gap-2 text-xs">
              <span className="font-mono text-[#737373] uppercase tracking-widest text-[10px]">
                Console
              </span>
              <span className="text-text-disabled">/</span>
              <span className="font-bold text-[#00E676] tracking-wide">{activeTabLabel}</span>
            </div>

            {/* Dropdown Section Selector */}
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border-primary bg-[#181818] text-xs font-semibold text-text-primary hover:border-[#00E676]/40 hover:bg-[#1C1C1C] transition-all cursor-pointer"
              >
                <span>Navigate</span>
                <ChevronDown
                  className={`w-3.5 h-3.5 text-[#A1A1A1] transition-transform duration-200 ${dropdownOpen ? 'rotate-180' : ''}`}
                />
              </button>

              {dropdownOpen && (
                <div className="absolute right-0 mt-2 w-48 rounded-lg border border-border-primary bg-[#141414] shadow-xl z-50 overflow-hidden py-1">
                  <div className="px-3 py-1.5 border-b border-border-primary/60">
                    <span className="text-[9px] font-bold uppercase tracking-wider text-[#737373] font-mono">
                      Select Tab
                    </span>
                  </div>
                  <div className="max-h-64 overflow-y-auto scrollbar-hide py-1">
                    {TABS.map((tab) => (
                      <button
                        key={tab.value}
                        onClick={() => handleTabChange(tab.value)}
                        className={`w-full text-left px-3 py-2 text-xs transition-colors cursor-pointer ${
                          activeTab === tab.value
                            ? 'bg-[#0F3D2E]/25 text-[#00E676] font-semibold border-l-2 border-[#00E676]'
                            : 'text-[#A1A1A1] hover:bg-[#1C1C1C] hover:text-[#F5F5F5] border-l-2 border-transparent'
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </header>

          {/* Main content scroll container */}
          <main
            className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain bg-background-primary p-4 sm:p-6 lg:p-8"
            suppressHydrationWarning
          >
            <div className="mx-auto w-full max-w-7xl flex flex-col gap-6" suppressHydrationWarning>
              {children}
            </div>
          </main>
        </div>
      </div>
    </AdminSessionProvider>
  );
}
