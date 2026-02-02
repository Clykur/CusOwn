'use client';

export default function BookingCardSkeleton() {
  return (
    <div className="bg-gray-50 border-2 border-gray-200 rounded-2xl overflow-hidden animate-pulse" aria-busy="true" aria-hidden="true">
      <div className="p-4 sm:p-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <div className="bg-gray-200 rounded-xl p-2.5 w-10 h-10 flex-shrink-0"></div>
            <div className="flex-1 min-w-0">
              <div className="h-5 sm:h-6 bg-gray-200 rounded w-3/4 mb-2"></div>
              <div className="h-4 bg-gray-200 rounded w-1/2"></div>
            </div>
          </div>
          <div className="bg-gray-200 rounded-full w-20 h-6 flex-shrink-0"></div>
        </div>

        {/* Booking Details */}
        <div className="bg-white/60 rounded-xl p-4 mb-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center gap-3">
              <div className="bg-gray-200 rounded-lg p-2 w-8 h-8"></div>
              <div className="flex-1">
                <div className="h-3 bg-gray-200 rounded w-12 mb-2"></div>
                <div className="h-4 bg-gray-200 rounded w-24"></div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="bg-gray-200 rounded-lg p-2 w-8 h-8"></div>
              <div className="flex-1">
                <div className="h-3 bg-gray-200 rounded w-12 mb-2"></div>
                <div className="h-4 bg-gray-200 rounded w-20"></div>
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 mb-3">
          <div className="flex-1 sm:flex-initial h-10 bg-gray-200 rounded-xl"></div>
          <div className="flex-1 sm:flex-initial h-10 bg-gray-200 rounded-xl"></div>
        </div>

        {/* Booking ID */}
        <div className="pt-3 border-t border-gray-200/60">
          <div className="flex items-center justify-between gap-2">
            <div className="h-3 bg-gray-200 rounded w-20"></div>
            <div className="h-4 bg-gray-200 rounded w-24"></div>
          </div>
        </div>
      </div>
    </div>
  );
}
