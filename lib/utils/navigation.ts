// Client-safe salon URL generation (uses API endpoint)
// For server-side, use getSecureSalonUrl directly from security.ts
let salonUrlCache: Map<string, { url: string; timestamp: number }> = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes cache

export const getSecureSalonUrlClient = async (
  salonId: string,
  forceRefresh = false
): Promise<string> => {
  // Validate salonId
  if (!salonId || typeof salonId !== 'string') {
    console.error('[CLIENT_URL_GEN] Invalid salonId provided:', salonId);
    return `/salon/${salonId || 'unknown'}`;
  }

  const startTime = Date.now();
  const salonIdPreview = salonId.length > 8 ? salonId.substring(0, 8) + '...' : salonId;
  console.log(
    '[CLIENT_URL_GEN] Starting client-side URL generation for salon:',
    salonIdPreview,
    'forceRefresh:',
    forceRefresh
  );

  // Check cache first (with TTL)
  const cached = salonUrlCache.get(salonId);
  if (cached && !forceRefresh && Date.now() - cached.timestamp < CACHE_TTL) {
    const cacheAge = Date.now() - cached.timestamp;
    console.log(
      `[CLIENT_URL_GEN] Using cached URL (age: ${Math.round(cacheAge / 1000)}s) for salon: ${salonIdPreview}`
    );
    return cached.url;
  }
  console.log('[CLIENT_URL_GEN] Cache miss or expired, generating new URL');

  // Debounce rapid requests
  const requestKey = `url_gen_${salonId}`;
  if ((window as any)[requestKey]) {
    console.log('[CLIENT_URL_GEN] Request already in progress, returning existing promise');
    return (window as any)[requestKey];
  }

  const requestPromise = (async () => {
    try {
      console.log('[CLIENT_URL_GEN] Fetching CSRF token...');
      // Get CSRF token
      let csrfToken: string | null = null;
      try {
        const { getCSRFToken } = await import('@/lib/utils/csrf-client');
        csrfToken = await getCSRFToken();
        console.log('[CLIENT_URL_GEN] CSRF token obtained:', csrfToken ? 'present' : 'missing');
      } catch (csrfError) {
        console.warn('[CLIENT_URL_GEN] Failed to get CSRF token:', csrfError);
      }

      if (!csrfToken) {
        console.warn('[CLIENT_URL_GEN] CSRF token not available, request may fail');
      }

      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };

      if (csrfToken) {
        headers['x-csrf-token'] = csrfToken;
      }

      console.log('[CLIENT_URL_GEN] Sending request to /api/security/generate-salon-url...');
      const requestBody = JSON.stringify({ salonId });
      console.log('[CLIENT_URL_GEN] Request body:', {
        salonId: salonIdPreview,
      });

      const response = await fetch('/api/security/generate-salon-url', {
        method: 'POST',
        headers,
        credentials: 'include',
        body: requestBody,
      });

      if (response.ok) {
        let data;
        try {
          data = await response.json();
        } catch (jsonError) {
          console.error('[CLIENT_URL_GEN] Failed to parse response JSON:', jsonError);
          throw jsonError;
        }

        if (data.success && data.data?.url) {
          const secureUrl = data.data.url;
          // Cache the URL with timestamp
          salonUrlCache.set(salonId, { url: secureUrl, timestamp: Date.now() });
          const duration = Date.now() - startTime;
          return secureUrl;
        } else {
          console.error('[CLIENT_URL_GEN] Invalid response structure:', {
            success: data.success,
            hasData: !!data.data,
            hasUrl: !!data.data?.url,
          });
        }
      } else {
        let errorData: any = {};
        try {
          errorData = await response.json();
          console.error('[CLIENT_URL_GEN] API error response:', {
            status: response.status,
            statusText: response.statusText,
            error: errorData.error || 'Unknown error',
          });
        } catch (jsonError) {
          console.error('[CLIENT_URL_GEN] Failed to parse error response:', jsonError);
          console.error(
            '[CLIENT_URL_GEN] Raw response status:',
            response.status,
            response.statusText
          );
        }
      }
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`[CLIENT_URL_GEN] Exception after ${duration}ms:`, error);
      if (error instanceof Error) {
        console.error('[CLIENT_URL_GEN] Error stack:', error.stack);
      }
    } finally {
      delete (window as any)[requestKey];
    }

    // Fallback: return URL with placeholder (will be validated server-side)
    console.warn('[CLIENT_URL_GEN] Returning fallback URL with pending token');
    return `/salon/${salonId || 'unknown'}?token=pending`;
  })();

  (window as any)[requestKey] = requestPromise;
  return requestPromise;
};

