'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { ROUTES } from '@/lib/utils/navigation';
import { UI_CONTEXT } from '@/config/constants';
import { useOwnerSession } from '@/components/owner/owner-session-context';
import DashboardIcon from '@/src/icons/dashboard.svg';
import BusinessesIcon from '@/src/icons/businesses.svg';
import AnalyticsIcon from '@/src/icons/analytics.svg';
import ProfileIcon from '@/src/icons/profile.svg';
import LogoutIcon from '@/src/icons/logout.svg';
import ServiceIcon from '@/src/icons/service.svg';

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  requiresBusiness?: boolean;
}

export default function OwnerSidebar({
  sidebarOpen: propSidebarOpen,
  setSidebarOpen: propSetSidebarOpen,
}: {
  sidebarOpen?: boolean;
  setSidebarOpen?: (v: boolean) => void;
}) {
  const pathname = usePathname();
  const safePathname = pathname ?? '';
  const cleanPath = safePathname.split('?')[0];

  const [internalSidebarOpen, setInternalSidebarOpen] = useState(false);
  const sidebarOpen = propSidebarOpen ?? internalSidebarOpen;
  const setSidebarOpen = propSetSidebarOpen ?? setInternalSidebarOpen;
  const { initialUser } = useOwnerSession();
  const [navigating, setNavigating] = useState<string | null>(null);
  const [hasBusinesses, setHasBusinesses] = useState<boolean | null>(null);

  const [profileImageUrl, setProfileImageUrl] = useState<string | null>(null);

  const userEmail = initialUser?.email ?? '';
  const userName = initialUser?.full_name || initialUser?.email?.split('@')[0] || 'User';

  useEffect(() => {
    setNavigating(null);
  }, [safePathname]);

  useEffect(() => {
    if (!initialUser?.id) {
      setHasBusinesses(false);
      return;
    }
    let cancelled = false;
    fetch('/api/owner/businesses', { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (cancelled) return;
        const list = json?.data;
        setHasBusinesses(Array.isArray(list) && list.length > 0);
      })
      .catch(() => {
        if (!cancelled) setHasBusinesses(false);
      });
    return () => {
      cancelled = true;
    };
  }, [safePathname, initialUser?.id]);

  useEffect(() => {
    if (!initialUser?.profile_media_id) {
      setProfileImageUrl(null);
      return;
    }

    const mediaId = initialUser.profile_media_id;

    let cancelled = false;
    (async () => {
      try {
        const r2 = await fetch(`/api/media/signed-url?mediaId=${encodeURIComponent(mediaId)}`, {
          credentials: 'include',
        });
        if (!r2.ok) {
          if (!cancelled) setProfileImageUrl(null);
          return;
        }
        const j2 = await r2.json();
        const url = j2?.data?.url;
        if (!cancelled) setProfileImageUrl(url ?? null);
      } catch {
        if (!cancelled) setProfileImageUrl(null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [initialUser?.profile_media_id]);

  const navItems: NavItem[] = [
    {
      name: 'Dashboard',
      href: '/owner/dashboard',
      requiresBusiness: true,
      icon: DashboardIcon,
    },
    {
      name: 'My Businesses',
      href: '/owner/businesses',
      requiresBusiness: true,
      icon: BusinessesIcon,
    },
    {
      name: 'Analytics',
      href: '/owner/analytics',
      requiresBusiness: true,
      icon: AnalyticsIcon,
    },
  ];

  const navigation =
    hasBusinesses === false ? navItems.filter((i) => !i.requiresBusiness) : navItems;

  const isActive = (href: string) => {
    return cleanPath === href || cleanPath.startsWith(href + '/');
  };

  return (
    <>
      {sidebarOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black bg-opacity-50 z-40"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={`hidden lg:block fixed top-0 left-0 z-50 h-screen w-64 bg-slate-50 border-r border-gray-300 transition-transform ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } lg:translate-x-0`}
      >
        <div className="flex h-full flex-col">
          <div className="flex shrink-0 items-start justify-between border-b border-gray-300 px-5 py-6">
            <div>
              <h2 className="text-xl md:text-2xl font-calegar font-semibold tracking-tight hover:opacity-80 transition-opacity uppercase">
                CusOwn
              </h2>
              <p className="mt-0.5 text-xs text-slate-500">{UI_CONTEXT.VIEWING_AS_OWNER}</p>
            </div>
          </div>

          <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-6">
            {navigation.map((item) => {
              const active = isActive(item.href);
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  onClick={(e) => {
                    if (item.href !== safePathname) {
                      setNavigating(item.href);
                      setSidebarOpen(false);
                    } else {
                      e.preventDefault();
                    }
                  }}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors duration-150 ${
                    active
                      ? 'border-l-2 border-gray-900 bg-gray-100 font-medium text-gray-900'
                      : 'border-l-2 border-transparent text-slate-600 hover:bg-slate-200/40 hover:text-slate-900'
                  }`}
                >
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center">
                    <item.icon
                      aria-hidden="true"
                      className={`h-5 w-5 ${active ? 'text-gray-900' : 'text-gray-500'}`}
                    />
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm">{item.name}</span>
                </Link>
              );
            })}
          </nav>

          <div className="shrink-0 border-t border-gray-300 p-4">
            <div className="flex items-center justify-between gap-3">
              <Link
                href={ROUTES.OWNER_PROFILE}
                className="min-w-0 flex-1 flex items-center gap-3"
                onClick={() => setSidebarOpen(false)}
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-200 text-slate-600 overflow-hidden">
                  {profileImageUrl ? (
                    <Image
                      src={profileImageUrl}
                      alt="Owner profile"
                      width={36}
                      height={36}
                      unoptimized
                    />
                  ) : (
                    <ProfileIcon className="h-5 w-5 text-gray-500" aria-hidden="true" />
                  )}
                </div>
                <div className="min-w-0 flex-1 flex flex-col">
                  <span className="truncate text-sm font-medium text-slate-900">
                    {userName || 'User'}
                  </span>
                  <span className="truncate text-xs text-slate-500">{userEmail || ''}</span>
                </div>
              </Link>
              <button
                onClick={() => {
                  window.location.href = '/api/auth/signout?redirect_to=%2F';
                }}
                className="shrink-0 rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-200/60 hover:text-slate-900"
                title="Sign out"
              >
                <LogoutIcon className="h-5 w-5 text-gray-500" aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
