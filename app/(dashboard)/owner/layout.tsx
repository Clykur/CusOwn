import { redirect } from 'next/navigation';
import { resolveUserAndRedirect } from '@/lib/auth/resolve-user-and-redirect';
import OwnerLayoutShell from '@/components/owner/owner-layout-shell';

/**
 * Owner layout: server-side guard. Role deterministic at layout. Zero client session fetch.
 */
export default async function OwnerLayout({ children }: { children: React.ReactNode }) {
  if (process.env.NODE_ENV === 'development') {
    console.log('[owner layout] Rendering at', Date.now());
  }
  const resolved = await resolveUserAndRedirect(null, { requireScope: 'owner' });
  if (resolved.redirectUrl) {
    redirect(resolved.redirectUrl);
  }
  const initialUser = resolved.user?.id
    ? {
        id: resolved.user.id,
        email: resolved.user.email,
        full_name: (resolved.profile as { full_name?: string } | null)?.full_name,
      }
    : null;
  return (
    <OwnerLayoutShell
      role="owner"
      initialUser={initialUser}
      requireClientAuthCheck={resolved.requireClientAuthCheck}
    >
      {children}
    </OwnerLayoutShell>
  );
}
