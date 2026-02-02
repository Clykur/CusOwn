import { isAdminProfile, type ProfileLike } from '@/lib/utils/role-verification';

/**
 * Get user profile - works in both client and server contexts
 */
async function getUserProfileSafe(userId: string): Promise<any> {
  if (typeof window === 'undefined') {
    const { getServerUserProfile } = await import('@/lib/supabase/server-auth');
    return getServerUserProfile(userId);
  } else {
    const { getUserProfile } = await import('@/lib/supabase/auth');
    return getUserProfile(userId);
  }
}

/**
 * Check if current user is admin.
 * Pass profile when already fetched (O(1)); otherwise fetches once.
 */
export const checkIsAdmin = async (userId: string, profile?: ProfileLike | null): Promise<boolean> => {
  if (profile !== undefined) return isAdminProfile(profile ?? null);
  try {
    const p = await getUserProfileSafe(userId);
    return isAdminProfile(p ?? null);
  } catch {
    return false;
  }
};

/**
 * Check if current user is admin (server-side)
 * @deprecated Use checkIsAdmin instead - it works in both contexts
 */
export const checkIsAdminServer = async (userId: string): Promise<boolean> => {
  return checkIsAdmin(userId);
};

/**
 * Admin-only helper - throws error if not admin
 */
export const requireAdmin = async (userId: string): Promise<void> => {
  const isAdmin = await checkIsAdmin(userId);
  if (!isAdmin) {
    throw new Error('Admin access required');
  }
};

