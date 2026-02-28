import { redirect } from 'next/navigation';
import { resolveUserAccess } from '@/services/access.service';
import { CAPABILITIES } from '@/config/constants';
import OwnerLayoutShell from '@/components/owner/owner-layout-shell';

/**
 * Owner layout: access via resolveUserAccess only. No business logic.
 */
export default async function OwnerLayout({ children }: { children: React.ReactNode }) {
  if (process.env.NODE_ENV === 'development') {
    console.log('[owner layout] Rendering at', Date.now());
  }
  const result = await resolveUserAccess(null, {
    requiredCapability: CAPABILITIES.ACCESS_OWNER_DASHBOARD,
  });
  if (!result.allowed && result.redirectUrl) {
    redirect(result.redirectUrl);
  }
  const initialUser = result.user?.id
    ? {
        id: result.user.id,
        email: result.user.email,
        full_name: (result.profile as { full_name?: string } | null)?.full_name,
        user_type: (
          result.profile as {
            user_type?: 'owner' | 'customer' | 'both' | 'admin';
          } | null
        )?.user_type,
        profile_media_id: (result.profile as { profile_media_id?: string | null } | null)
          ?.profile_media_id,
      }
    : null;
  return (
    <OwnerLayoutShell
      role="owner"
      initialUser={initialUser}
      requireClientAuthCheck={result.requireClientAuthCheck}
    >
      {children}
    </OwnerLayoutShell>
  );
}
