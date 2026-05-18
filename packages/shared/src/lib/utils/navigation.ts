// Client-safe salon URL generation (uses API endpoint)
import { publicEnv } from '@cusown/config';

let salonUrlCache: Map<string, { url: string; timestamp: number }> = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes cache

export const getAppUrl = (path: string) => {
  const base = (publicEnv.app.baseUrl || '').replace(/\/$/, '');
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${base}${p}`;
};

export const getMarketingUrl = (path: string) => {
  const base = (publicEnv.app.marketingUrl || '').replace(/\/$/, '');
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${base}${p}`;
};

export const getSecureSalonUrlClient = async (
  salonId: string,
  forceRefresh = false
): Promise<string> => {
  if (!salonId || typeof salonId !== 'string') {
    return `/salon/${salonId || 'unknown'}`;
  }

  const cached = salonUrlCache.get(salonId);
  if (cached && !forceRefresh && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.url;
  }

  const requestKey = `url_gen_${salonId}`;
  if (typeof window !== 'undefined' && (window as any)[requestKey]) {
    return (window as any)[requestKey];
  }

  const requestPromise = (async () => {
    try {
      let csrfToken: string | null = null;
      try {
        const { getCSRFToken } = await import('./csrf-client');
        csrfToken = await getCSRFToken();
      } catch {}

      const headers: HeadersInit = { 'Content-Type': 'application/json' };
      if (csrfToken) headers['x-csrf-token'] = csrfToken;

      const response = await fetch('/api/security/generate-salon-url', {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({ salonId }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data?.url) {
          const secureUrl = data.data.url;
          salonUrlCache.set(salonId, { url: secureUrl, timestamp: Date.now() });
          return secureUrl;
        }
      }
    } catch (error) {
      console.error(`[CLIENT_URL_GEN] Exception:`, error);
    } finally {
      if (typeof window !== 'undefined') delete (window as any)[requestKey];
    }

    return `/salon/${salonId || 'unknown'}?token=pending`;
  })();

  if (typeof window !== 'undefined') (window as any)[requestKey] = requestPromise;
  return requestPromise;
};

// Client-side secure URL generation for any resource type
export const getSecureResourceUrlClient = async (
  resourceType: 'salon' | 'booking' | 'booking-status' | 'owner-dashboard' | 'accept' | 'reject',
  resourceId: string
): Promise<string> => {
  const cacheKey = `${resourceType}_${resourceId}`;
  const cached = salonUrlCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.url;
  }

  const requestKey = `url_gen_${cacheKey}`;
  if (typeof window !== 'undefined' && (window as any)[requestKey]) {
    return (window as any)[requestKey];
  }

  const requestPromise = (async () => {
    try {
      const { getCSRFToken } = await import('./csrf-client');
      const csrfToken = await getCSRFToken();
      const headers: HeadersInit = { 'Content-Type': 'application/json' };
      if (csrfToken) headers['x-csrf-token'] = csrfToken;

      const response = await fetch('/api/security/generate-resource-url', {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({ resourceType, resourceId }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data?.url) {
          salonUrlCache.set(cacheKey, {
            url: data.data.url,
            timestamp: Date.now(),
          });
          return data.data.url;
        }
      }
    } catch (error) {
      console.error('Failed to generate secure resource URL:', error);
    } finally {
      if (typeof window !== 'undefined') delete (window as any)[requestKey];
    }

    return `/${resourceType === 'salon' ? 'salon' : resourceType === 'owner-dashboard' ? 'owner' : resourceType}/${resourceId}?token=pending`;
  })();

  if (typeof window !== 'undefined') (window as any)[requestKey] = requestPromise;
  return requestPromise;
};

export const ROUTES = {
  HOME: '/',
  SETUP: '/setup',
  BOOKING: (bookingLink: string) => `/book/${bookingLink}`,
  BOOKING_STATUS: (bookingId: string) => `/booking/${bookingId}`,
  OWNER_DASHBOARD: (bookingLink: string) => `/owner/${bookingLink}`,
  OWNER_DASHBOARD_BASE: '/owner/dashboard',
  OWNER_SETUP: '/owner/setup',
  OWNER_BUSINESS_SETUP: (businessId: string) => `/owner/businesses/${businessId}/setup`,
  OWNER_PROFILE: '/owner/profile',
  ADMIN_DASHBOARD: '/admin/dashboard',
  ADMIN_BUSINESS: (businessId: string) => `/admin/businesses/${businessId}`,
  ADMIN_BOOKING: (bookingId: string) => `/admin/bookings/${bookingId}`,
  ADMIN_USER: (userId: string) => `/admin/users/${userId}`,
  ACCEPT: (bookingId: string) => `/accept/${bookingId}`,
  REJECT: (bookingId: string) => `/reject/${bookingId}`,
  CATEGORIES: '/categories',
  SALON_LIST: '/categories/salon',
  SALON_DETAIL: (salonId: string) => `/salon/${salonId}?token=pending`,
  CUSTOMER_DASHBOARD: '/customer/dashboard',
  CUSTOMER_CATEGORIES: '/customer/categories',
  CUSTOMER_SALON_LIST: '/customer/categories/salon',
  CUSTOMER_PROFILE: '/customer/profile',
  PROFILE: '/profile',
  BOOK_COMPLETE: '/book/complete',
  AUTH_LOGIN: (redirectTo?: string) => {
    const path = redirectTo
      ? `/auth/login?redirect_to=${encodeURIComponent(redirectTo)}`
      : '/auth/login';
    return getAppUrl(path);
  },
  SELECT_ROLE: (role?: string) => {
    const path = role ? `/select-role?role=${role}` : '/select-role';
    return getAppUrl(path);
  },
} as const;

export const getAdminDashboardUrl = (tab?: string, page?: number): string => {
  const base = tab ? `/admin/dashboard?tab=${tab}` : '/admin/dashboard';
  if (page != null && page > 1) return `${base}${base.includes('?') ? '&' : '?'}page=${page}`;
  return base;
};

export const getOwnerDashboardUrl = (bookingLink?: string): string => {
  return bookingLink ? `/owner/${bookingLink}` : '/owner/dashboard';
};

export const getSecureOwnerDashboardUrlClient = async (bookingLink: string): Promise<string> => {
  return getSecureResourceUrlClient('owner-dashboard', bookingLink);
};

export const getSecureBookingUrlClient = async (bookingLink: string): Promise<string> => {
  return getSecureResourceUrlClient('booking', bookingLink);
};

export const getSecureBookingStatusUrlClient = async (bookingId: string): Promise<string> => {
  return getSecureResourceUrlClient('booking-status', bookingId);
};

export const getSecureAcceptUrlClient = async (bookingId: string): Promise<string> => {
  return getSecureResourceUrlClient('accept', bookingId);
};

export const getSecureRejectUrlClient = async (bookingId: string): Promise<string> => {
  return getSecureResourceUrlClient('reject', bookingId);
};
