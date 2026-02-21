/**
 * CANONICAL USER STATE SYSTEM
 *
 * This is the SINGLE SOURCE OF TRUTH for user state determination and redirect decisions.
 * All pages and APIs MUST use this utility - no duplicate logic allowed.
 *
 * Security: All checks are server-side. Client-side usage is for UX only.
 * Server: React cache() dedupes per request to avoid repeated getUserBusinesses.
 */

import { cache } from 'react';
import { ROUTES } from './navigation';

export type UserState =
  | 'S0' // Unauthenticated
  | 'S1' // Authenticated, No Profile
  | 'S2' // Customer Only
  | 'S3' // Owner, No Business
  | 'S4' // Owner, Has Business
  | 'S5' // Both Roles, No Business
  | 'S6' // Both Roles, Has Business
  | 'S7'; // Admin

export interface UserStateResult {
  state: UserState;
  authenticated: boolean;
  profileExists: boolean;
  userType: 'customer' | 'owner' | 'both' | 'admin' | null;
  businessCount: number;
  redirectUrl: string | null;
  reason: string;
  canAccessOwnerDashboard: boolean;
  canAccessCustomerDashboard: boolean;
  canAccessSetup: boolean;
  canAccessAdminDashboard: boolean;
}

/**
 * Get user profile - works in both client and server contexts
 * Dynamically imports the appropriate function based on context
 */
async function getUserProfileSafe(userId: string): Promise<any> {
  // Check if we're in a server context (no window object)
  if (typeof window === 'undefined') {
    // Server-side: use server-auth
    const { getServerUserProfile } = await import('@/lib/supabase/server-auth');
    return getServerUserProfile(userId);
  } else {
    // Client-side: server-only session
    const { getServerSessionClient } = await import('@/lib/auth/server-session-client');
    const { user, profile } = await getServerSessionClient();
    return user?.id === userId ? profile : null;
  }
}

/**
 * Check if user is admin - works in both contexts
 */
async function isAdminSafe(userId: string): Promise<boolean> {
  try {
    const profile = await getUserProfileSafe(userId);
    if (!profile) return false;
    return (profile as any).user_type === 'admin';
  } catch {
    return false;
  }
}

// Simple cache to prevent redundant API calls
let userStateCache: {
  userId: string | null;
  result: UserStateResult | null;
  timestamp: number;
} = {
  userId: null,
  result: null,
  timestamp: 0,
};

const CACHE_TTL = 5000; // Cache for 5 seconds

