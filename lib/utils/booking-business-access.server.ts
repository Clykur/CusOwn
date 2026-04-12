/**
 * Authorize booking mutations for the business that owns the booking.
 * Owner = businesses.owner_user_id matches user; platform admins (profile or admin:access) may act across businesses.
 */

import { PERMISSIONS, hasPermission } from '@/services/permission.service';
import { userService } from '@/services/user.service';
import type { ProfileLike } from '@/lib/utils/role-verification';
import { isAdminProfile } from '@/lib/utils/role-verification';

/**
 * True if the user may perform owner-level actions on bookings for this business
 * (business owner, or platform admin via profile or admin:access permission).
 */
export async function canManageBookingForBusiness(
  userId: string,
  profile: ProfileLike | null,
  businessId: string
): Promise<boolean> {
  const userBusinesses = await userService.getUserBusinesses(userId);
  if (userBusinesses.some((b) => b.id === businessId)) {
    return true;
  }
  if (isAdminProfile(profile)) {
    return true;
  }
  return hasPermission(userId, PERMISSIONS.ADMIN_ACCESS);
}
