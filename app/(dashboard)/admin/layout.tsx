import { redirect } from 'next/navigation';
import { resolveUserAccess } from '@/services/access.service';
import { CAPABILITIES } from '@/config/constants';
import { AdminLayoutShell } from '@/components/admin/admin-layout-shell';

/**
 * Admin layout: access via resolveUserAccess only. No business logic.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  if (process.env.NODE_ENV === 'development') {
    console.log('[admin layout] Rendering at', Date.now());
  }
  const result = await resolveUserAccess(null, {
    requiredCapability: CAPABILITIES.ACCESS_ADMIN_DASHBOARD,
  });
  if (!result.allowed && result.redirectUrl) {
    redirect(result.redirectUrl);
  }
  const initialSession = result.user?.id
    ? { user: { id: result.user.id, email: result.user.email }, profile: result.profile }
    : null;
  return (
    <AdminLayoutShell
      role="admin"
      initialSession={initialSession}
      initialAdminConfirmed={!result.requireClientAuthCheck}
      requireClientAuthCheck={result.requireClientAuthCheck}
    >
      {children}
    </AdminLayoutShell>
  );
}
