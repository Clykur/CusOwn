import { BookingPageSkeleton } from '@/components/ui/skeleton';

export default function BookingLoading() {
  return (
    <div className="min-h-screen bg-slate-50 py-8">
      <div className="max-w-lg mx-auto px-4">
        <BookingPageSkeleton />
      </div>
    </div>
  );
}
