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
 * Check if current user is admin (client-side)
 */
export const checkIsAdmin = async (userId: string): Promise<boolean> => {
  try {
    const profile = await getUserProfileSafe(userId);
    if (!profile) return false;
    return (profile as any).user_type === 'admin';
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

