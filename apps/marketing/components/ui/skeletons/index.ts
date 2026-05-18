// Base skeletons
export {
  Skeleton,
  SkeletonCard,
  SkeletonTable,
  SkeletonCardList,
  skeletonBase,
} from './base-skeleton';

// Common components
export {
  TableRowSkeleton,
  AdminTableSkeleton,
  ListSkeleton,
  UsersTableBodySkeleton,
} from './common/table-skeleton';
export { DashboardStatSkeleton, SalonCardSkeleton, SlotGridSkeleton } from './common/card-skeleton';
export {
  HomeSkeleton,
  LoginSkeleton,
  SelectRoleSkeleton,
  RedirectSkeleton,
} from './common/page-skeleton';
export { ProfileSkeleton } from './common/profile-skeleton';

// Admin skeletons
export {
  OverviewSkeleton,
  AdminDashboardSkeleton,
  BusinessesSkeleton,
  UsersSkeleton,
  BookingsSkeleton,
  AuditLogsSkeleton,
  AdminAnalyticsSkeleton,
} from './admin/admin-skeletons';

// Owner skeletons
export {
  OwnerDashboardSkeleton,
  OwnerBusinessesSkeleton,
  OwnerSetupSkeleton,
  OwnerProfileSkeleton,
  OwnerAnalyticsSkeleton,
  BusinessCreateSkeleton,
  OwnerSalonDetailLoadingBody,
} from './owner/owner-skeletons';

// Customer skeletons
export {
  CustomerDashboardSkeleton,
  CategoryGridSkeleton,
  SalonListSkeleton,
  BusinessProfileSkeleton,
} from './customer/customer-skeletons';

// Booking skeletons
export {
  BookingPageSkeleton,
  BookingStatusSkeleton,
  AcceptRejectSkeleton,
  SetupSkeleton,
  CalendarGridLoadingSkeleton,
} from './booking/booking-skeletons';
