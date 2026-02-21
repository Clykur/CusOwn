import { redirect } from 'next/navigation';
import { resolveUserAndRedirect } from '@/lib/auth/resolve-user-and-redirect';
import { AdminLayoutShell } from '@/components/admin/admin-layout-shell';

/**
 * Admin layout: server-side guard. Redirect before any UI. Role deterministic at layout.
 * Passes minimal user + role to shell; zero client session fetch.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  if (process.env.NODE_ENV === 'development') {
    console.log('[admin layout] Rendering at', Date.now());
  }
  const resolved = await resolveUserAndRedirect(null, { requireScope: 'admin' });
  if (resolved.redirectUrl) {
    redirect(resolved.redirectUrl);
  }
  const initialSession = resolved.user?.id
    ? { user: { id: resolved.user.id, email: resolved.user.email }, profile: resolved.profile }
    : null;
  return (
    <AdminLayoutShell
      role="admin"
      initialSession={initialSession}
      initialAdminConfirmed={!resolved.requireClientAuthCheck}
      requireClientAuthCheck={resolved.requireClientAuthCheck}
    >
      {children}
    </AdminLayoutShell>
  );
}
