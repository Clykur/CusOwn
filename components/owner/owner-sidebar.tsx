'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { signOut, getUserProfile } from '@/lib/supabase/auth';
import { ROUTES, getOwnerDashboardUrl } from '@/lib/utils/navigation';
import { supabaseAuth } from '@/lib/supabase/auth';
import { getUserState } from '@/lib/utils/user-state';
import { UI_CONTEXT } from '@/config/constants';

interface NavItem {
  name: string;
  href: string;
  icon: React.ReactNode;
  requiresBusiness?: boolean;
}

export default function OwnerSidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const cleanPath = pathname.split('?')[0];

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [navigating, setNavigating] = useState<string | null>(null);
  const [hasBusinesses, setHasBusinesses] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [userEmail, setUserEmail] = useState('');
  const [userName, setUserName] = useState('');

  // ===============================
  // Load user + business state
  // ===============================
  useEffect(() => {
    const loadUser = async () => {
      if (!supabaseAuth) {
        setLoading(false);
        return;
      }

      try {
        const {
          data: { session },
        } = await supabaseAuth.auth.getSession();

        if (!session?.user) {
          setHasBusinesses(false);
          return;
        }

        setUserEmail(session.user.email || '');

        try {
          const profile = await getUserProfile(session.user.id);
          setUserName((profile as any)?.full_name || session.user.email?.split('@')[0] || 'User');
        } catch {
          setUserName(session.user.email?.split('@')[0] || 'User');
        }

        const state = await getUserState(session.user.id);
        setHasBusinesses(state.businessCount > 0);
      } catch {
        setHasBusinesses(false);
      } finally {
        setLoading(false);
      }
    };

    loadUser();
  }, [pathname]);

  // ===============================
  // Navigation items (UNCHANGED)
  // ===============================
  const navItems: NavItem[] = [
    {
      name: 'Dashboard',
      href: '/owner/dashboard',
      requiresBusiness: true,
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeWidth={2} d="M3 12l9-9 9 9v9a1 1 0 01-1 1h-5v-6h-6v6H4a1 1 0 01-1-1z" />
        </svg>
      ),
    },
    {
      name: 'My Businesses',
      href: '/owner/businesses',
      requiresBusiness: true,
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeWidth={2} d="M4 21V3h16v18M9 7h1M9 11h1M9 15h1M14 7h1M14 11h1M14 15h1" />
        </svg>
      ),
    },
    {
      name: 'Create Business',
      href: '/setup',
      requiresBusiness: false,
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
      ),
    },
  ];

  const navigation =
    hasBusinesses === false ? navItems.filter((i) => !i.requiresBusiness) : navItems;

  // ===============================
  // ✅ FIXED ACTIVE STATE (ONLY CHANGE)
  // ===============================
  const isActive = (name: string) => {
    // Dashboard
    if (name === 'Dashboard') {
      return cleanPath === '/owner/dashboard';
    }

    // My Businesses (list + individual business pages)
    if (name === 'My Businesses') {
      return (
        cleanPath === '/owner/businesses' ||
        (cleanPath.startsWith('/owner/') && cleanPath !== '/owner/dashboard')
      );
    }

    // Create Business
    if (name === 'Create Business') {
      return cleanPath === '/setup';
    }

    return false;
  };

  // ===============================
  // Logout
  // ===============================
  const handleLogout = async () => {
    await signOut();
    router.push('/');
  };

  // ===============================
  // Render
  // ===============================
  return (
    <>
      {/* Mobile toggle */}
      <div className="lg:hidden fixed top-4 left-4 z-50">
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="p-2 bg-white border rounded-lg shadow"
        >
          ☰
        </button>
      </div>

      {sidebarOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/40 z-40"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={`fixed top-0 left-0 z-40 h-screen w-64 bg-white border-r transition-transform ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } lg:translate-x-0`}
      >
        <div className="h-full flex flex-col">
          {/* Header */}
          <div className="p-6 border-b">
            <h2 className="text-xl font-bold">Business Owner</h2>
            <p className="text-sm text-gray-500">{UI_CONTEXT.VIEWING_AS_OWNER}</p>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-2">
            {loading ? (
              <div className="flex justify-center py-10">
                <div className="animate-spin h-5 w-5 border-b-2 border-gray-400" />
              </div>
            ) : (
              navigation.map((item) => {
                const active = isActive(item.name);

                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    onClick={() => {
                      setNavigating(item.href);
                      setSidebarOpen(false);
                    }}
                    className={`flex items-center gap-3 px-4 py-3 rounded-lg ${
                      active ? 'bg-black text-white' : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    {item.icon}
                    <span>{item.name}</span>
                  </Link>
                );
              })
            )}
          </nav>

          {/* Profile */}
          <div className="p-4 border-t flex items-center justify-between">
            <Link href={ROUTES.PROFILE} className="min-w-0">
              <div className="text-sm font-semibold truncate">{userName}</div>
              <div className="text-xs text-gray-500 truncate">{userEmail}</div>
            </Link>
            <button
              onClick={handleLogout}
              className="flex-shrink-0 p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
              title="Sign Out"
            >
              {' '}
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {' '}
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                />{' '}
              </svg>{' '}
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
