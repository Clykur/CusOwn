/**
 * Role verification utilities
 * Centralized functions to verify user roles and access
 */

export type UserType = 'owner' | 'customer' | 'both' | 'admin';

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
 * Check if user has owner access (owner, both, or admin)
 */
export async function hasOwnerAccess(userId: string): Promise<boolean> {
  try {
    const profile = await getUserProfileSafe(userId);
    if (!profile) return false;
    
    const userType = (profile as any).user_type;
    return userType === 'owner' || userType === 'both' || userType === 'admin';
  } catch {
    return false;
  }
}

/**
 * Check if user has customer access (customer, both, or admin)
 */
export async function hasCustomerAccess(userId: string): Promise<boolean> {
  try {
    const profile = await getUserProfileSafe(userId);
    if (!profile) return false;
    
    const userType = (profile as any).user_type;
    return userType === 'customer' || userType === 'both' || userType === 'admin';
  } catch {
    return false;
  }
}

/**
 * Check if user has admin access
 */
export async function hasAdminAccess(userId: string): Promise<boolean> {
  try {
    const profile = await getUserProfileSafe(userId);
    if (!profile) return false;
    
    const userType = (profile as any).user_type;
    return userType === 'admin';
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
    return businesses.some(b => b.id === businessId);
  } catch {
    return false;
  }
}
