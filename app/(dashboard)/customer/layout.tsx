import { redirect } from 'next/navigation';
import { resolveUserAndRedirect } from '@/lib/auth/resolve-user-and-redirect';
import CustomerLayoutShell from '@/components/customer/customer-layout-shell';

/**
 * Customer layout: server-side guard. Role deterministic at layout. Zero client session fetch.
 */
export default async function CustomerLayout({ children }: { children: React.ReactNode }) {
  if (process.env.NODE_ENV === 'development') {
    console.log('[customer layout] Rendering at', Date.now());
  }
  const resolved = await resolveUserAndRedirect(null, { requireScope: 'customer' });
  if (resolved.redirectUrl) {
    redirect(resolved.redirectUrl);
  }
  const initialUser =
    resolved.user?.id != null
      ? {
          id: resolved.user.id,
          email: resolved.user.email,
          full_name: (resolved.profile as { full_name?: string } | null)?.full_name,
        }
      : null;
  return (
    <CustomerLayoutShell
      role="customer"
      initialUser={initialUser}
      requireClientAuthCheck={resolved.requireClientAuthCheck}
    >
      {children}
    </CustomerLayoutShell>
  );
}
