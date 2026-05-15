'use client';

import { ProfilePageContent } from '@/components/profile/profile-page-content';

/**
 * Admin profile under admin layout so sidebar stays visible.
 */
export default function AdminProfilePage() {
  return <ProfilePageContent embedded />;
}
