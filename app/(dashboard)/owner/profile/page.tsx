'use client';

import { ProfilePageContent } from '@/components/profile/profile-page-content';

/**
 * Profile under owner layout so sidebar stays visible. Uses same profile content as /profile with embedded layout.
 */
export default function OwnerProfilePage() {
  return <ProfilePageContent embedded fromOwner />;
}
