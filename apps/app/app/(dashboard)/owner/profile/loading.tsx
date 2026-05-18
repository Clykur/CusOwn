import { ProfileLoadingPlaceholder } from '@/components/profile/profile-loading-placeholder';

/** SSR-safe; detailed skeleton renders after client mount in ProfilePageContent. */
export default function Loading() {
  return <ProfileLoadingPlaceholder embedded />;
}
