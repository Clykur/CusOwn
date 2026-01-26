'use client';

import { useEffect, useState, useRef } from 'react';

interface PullToRefreshProps {
  onRefresh: () => Promise<void>;
  children: React.ReactNode;
  threshold?: number;
}

export default function PullToRefresh({ onRefresh, children, threshold = 80 }: PullToRefreshProps) {
  const [isPulling, setIsPulling] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const startY = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleTouchStart = (e: TouchEvent) => {
      // Only enable pull-to-refresh if at the top of the scrollable area
      if (container.scrollTop === 0) {
        startY.current = e.touches[0].clientY;
        setIsPulling(true);
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isPulling) return;

      const currentY = e.touches[0].clientY;
      const distance = currentY - startY.current;

      // Only allow pulling down
      if (distance > 0 && container.scrollTop === 0) {
        const pullAmount = Math.min(distance, threshold * 1.5);
        setPullDistance(pullAmount);
        e.preventDefault();
      } else {
        setIsPulling(false);
        setPullDistance(0);
      }
    };

    const handleTouchEnd = async () => {
      if (pullDistance >= threshold && !isRefreshing) {
        setIsRefreshing(true);
        setPullDistance(threshold);
        try {
          await onRefresh();
        } finally {
          setIsRefreshing(false);
          setPullDistance(0);
          setIsPulling(false);
        }
      } else {
        setPullDistance(0);
        setIsPulling(false);
      }
    };

    container.addEventListener('touchstart', handleTouchStart, { passive: false });
    container.addEventListener('touchmove', handleTouchMove, { passive: false });
    container.addEventListener('touchend', handleTouchEnd);

    return () => {
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);
    };
  }, [isPulling, pullDistance, threshold, onRefresh, isRefreshing]);

  const pullProgress = Math.min(pullDistance / threshold, 1);

  return (
    <div ref={containerRef} className="relative">
      {/* Pull Indicator */}
      {(isPulling || isRefreshing) && (
        <div
          className="fixed top-0 left-0 right-0 z-50 flex items-center justify-center bg-white border-b border-gray-200 transition-all duration-200"
          style={{
            height: `${Math.min(pullDistance, threshold)}px`,
            opacity: pullProgress,
            transform: `translateY(${Math.min(pullDistance - threshold, 0)}px)`,
          }}
        >
          {isRefreshing ? (
            <div className="flex items-center gap-2 text-gray-600">
              <div className="animate-spin rounded-full h-5 w-5 border-2 border-gray-600 border-t-transparent"></div>
              <span className="text-sm font-medium">Refreshing...</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-gray-600">
              <svg
                className="w-5 h-5 transition-transform"
                style={{ transform: `rotate(${pullProgress * 180}deg)` }}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
              </svg>
              <span className="text-sm font-medium">
                {pullDistance >= threshold ? 'Release to refresh' : 'Pull to refresh'}
              </span>
            </div>
          )}
        </div>
      )}
      <div style={{ transform: `translateY(${Math.max(0, pullDistance - threshold)}px)` }}>
        {children}
      </div>
    </div>
  );
}
