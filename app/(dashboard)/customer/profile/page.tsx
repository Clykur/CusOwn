'use client';

import { ProfilePageContent } from '@/components/profile/profile-page-content';

/**
 * Customer profile under customer layout so sidebar stays visible.
 * Renders shared profile content in embedded mode (no duplicate wrapper).
 */
export default function CustomerProfilePage() {
  return <ProfilePageContent embedded fromOwner={false} />;
}
