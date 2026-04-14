'use client';

import { memo, useMemo, useCallback } from 'react';
import { Button } from './button';
import ChevronLeftIcon from '@/src/icons/chevron-left.svg';
import ChevronRightIcon from '@/src/icons/chevron-right.svg';
import { cn } from '@/lib/utils/cn';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  totalItems: number;
  itemsPerPage: number;
  /** Noun for the summary line, e.g. "salons" or "bookings". */
  itemsLabel?: string;
  className?: string;
}

function PaginationComponent({
  currentPage,
  totalPages,
  onPageChange,
  totalItems,
  itemsPerPage,
  itemsLabel = 'salons',
  className,
}: PaginationProps) {
  const startItem = (currentPage - 1) * itemsPerPage + 1;
  const endItem = Math.min(currentPage * itemsPerPage, totalItems);

  const pageNumbers = useMemo(() => {
    const pages: (number | string)[] = [];
    const maxVisible = 5;

    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      if (currentPage <= 3) {
        for (let i = 1; i <= 4; i++) {
          pages.push(i);
        }
        pages.push('ellipsis');
        pages.push(totalPages);
      } else if (currentPage >= totalPages - 2) {
        pages.push(1);
        pages.push('ellipsis');
        for (let i = totalPages - 3; i <= totalPages; i++) {
          pages.push(i);
        }
      } else {
        pages.push(1);
        pages.push('ellipsis');
        for (let i = currentPage - 1; i <= currentPage + 1; i++) {
          pages.push(i);
        }
        pages.push('ellipsis');
        pages.push(totalPages);
      }
    }

    return pages;
  }, [currentPage, totalPages]);

  const handlePrevious = useCallback(() => {
    onPageChange(currentPage - 1);
  }, [onPageChange, currentPage]);

  const handleNext = useCallback(() => {
    onPageChange(currentPage + 1);
  }, [onPageChange, currentPage]);

  if (totalPages <= 1) return null;

  return (
    <div
      className={cn(
        'mt-4 flex flex-col items-center justify-between gap-3 border-t border-gray-200 pt-4 sm:flex-row',
        className
      )}
    >
      <div className="text-sm text-gray-600">
        Showing <span className="font-semibold text-gray-900">{startItem}</span> to{' '}
        <span className="font-semibold text-gray-900">{endItem}</span> of{' '}
        <span className="font-semibold text-gray-900">{totalItems}</span> {itemsLabel}
      </div>

      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={handlePrevious}
          disabled={currentPage === 1}
          className="disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <ChevronLeftIcon className="w-4 h-4" aria-hidden="true" />
          <span className="sr-only">Previous</span>
        </Button>

        <div className="flex items-center gap-1">
          {pageNumbers.map((page, index) => {
            if (page === 'ellipsis') {
              return (
                <span key={`ellipsis-${index}`} className="px-2 text-gray-400">
                  ...
                </span>
              );
            }

            const pageNum = page as number;
            const isActive = pageNum === currentPage;

            return (
              <PageButton
                key={pageNum}
                pageNum={pageNum}
                isActive={isActive}
                onPageChange={onPageChange}
              />
            );
          })}
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={handleNext}
          disabled={currentPage === totalPages}
          className="disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <span className="sr-only">Next</span>
          <ChevronRightIcon className="w-4 h-4" aria-hidden="true" />
        </Button>
      </div>
    </div>
  );
}

const PageButton = memo(function PageButton({
  pageNum,
  isActive,
  onPageChange,
}: {
  pageNum: number;
  isActive: boolean;
  onPageChange: (page: number) => void;
}) {
  const handleClick = useCallback(() => {
    onPageChange(pageNum);
  }, [onPageChange, pageNum]);

  return (
    <button
      onClick={handleClick}
      className={`min-w-[2.5rem] h-10 px-3 rounded-lg text-sm font-medium transition-colors ${
        isActive
          ? 'bg-black text-white'
          : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300'
      }`}
      aria-label={`Go to page ${pageNum}`}
      aria-current={isActive ? 'page' : undefined}
    >
      {pageNum}
    </button>
  );
});

const Pagination = memo(PaginationComponent);
export default Pagination;
