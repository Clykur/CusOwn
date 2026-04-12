/**
 * Ownership checks for owner-scoped business APIs.
 */

import { userService } from '@/services/user.service';

export async function userOwnsBusinessId(userId: string, businessId: string): Promise<boolean> {
  const businesses = await userService.getUserBusinesses(userId, true);
  return businesses.some((b) => b.id === businessId);
}
