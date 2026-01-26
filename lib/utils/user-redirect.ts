/**
 * @deprecated Use getUserState() and shouldRedirectUser() from '@/lib/utils/user-state' instead
 * This file is kept for backward compatibility but redirects to the new canonical system
 */

import { shouldRedirectUser } from './user-state';

export interface UserRedirectResult {
  shouldRedirect: boolean;
  redirectUrl: string | null;
  reason?: string;
}

/**
 * @deprecated Use shouldRedirectUser() from '@/lib/utils/user-state' instead
 * This function now delegates to the canonical user state system
 */
export async function getUserRedirectUrl(userId: string): Promise<UserRedirectResult> {
  const result = await shouldRedirectUser(userId);
  return {
    shouldRedirect: result.shouldRedirect,
    redirectUrl: result.redirectUrl,
    reason: result.reason,
  };
}
