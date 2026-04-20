'use client';

import { useRef, memo } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { BookingWithDetails } from '@/types';

interface VirtualizedBookingListProps {
  bookings: BookingWithDetails[];
  renderItem: (booking: BookingWithDetails, index: number) => React.ReactNode;
  itemHeight?: number;
  maxHeight?: number;
  emptyMessage?: string;
  className?: string;
}

function VirtualizedBookingListInner({
  bookings,
  renderItem,
  itemHeight = 160,
  maxHeight = 600,
  emptyMessage = 'No bookings found',
  className = '',
}: VirtualizedBookingListProps) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: bookings.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => itemHeight,
    overscan: 3,
  });

  if (bookings.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div ref={parentRef} className={`overflow-auto ${className}`} style={{ maxHeight }}>
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {virtualizer.getVirtualItems().map((virtualRow) => {
          const booking = bookings[virtualRow.index];
          return (
            <div
              key={booking.id}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${virtualRow.start}px)`,
              }}
            >
              {renderItem(booking, virtualRow.index)}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export const VirtualizedBookingList = memo(VirtualizedBookingListInner);

interface VirtualizedBookingTableProps {
  bookings: BookingWithDetails[];
  renderRow: (booking: BookingWithDetails, index: number) => React.ReactNode;
  rowHeight?: number;
  maxHeight?: number;
  emptyMessage?: string;
  headers: React.ReactNode;
}

function VirtualizedBookingTableInner({
  bookings,
  renderRow,
  rowHeight = 72,
  maxHeight = 500,
  emptyMessage = 'No bookings found',
  headers,
}: VirtualizedBookingTableProps) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: bookings.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => rowHeight,
    overscan: 5,
  });

  if (bookings.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50 sticky top-0 z-10">{headers}</thead>
      </table>
      <div ref={parentRef} className="overflow-auto" style={{ maxHeight }}>
        <div
          style={{
            height: `${virtualizer.getTotalSize()}px`,
            width: '100%',
            position: 'relative',
          }}
        >
          <table className="min-w-full">
            <tbody className="bg-white divide-y divide-gray-200">
              {virtualizer.getVirtualItems().map((virtualRow) => {
                const booking = bookings[virtualRow.index];
                return (
                  <tr
                    key={booking.id}
                    className="hover:bg-gray-50 transition-colors"
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      height: `${virtualRow.size}px`,
                      transform: `translateY(${virtualRow.start}px)`,
                      display: 'table',
                      tableLayout: 'fixed',
                    }}
                  >
                    {renderRow(booking, virtualRow.index)}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export const VirtualizedBookingTable = memo(VirtualizedBookingTableInner);