/** Inner implementation; shared by server (cached per-request) and client. */
async function computeUserState(
  userId: string | null,
  context: 'server' | 'client'
): Promise<UserStateResult> {
  if (!userId) {
    return {
      state: 'S0',
      authenticated: false,
      profileExists: false,
      userType: null,
      businessCount: 0,
      redirectUrl: null,
      reason: 'unauthenticated',
      canAccessOwnerDashboard: false,
      canAccessCustomerDashboard: false,
      canAccessSetup: false,
      canAccessAdminDashboard: false,
    };
  }

  try {
    const adminCheck = await isAdminSafe(userId);
    if (adminCheck) {
      return {
        state: 'S7',
        authenticated: true,
        profileExists: true,
        userType: 'admin',
        businessCount: 0, // Admins don't need businesses
        redirectUrl: ROUTES.ADMIN_DASHBOARD,
        reason: 'admin_user',
        canAccessOwnerDashboard: true,
        canAccessCustomerDashboard: true,
        canAccessSetup: false, // Admins don't need setup
        canAccessAdminDashboard: true,
      };
    }

    // Get user profile
    const profile = await getUserProfileSafe(userId);

    // S1: Authenticated but no profile
    if (!profile) {
      const result: UserStateResult = {
        state: 'S1',
        authenticated: true,
        profileExists: false,
        userType: null,
        businessCount: 0,
        redirectUrl: null,
        reason: 'no_profile',
        canAccessOwnerDashboard: false,
        canAccessCustomerDashboard: false,
        canAccessSetup: false,
        canAccessAdminDashboard: false,
      };

      // Cache the result (client-side only)
      if (context === 'client') {
        userStateCache = {
          userId,
          result,
          timestamp: Date.now(),
        };
      }

      return result;
    }

    const userType = (profile as any).user_type;

    let businessCount = 0;
    if (userType === 'owner' || userType === 'both') {
      try {
        let businesses: any[] = [];
        if (context === 'client') {
          // Client-side: server-only auth via cookies
          try {
            const response = await fetch('/api/owner/businesses', { credentials: 'include' });
            if (response.ok) {
              const result = await response.json();
              if (result.success && Array.isArray(result.data)) {
                businesses = result.data;
              } else if (result.success && result.data === null) {
                businesses = [];
              } else {
                businesses = [];
              }
            } else {
              if (process.env.NODE_ENV === 'development') {
                const errorText = await response.text();
                console.warn(`[USER_STATE:${context}] API error:`, response.status, errorText);
              }
              businesses = response.status === 401 || response.status === 403 ? [] : [];
            }
          } catch {
            businesses = [];
          }
        } else {
          // Server-side: use service directly
          const { userService } = await import('@/services/user.service');
          businesses = await userService.getUserBusinesses(userId);
        }

        businessCount = businesses?.length || 0;
      } catch (error) {
        // If business check fails, assume no businesses (fail-safe)
        console.error(`[USER_STATE:${context}] Failed to check businesses:`, error);
        businessCount = 0;
      }
    }

    // S2: Customer only
    if (userType === 'customer') {
      const result = {
        state: 'S2' as const,
        authenticated: true,
        profileExists: true,
        userType: 'customer' as const,
        businessCount: 0,
        redirectUrl: ROUTES.CUSTOMER_DASHBOARD,
        reason: 'customer_only',
        canAccessOwnerDashboard: false,
        canAccessCustomerDashboard: true,
        canAccessSetup: false,
        canAccessAdminDashboard: false,
      };

      // Cache the result (client-side only)
      if (context === 'client') {
        userStateCache = {
          userId,
          result,
          timestamp: Date.now(),
        };
      }

      return result;
    }

    // S3: Owner, no business
    if (userType === 'owner' && businessCount === 0) {
      // Check if we're already on setup page to provide context-aware message
      const currentPath = typeof window !== 'undefined' ? window.location.pathname : '';
      const result = {
        state: 'S3' as const,
        authenticated: true,
        profileExists: true,
        userType: 'owner' as const,
        businessCount: 0,
        redirectUrl: ROUTES.SETUP, // MANDATORY REDIRECT
        reason: 'owner_no_business',
        canAccessOwnerDashboard: false, // CRITICAL: Cannot access without business
        canAccessCustomerDashboard: false,
        canAccessSetup: true,
        canAccessAdminDashboard: false,
      };

      // Cache the result (client-side only)
      if (context === 'client') {
        userStateCache = {
          userId,
          result,
          timestamp: Date.now(),
        };
      }

      return result;
    }

    // S4: Owner, has business
    if (userType === 'owner' && businessCount >= 1) {
      const result = {
        state: 'S4' as const,
        authenticated: true,
        profileExists: true,
        userType: 'owner' as const,
        businessCount,
        redirectUrl: ROUTES.OWNER_DASHBOARD_BASE,
        reason: 'owner_with_business',
        canAccessOwnerDashboard: true,
        canAccessCustomerDashboard: false,
        canAccessSetup: false, // Has business, cannot access setup
        canAccessAdminDashboard: false,
      };

      // Cache the result (client-side only)
      if (context === 'client') {
        userStateCache = {
          userId,
          result,
          timestamp: Date.now(),
        };
      }

      return result;
    }

    // S5: Both roles, no business
    if (userType === 'both' && businessCount === 0) {
      const result = {
        state: 'S5' as const,
        authenticated: true,
        profileExists: true,
        userType: 'both' as const,
        businessCount: 0,
        redirectUrl: ROUTES.SETUP, // MANDATORY REDIRECT for owner access
        reason: 'both_no_business',
        canAccessOwnerDashboard: false, // CRITICAL: Cannot access without business
        canAccessCustomerDashboard: true,
        canAccessSetup: true,
        canAccessAdminDashboard: false,
      };

      // Cache the result (client-side only)
      if (context === 'client') {
        userStateCache = {
          userId,
          result,
          timestamp: Date.now(),
        };
      }

      return result;
    }

    // S6: Both roles, has business
    if (userType === 'both' && businessCount >= 1) {
      const result = {
        state: 'S6' as const,
        authenticated: true,
        profileExists: true,
        userType: 'both' as const,
        businessCount,
        redirectUrl: ROUTES.OWNER_DASHBOARD_BASE, // Default to owner dashboard
        reason: 'both_with_business',
        canAccessOwnerDashboard: true,
        canAccessCustomerDashboard: true,
        canAccessSetup: false, // Has business, cannot access setup
        canAccessAdminDashboard: false,
      };

      // Cache the result (client-side only)
      if (context === 'client') {
        userStateCache = {
          userId,
          result,
          timestamp: Date.now(),
        };
      }

      return result;
    }

    // Unknown state - fail safe
    return {
      state: 'S1', // Treat as no profile
      authenticated: true,
      profileExists: true,
      userType: userType as any,
      businessCount: 0,
      redirectUrl: null,
      reason: 'unknown_state',
      canAccessOwnerDashboard: false,
      canAccessCustomerDashboard: false,
      canAccessSetup: false,
      canAccessAdminDashboard: false,
    };
  } catch (error) {
    // Fail-safe: on error, treat as unauthenticated
    console.error(`[USER_STATE:${context}] Error determining user state:`, {
      error,
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });
    return {
      state: 'S0',
      authenticated: false,
      profileExists: false,
      userType: null,
      businessCount: 0,
      redirectUrl: null,
      reason: 'error',
      canAccessOwnerDashboard: false,
      canAccessCustomerDashboard: false,
      canAccessSetup: false,
      canAccessAdminDashboard: false,
    };
  }
}

