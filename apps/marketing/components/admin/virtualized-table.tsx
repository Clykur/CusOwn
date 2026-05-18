'use client';

import { useRef, memo } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';

interface Column<T> {
  key: string;
  header: string;
  width?: string;
  render: (item: T, index: number) => React.ReactNode;
  headerClassName?: string;
  cellClassName?: string;
}

interface VirtualizedTableProps<T> {
  data: T[];
  columns: Column<T>[];
  rowHeight?: number;
  maxHeight?: number;
  getRowKey: (item: T, index: number) => string;
  emptyMessage?: string;
  isLoading?: boolean;
  loadingRows?: number;
}

function VirtualizedTableInner<T>({
  data,
  columns,
  rowHeight = 56,
  maxHeight = 600,
  getRowKey,
  emptyMessage = 'No data available',
  isLoading = false,
  loadingRows = 5,
}: VirtualizedTableProps<T>) {
  const parentRef = useRef<HTMLDivElement>(null);

  const rowVirtualizer = useVirtualizer({
    count: isLoading ? loadingRows : data.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => rowHeight,
    overscan: 5,
  });

  if (!isLoading && data.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 py-12 text-center">
        <p className="text-sm font-medium text-slate-500">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full table-fixed border-collapse">
          <colgroup>
            {columns.map((col) => (
              <col key={col.key} style={{ width: col.width }} />
            ))}
          </colgroup>
          <thead className="sticky top-0 z-10">
            <tr className="border-b border-slate-200 bg-slate-50/80">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={`px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 ${col.headerClassName || ''}`}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
        </table>
      </div>

      <div ref={parentRef} className="overflow-auto" style={{ maxHeight: `${maxHeight}px` }}>
        <div
          style={{
            height: `${rowVirtualizer.getTotalSize()}px`,
            width: '100%',
            position: 'relative',
          }}
        >
          <table className="w-full table-fixed border-collapse">
            <colgroup>
              {columns.map((col) => (
                <col key={col.key} style={{ width: col.width }} />
              ))}
            </colgroup>
            <tbody>
              {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                if (isLoading) {
                  return (
                    <tr
                      key={virtualRow.key}
                      className="animate-pulse"
                      style={{
                        height: `${virtualRow.size}px`,
                        transform: `translateY(${virtualRow.start}px)`,
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        display: 'table',
                        tableLayout: 'fixed',
                      }}
                    >
                      {columns.map((col) => (
                        <td key={col.key} className="px-4 py-4" style={{ width: col.width }}>
                          <div className="h-4 bg-slate-200 rounded w-3/4" />
                        </td>
                      ))}
                    </tr>
                  );
                }

                const item = data[virtualRow.index];
                return (
                  <tr
                    key={getRowKey(item, virtualRow.index)}
                    className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors"
                    style={{
                      height: `${virtualRow.size}px`,
                      transform: `translateY(${virtualRow.start}px)`,
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      display: 'table',
                      tableLayout: 'fixed',
                    }}
                  >
                    {columns.map((col) => (
                      <td
                        key={col.key}
                        className={`px-4 py-3 ${col.cellClassName || ''}`}
                        style={{ width: col.width }}
                      >
                        {col.render(item, virtualRow.index)}
                      </td>
                    ))}
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

export const VirtualizedTable = memo(VirtualizedTableInner) as typeof VirtualizedTableInner;
