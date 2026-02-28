import CustomerLayoutShell from '@/components/customer/customer-layout-shell';
import { resolveUserAccess } from '@/services/access.service';
import { CAPABILITIES } from '@/config/constants';

export default async function CustomerBusinessLayout({ children }: { children: React.ReactNode }) {
  const result = await resolveUserAccess(null, {
    requiredCapability: CAPABILITIES.ACCESS_CUSTOMER_DASHBOARD,
  });
  const initialUser =
    result.user?.id != null
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
    <CustomerLayoutShell
      role="customer"
      initialUser={initialUser}
      requireClientAuthCheck={result.requireClientAuthCheck}
    >
      {children}
    </CustomerLayoutShell>
  );
}
