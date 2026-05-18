import { redirect } from 'next/navigation';
import { resolveUserAccess } from '@cusown/shared';
import { CAPABILITIES } from '@cusown/config';

/**
 * Admin layout: access via resolveUserAccess only. No business logic.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const result = await resolveUserAccess(null, {
    requiredCapability: CAPABILITIES.ACCESS_ADMIN_DASHBOARD,
  });
  if (!result.allowed && result.redirectUrl) {
    redirect(result.redirectUrl);
  }
  return <>{children}</>;
}
