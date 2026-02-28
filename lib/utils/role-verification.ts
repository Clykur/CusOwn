/**
 * Role verification utilities
 * Centralized functions to verify user roles and access.
 * O(1) profile-based checks used by API auth pipeline to avoid N+1.
 */

export type UserType = 'owner' | 'customer' | 'both' | 'admin';

/** Profile shape for O(1) role checks (no refetch). */
export interface ProfileLike {
  user_type?: string;
}

/**
 * O(1) check: is profile admin? Use when profile already fetched (single fetch per request).
 */
export function isAdminProfile(profile: ProfileLike | null): boolean {
  return profile?.user_type === 'admin';
}

/**
 * O(1) check: does profile have owner access (owner, both, or admin)?
 */
export function hasOwnerProfile(profile: ProfileLike | null): boolean {
  const t = profile?.user_type;
  return t === 'owner' || t === 'both' || t === 'admin';
}

/**
 * O(1) check: does profile have customer access (customer, both, or admin)?
 */
export function hasCustomerProfile(profile: ProfileLike | null): boolean {
  const t = profile?.user_type;
  return t === 'customer' || t === 'both' || t === 'admin';
}

/**
 * Get user profile - works in both client and server contexts
 */
async function getUserProfileSafe(userId: string): Promise<any> {
  // Check if we're in a server context (no window object)
  if (typeof window === 'undefined') {
    // Server-side: use server-auth
    const { getServerUserProfile } = await import('@/lib/supabase/server-auth');
    return getServerUserProfile(userId);
  } else {
    // Client-side: use client auth
    const { getUserProfile } = await import('@/lib/supabase/auth');
    return getUserProfile(userId);
  }
}

/**
 * Check if user has owner access (owner, both, or admin).
 * Pass profile to avoid second fetch (O(1) when profile provided).
 */
export async function hasOwnerAccess(
  userId: string,
  profile?: ProfileLike | null
): Promise<boolean> {
  if (profile !== undefined) return hasOwnerProfile(profile ?? null);
  try {
    const p = await getUserProfileSafe(userId);
    return hasOwnerProfile(p ?? null);
  } catch {
    return false;
  }
}

/**
 * Check if user has customer access (customer, both, or admin).
 * Pass profile to avoid second fetch (O(1) when profile provided).
 */
export async function hasCustomerAccess(
  userId: string,
  profile?: ProfileLike | null
): Promise<boolean> {
  if (profile !== undefined) return hasCustomerProfile(profile ?? null);
  try {
    const p = await getUserProfileSafe(userId);
    return hasCustomerProfile(p ?? null);
  } catch {
    return false;
  }
}

/**
 * Check if user has admin access.
 * Pass profile to avoid second fetch (O(1) when profile provided).
 */
export async function hasAdminAccess(
  userId: string,
  profile?: ProfileLike | null
): Promise<boolean> {
  if (profile !== undefined) return isAdminProfile(profile ?? null);
  try {
    const p = await getUserProfileSafe(userId);
    return isAdminProfile(p ?? null);
  } catch {
    return false;
  }
}

/**
 * Get user type
 */
export async function getUserType(userId: string): Promise<UserType | null> {
  try {
    const profile = await getUserProfileSafe(userId);
    if (!profile) return null;

    return (profile as any).user_type as UserType;
  } catch {
    return null;
  }
}

/**
 * Verify user owns a specific business
 */
export async function userOwnsBusiness(userId: string, businessId: string): Promise<boolean> {
  try {
    // Dynamically import userService to avoid bundling server-only code in client
    const { userService } = await import('@/services/user.service');
    const businesses = await userService.getUserBusinesses(userId);
    return businesses.some((b) => b.id === businessId);
  } catch {
    return false;
  }
}
