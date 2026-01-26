export function SkeletonCard() {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6 animate-pulse">
      <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
      <div className="h-8 bg-gray-200 rounded w-1/2"></div>
    </div>
  );
}

export function SkeletonTable() {
  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      <div className="p-6 space-y-4">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex items-center space-x-4 animate-pulse">
            <div className="h-12 bg-gray-200 rounded w-1/4"></div>
            <div className="h-12 bg-gray-200 rounded w-1/4"></div>
            <div className="h-12 bg-gray-200 rounded w-1/4"></div>
            <div className="h-12 bg-gray-200 rounded w-1/4"></div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function SkeletonCardList() {
  return (
    <div className="space-y-4">
      {[1, 2, 3].map((i) => (
        <div key={i} className="bg-white border border-gray-200 rounded-lg p-4 animate-pulse">
          <div className="h-5 bg-gray-200 rounded w-3/4 mb-3"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2 mb-2"></div>
          <div className="h-4 bg-gray-200 rounded w-1/3"></div>
        </div>
      ))}
    </div>
  );
}