// Server-side only: direct secure URL generation
export const getSecureSalonUrlServer = (salonId: string): string => {
  if (typeof window !== 'undefined') {
    throw new Error('getSecureSalonUrlServer can only be used server-side');
  }
  const { getSecureSalonUrl } = require('@/lib/utils/security');
  return getSecureSalonUrl(salonId);
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
  if ((window as any)[requestKey]) {
    return (window as any)[requestKey];
  }

  const requestPromise = (async () => {
    try {
      const { getCSRFToken } = await import('@/lib/utils/csrf-client');
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
      delete (window as any)[requestKey];
    }

    return `/${resourceType === 'salon' ? 'salon' : resourceType === 'owner-dashboard' ? 'owner' : resourceType}/${resourceId}?token=pending`;
  })();

  (window as any)[requestKey] = requestPromise;
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
  OWNER_PROFILE: '/owner/profile',
  ADMIN_DASHBOARD: '/admin/dashboard',
  ADMIN_BUSINESS: (businessId: string) => `/admin/businesses/${businessId}`,
  ADMIN_BOOKING: (bookingId: string) => `/admin/bookings/${bookingId}`,
  ADMIN_USER: (userId: string) => `/admin/users/${userId}`,
  ACCEPT: (bookingId: string) => `/accept/${bookingId}`,
  REJECT: (bookingId: string) => `/reject/${bookingId}`,
  CATEGORIES: '/categories',
  SALON_LIST: '/categories/salon',
  // Note: SALON_DETAIL should be used with getSecureSalonUrlClient() for client-side
  // or getSecureSalonUrlServer() for server-side
  SALON_DETAIL: (salonId: string) => {
    if (typeof window === 'undefined') {
      // Server-side
      const { getSecureSalonUrl } = require('@/lib/utils/security');
      return getSecureSalonUrl(salonId);
    }
    // Client-side: return placeholder, actual URL generated via API
    return `/salon/${salonId}?token=pending`;
  },
  CUSTOMER_DASHBOARD: '/customer/dashboard',
  CUSTOMER_CATEGORIES: '/customer/categories',
  CUSTOMER_SALON_LIST: '/customer/categories/salon',
  CUSTOMER_PROFILE: '/customer/profile',
  PROFILE: '/profile',
  /** After login from public booking; completes pending booking and redirects to booking details. */
  BOOK_COMPLETE: '/book/complete',
  AUTH_LOGIN: (redirectTo?: string) =>
    redirectTo ? `/auth/login?redirect_to=${encodeURIComponent(redirectTo)}` : '/auth/login',
  SELECT_ROLE: (role?: string) => (role ? `/select-role?role=${role}` : '/select-role'),
} as const;

export const getAdminDashboardUrl = (tab?: string, page?: number): string => {
  const base = tab ? `/admin/dashboard?tab=${tab}` : '/admin/dashboard';
  if (page != null && page > 1) return `${base}${base.includes('?') ? '&' : '?'}page=${page}`;
  return base;
};

export const getOwnerDashboardUrl = (bookingLink?: string): string => {
  return bookingLink ? `/owner/${bookingLink}` : '/owner/dashboard';
};

// Client-side secure owner dashboard URL generation
export const getSecureOwnerDashboardUrlClient = async (bookingLink: string): Promise<string> => {
  return getSecureResourceUrlClient('owner-dashboard', bookingLink);
};

// Secure URL helpers for all resource types
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

// Server-side secure URL generation helpers
export const getSecureBookingUrlServer = (bookingLink: string): string => {
  if (typeof window !== 'undefined') {
    throw new Error('getSecureBookingUrlServer can only be used server-side');
  }
  const { getSecureResourceUrl } = require('@/lib/utils/security');
  return getSecureResourceUrl('booking', bookingLink);
};

export const getSecureBookingStatusUrlServer = (bookingId: string): string => {
  if (typeof window !== 'undefined') {
    throw new Error('getSecureBookingStatusUrlServer can only be used server-side');
  }
  const { getSecureResourceUrl } = require('@/lib/utils/security');
  return getSecureResourceUrl('booking-status', bookingId);
};

export const getSecureOwnerDashboardUrlServer = (bookingLink: string): string => {
  if (typeof window !== 'undefined') {
    throw new Error('getSecureOwnerDashboardUrlServer can only be used server-side');
  }
  const { getSecureResourceUrl } = require('@/lib/utils/security');
  return getSecureResourceUrl('owner-dashboard', bookingLink);
};

export const getSecureAcceptUrlServer = (bookingId: string): string => {
  if (typeof window !== 'undefined') {
    throw new Error('getSecureAcceptUrlServer can only be used server-side');
  }
  const { getSecureResourceUrl } = require('@/lib/utils/security');
  return getSecureResourceUrl('accept', bookingId);
};

export const getSecureRejectUrlServer = (bookingId: string): string => {
  if (typeof window !== 'undefined') {
    throw new Error('getSecureRejectUrlServer can only be used server-side');
  }
  const { getSecureResourceUrl } = require('@/lib/utils/security');
  return getSecureResourceUrl('reject', bookingId);
};
