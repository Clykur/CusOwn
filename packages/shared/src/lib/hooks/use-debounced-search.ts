import { useState, useEffect, useRef, useMemo, useCallback } from 'react';

const DEFAULT_DEBOUNCE_MS = 300;

interface UseDebouncedSearchOptions<T> {
  items: T[];
  searchFields: (keyof T | ((item: T) => string | undefined))[];
  debounceMs?: number;
}

interface UseDebouncedSearchResult<T> {
  searchQuery: string;
  debouncedQuery: string;
  setSearchQuery: (query: string) => void;
  filteredItems: T[];
  isSearching: boolean;
}

export function useDebouncedSearch<T>({
  items,
  searchFields,
  debounceMs = DEFAULT_DEBOUNCE_MS,
}: UseDebouncedSearchOptions<T>): UseDebouncedSearchResult<T> {
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (searchQuery !== debouncedQuery) {
      setIsSearching(true);
    }

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      setDebouncedQuery(searchQuery);
      setIsSearching(false);
    }, debounceMs);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [searchQuery, debounceMs, debouncedQuery]);

  const filteredItems = useMemo(() => {
    const q = debouncedQuery.trim().toLowerCase();
    if (!q) return items;

    return items.filter((item) =>
      searchFields.some((field) => {
        const value = typeof field === 'function' ? field(item) : item[field];
        return typeof value === 'string' && value.toLowerCase().includes(q);
      })
    );
  }, [items, debouncedQuery, searchFields]);

  return {
    searchQuery,
    debouncedQuery,
    setSearchQuery,
    filteredItems,
    isSearching,
  };
}

interface UsePaginationOptions {
  totalItems: number;
  pageSize?: number;
  initialPage?: number;
  onPageChange?: (page: number) => void;
}

interface UsePaginationResult<T> {
  page: number;
  setPage: (page: number | ((prev: number) => number)) => void;
  totalPages: number;
  start: number;
  end: number;
  paginateItems: (items: T[]) => T[];
}

export function usePagination<T>({
  totalItems,
  pageSize = 10,
  initialPage = 1,
  onPageChange,
}: UsePaginationOptions): UsePaginationResult<T> {
  const [internalPage, setInternalPage] = useState(initialPage);
  const page = initialPage !== internalPage && onPageChange ? initialPage : internalPage;

  const setPage = useCallback(
    (p: number | ((prev: number) => number)) => {
      const newPage = typeof p === 'function' ? p(page) : p;
      if (onPageChange) {
        onPageChange(newPage);
      } else {
        setInternalPage(newPage);
      }
    },
    [page, onPageChange]
  );

  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const start = (page - 1) * pageSize;
  const end = Math.min(start + pageSize, totalItems);

  const paginateItems = useCallback(
    (items: T[]): T[] => items.slice(start, start + pageSize),
    [start, pageSize]
  );

  return {
    page,
    setPage,
    totalPages,
    start,
    end,
    paginateItems,
  };
}
