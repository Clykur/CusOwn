import { getUserProfile } from '@/lib/supabase/auth';
import { getServerUserProfile } from '@/lib/supabase/server-auth';

/**
 * Check if current user is admin (client-side)
 */
export const checkIsAdmin = async (userId: string): Promise<boolean> => {
  try {
    const profile = await getUserProfile(userId);
    if (!profile) return false;
    return (profile as any).user_type === 'admin';
  } catch {
    return false;
  }
};

/**
 * Check if current user is admin (server-side)
 */
export const checkIsAdminServer = async (userId: string): Promise<boolean> => {
  try {
    const profile = await getServerUserProfile(userId);
    if (!profile) return false;
    return (profile as any).user_type === 'admin';
  } catch {
    return false;
  }
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

