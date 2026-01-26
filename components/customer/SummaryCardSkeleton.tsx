'use client';

export default function SummaryCardSkeleton() {
  return (
    <div className="bg-white rounded-xl shadow-md p-6 border border-gray-200 animate-pulse">
      <div className="flex items-center gap-3">
        <div className="bg-gray-200 rounded-lg p-3 w-12 h-12"></div>
        <div className="flex-1">
          <div className="h-6 bg-gray-200 rounded w-12 mb-2"></div>
          <div className="h-4 bg-gray-200 rounded w-20"></div>
        </div>
      </div>
    </div>
  );
}