const getCachedUserState = cache((userId: string | null) => computeUserState(userId, 'server'));

/**
 * Determine the canonical user state and redirect decision.
 * Server: one computation per request (React cache). Client: in-memory cache 5s.
 */
export async function getUserState(
  userId: string | null,
  options?: { skipCache?: boolean }
): Promise<UserStateResult> {
  const context = typeof window === 'undefined' ? 'server' : 'client';
  if (context === 'server') return getCachedUserState(userId);
  if (!options?.skipCache && userStateCache.userId === userId) {
    const cacheAge = Date.now() - userStateCache.timestamp;
    if (cacheAge < CACHE_TTL && userStateCache.result) return userStateCache.result;
  }
  return computeUserState(userId, 'client');
}

/**
 * Check if user should be redirected and where
 * This replaces the old getUserRedirectUrl function
 */
export async function shouldRedirectUser(userId: string | null): Promise<{
  shouldRedirect: boolean;
  redirectUrl: string | null;
  reason: string;
}> {
  const stateResult = await getUserState(userId);

  return {
    shouldRedirect: stateResult.redirectUrl !== null,
    redirectUrl: stateResult.redirectUrl,
    reason: stateResult.reason,
  };
}

/**
 * Clear the user state cache (useful after state changes like business creation)
 */
export function clearUserStateCache(): void {
  userStateCache = {
    userId: null,
    result: null,
    timestamp: 0,
  };
}

/**
 * Get redirect message for user (for UX display)
 */
export function getRedirectMessage(reason: string): string {
  const messages: Record<string, string> = {
    admin_user: 'Redirecting to admin dashboard…',
    owner_no_business: 'You need to create a business first. Redirecting to setup…',
    owner_with_business: 'Taking you to your businesses…',
    both_no_business:
      'You need to create a business to access owner features. Redirecting to setup…',
    both_with_business: 'Taking you to your dashboard…',
    customer_only: 'Taking you to your bookings…',
    no_profile: 'Please complete your profile setup.',
    unauthenticated: 'Please sign in to continue.',
    error: 'An error occurred. Please try again.',
  };

  return messages[reason] || 'Redirecting…';
}
