'use client';

import { useEffect, useCallback, useRef, useMemo, useState, memo } from 'react';
import { createPortal } from 'react-dom';
import dynamic from 'next/dynamic';
import { ListFilter, Search, X } from 'lucide-react';
import { OwnerDashboardSkeleton } from '@/components/ui/skeleton';
import { useOwnerSession } from '@/components/owner/owner-session-context';
import { BookingWithDetails } from '@/types';
import { IconCheck, IconCross } from '@/components/ui/status-icons';
import {
  BOOKING_STATUS,
  OWNER_DASHBOARD_MOBILE_BOOKINGS_PER_PAGE,
  OWNER_SCREEN_TITLE_CLASSNAME,
  UNDO_ACCEPT_REJECT_WINDOW_MINUTES,
  UI_CONTEXT,
} from '@/config/constants';
import FilterDropdown from '@/components/analytics/FilterDropdown';
import Pagination from '@/components/ui/pagination';
import { Toast } from '@/components/ui/toast';
import UndoIcon from '@/src/icons/undo.svg';
import { useBookingSyncChannel } from '@/lib/hooks/use-booking-sync-channel';
import { dedupFetch, cancelRequests } from '@/lib/utils/fetch-dedup';
import { useOwnerDashboardStore, useUIStore, type OwnerDashboardStatusFilter } from '@/lib/store';
import StarRating from '@/components/booking/star-rating';
import { cn } from '@/lib/utils/cn';

const DateFilter = dynamic(() => import('@/components/owner/date-filter'), {
  ssr: false,
  loading: () => (
    <div className="h-11 w-full rounded-xl bg-slate-100 animate-pulse md:h-9 md:w-32 md:rounded-lg" />
  ),
});

const NoShowButton = dynamic(() => import('@/components/booking/no-show-button'), {
  ssr: false,
  loading: () => (
    <button disabled className="px-3 py-1.5 text-xs bg-slate-100 text-slate-400 rounded-lg">
      Loading...
    </button>
  ),
});

const SEARCH_DEBOUNCE_MS = 300;

const Stat = memo(function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="overflow-visible rounded-xl border border-slate-200/90 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.06)] md:rounded-lg md:p-6 md:shadow-none">
      <div className="text-sm text-slate-500">{label}</div>
      <div className="mt-1 text-2xl font-bold tabular-nums tracking-tight text-slate-900 md:mt-0 md:text-3xl">
        {value}
      </div>
    </div>
  );
});

const StatsGrid = memo(function StatsGrid() {
  const stats = useOwnerDashboardStore((state) => state.stats);

  return (
    <div className="grid grid-cols-2 gap-3 md:gap-6 xl:grid-cols-2">
      <Stat label="Total Businesses" value={stats?.totalBusinesses ?? 0} />
      <Stat label="Total Bookings" value={stats?.totalBookings ?? 0} />
      <Stat label="Confirmed" value={stats?.confirmedBookings ?? 0} />
      <Stat label="Pending" value={stats?.pendingBookings ?? 0} />
    </div>
  );
});

function SearchInput() {
  const setSearchTerm = useOwnerDashboardStore((state) => state.setSearchTerm);
  const searchTermStore = useOwnerDashboardStore((state) => state.searchTerm);
  const [localValue, setLocalValue] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setLocalValue(searchTermStore);
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
  }, [searchTermStore]);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setLocalValue(value);

      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }

      debounceRef.current = setTimeout(() => {
        setSearchTerm(value);
      }, SEARCH_DEBOUNCE_MS);
    },
    [setSearchTerm]
  );

  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  return (
    <input
      type="text"
      placeholder={UI_CONTEXT.OWNER_DASHBOARD_SEARCH_PLACEHOLDER}
      value={localValue}
      onChange={handleChange}
      className="w-full h-11 rounded-xl border border-slate-200 bg-white px-4 text-sm shadow-sm placeholder:text-slate-400 focus:border-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10 md:h-9 md:rounded-lg md:shadow-none"
    />
  );
}

export default function OwnerDashboardPage() {
  const { initialUser } = useOwnerSession();

  const isLoading = useOwnerDashboardStore((state) => state.isLoading);
  const setIsLoading = useOwnerDashboardStore((state) => state.setIsLoading);
  const setStats = useOwnerDashboardStore((state) => state.setStats);
  const setBookings = useOwnerDashboardStore((state) => state.setBookings);
  const updateBooking = useOwnerDashboardStore((state) => state.updateBooking);
  const bookings = useOwnerDashboardStore((state) => state.bookings);
  const fromDate = useOwnerDashboardStore((state) => state.fromDate);
  const toDate = useOwnerDashboardStore((state) => state.toDate);
  const setFromDate = useOwnerDashboardStore((state) => state.setFromDate);
  const setToDate = useOwnerDashboardStore((state) => state.setToDate);
  const businessIdFilter = useOwnerDashboardStore((state) => state.businessIdFilter);
  const setBusinessIdFilter = useOwnerDashboardStore((state) => state.setBusinessIdFilter);
  const statusFilter = useOwnerDashboardStore((state) => state.statusFilter);
  const setStatusFilter = useOwnerDashboardStore((state) => state.setStatusFilter);
  const searchTerm = useOwnerDashboardStore((state) => state.searchTerm);
  const processingBookingId = useOwnerDashboardStore((state) => state.processingBookingId);
  const setProcessingBookingId = useOwnerDashboardStore((state) => state.setProcessingBookingId);

  const showToast = useUIStore((state) => state.showToast);
  const toasts = useUIStore((state) => state.toasts);
  const dismissToast = useUIStore((state) => state.dismissToast);

  const [mobileSearchExpanded, setMobileSearchExpanded] = useState(false);
  const [mobileFilterSheetOpen, setMobileFilterSheetOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  const undoTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mobileFilterSheetOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileFilterSheetOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [mobileFilterSheetOpen]);

  const businessOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const b of bookings) {
      if (b.business_id && b.salon?.salon_name && !map.has(b.business_id)) {
        map.set(b.business_id, b.salon.salon_name);
      }
    }
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [bookings]);

  const filteredBookings = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return bookings.filter((booking) => {
      const matchesSearch =
        !normalizedSearch ||
        booking.customer_name?.toLowerCase().includes(normalizedSearch) ||
        booking.customer_phone?.toLowerCase().includes(normalizedSearch) ||
        booking.booking_id?.toLowerCase().includes(normalizedSearch) ||
        booking.salon?.salon_name?.toLowerCase().includes(normalizedSearch);

      const bookingDate = booking.slot?.date ?? '';
      const matchesFromDate = !fromDate || (!!bookingDate && bookingDate >= fromDate);
      const matchesToDate = !toDate || (!!bookingDate && bookingDate <= toDate);

      const matchesStatus = statusFilter === 'all' || booking.status === statusFilter;

      const matchesBusiness = !businessIdFilter || booking.business_id === businessIdFilter;

      return matchesSearch && matchesFromDate && matchesToDate && matchesStatus && matchesBusiness;
    });
  }, [bookings, searchTerm, fromDate, toDate, statusFilter, businessIdFilter]);

  const hasActiveFilters = useMemo(() => {
    return !!(
      fromDate ||
      toDate ||
      businessIdFilter ||
      statusFilter !== 'all' ||
      searchTerm.trim()
    );
  }, [fromDate, toDate, businessIdFilter, statusFilter, searchTerm]);

  const [mobileListPage, setMobileListPage] = useState(1);
  const mobilePageSize = OWNER_DASHBOARD_MOBILE_BOOKINGS_PER_PAGE;
  const mobileTotalPages = Math.max(1, Math.ceil(filteredBookings.length / mobilePageSize));

  useEffect(() => {
    setMobileListPage(1);
  }, [searchTerm, fromDate, toDate, statusFilter, businessIdFilter]);

  useEffect(() => {
    const tp = Math.max(
      1,
      Math.ceil(filteredBookings.length / OWNER_DASHBOARD_MOBILE_BOOKINGS_PER_PAGE)
    );
    setMobileListPage((prev) => Math.min(prev, tp));
  }, [filteredBookings.length]);

  const paginatedMobileBookings = useMemo(() => {
    const start = (mobileListPage - 1) * mobilePageSize;
    return filteredBookings.slice(start, start + mobilePageSize);
  }, [filteredBookings, mobileListPage, mobilePageSize]);

  const statusFilterDropdownOptions = useMemo(
    () => [
      {
        value: 'all',
        label: UI_CONTEXT.OWNER_DASHBOARD_STATUS_ALL,
        checked: statusFilter === 'all',
      },
      {
        value: BOOKING_STATUS.PENDING,
        label: UI_CONTEXT.OWNER_DASHBOARD_STATUS_OPTION_PENDING,
        checked: statusFilter === BOOKING_STATUS.PENDING,
      },
      {
        value: BOOKING_STATUS.CONFIRMED,
        label: UI_CONTEXT.OWNER_DASHBOARD_STATUS_OPTION_CONFIRMED,
        checked: statusFilter === BOOKING_STATUS.CONFIRMED,
      },
      {
        value: BOOKING_STATUS.REJECTED,
        label: UI_CONTEXT.OWNER_DASHBOARD_STATUS_OPTION_REJECTED,
        checked: statusFilter === BOOKING_STATUS.REJECTED,
      },
      {
        value: BOOKING_STATUS.CANCELLED,
        label: UI_CONTEXT.OWNER_DASHBOARD_STATUS_OPTION_CANCELLED,
        checked: statusFilter === BOOKING_STATUS.CANCELLED,
      },
    ],
    [statusFilter]
  );

  const handleStatusFilterToggle = useCallback(
    (value: string, checked: boolean) => {
      if (!checked) return;
      setStatusFilter(value as OwnerDashboardStatusFilter);
    },
    [setStatusFilter]
  );

  const businessFilterDropdownOptions = useMemo(
    () => [
      {
        value: '',
        label: UI_CONTEXT.OWNER_DASHBOARD_BUSINESS_ALL,
        checked: businessIdFilter === '',
      },
      ...businessOptions.map(([id, name]) => ({
        value: id,
        label: name,
        checked: businessIdFilter === id,
      })),
    ],
    [businessIdFilter, businessOptions]
  );

  const handleBusinessFilterToggle = useCallback(
    (value: string, checked: boolean) => {
      if (!checked) return;
      setBusinessIdFilter(value);
    },
    [setBusinessIdFilter]
  );

  const getBookingById = useCallback((bookingId: string) => {
    return useOwnerDashboardStore.getState().bookings.find((b) => b.id === bookingId);
  }, []);

  const fetchDashboard = useCallback(async () => {
    if (!initialUser?.id) {
      setIsLoading(false);
      return;
    }

    try {
      cancelRequests('owner-dashboard');

      const url = '/api/owner/dashboard';
      const response = await dedupFetch(url, {
        credentials: 'include',
        dedupKey: 'owner-dashboard:all',
        cancelPrevious: true,
      });

      if (!response.ok) {
        setIsLoading(false);
        return;
      }

      const json = await response.json();
      if (json?.data) {
        const { stats: dashboardStats, recentBookings, bookingsByBusiness } = json.data;

        setStats({
          totalBusinesses: dashboardStats?.totalBusinesses ?? 0,
          totalBookings: dashboardStats?.totalBookings ?? 0,
          confirmedBookings: dashboardStats?.confirmedBookings ?? 0,
          pendingBookings: dashboardStats?.pendingBookings ?? 0,
          cancelledBookings: dashboardStats?.cancelledBookings ?? 0,
        });

        const allBookings: BookingWithDetails[] = [];
        if (bookingsByBusiness) {
          Object.values(bookingsByBusiness).forEach((businessBookings) => {
            if (Array.isArray(businessBookings)) {
              allBookings.push(...(businessBookings as BookingWithDetails[]));
            }
          });
        } else if (Array.isArray(recentBookings)) {
          allBookings.push(...recentBookings);
        }

        allBookings.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
        setBookings(allBookings);
      }
    } catch (err) {
      if ((err as Error)?.name !== 'AbortError') {
        console.error('[OwnerDashboard] Failed to fetch dashboard:', err);
      }
    } finally {
      setIsLoading(false);
    }
  }, [initialUser?.id, setIsLoading, setStats, setBookings]);

  const fetchBookings = useCallback(async () => {
    await fetchDashboard();
  }, [fetchDashboard]);

  const { publishBookingUpdated } = useBookingSyncChannel({
    onBookingUpdated: (event) => {
      updateBooking(event.bookingId, {
        status: event.status as BookingWithDetails['status'],
      });
    },
    onRefreshAll: () => {
      fetchBookings();
    },
  });

  // Fetch on mount only
  useEffect(() => {
    fetchDashboard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialUser?.id]);

  const handleClearFilters = useCallback(() => {
    useOwnerDashboardStore.getState().clearFilters();
  }, []);

  const handleAccept = async (bookingId: string) => {
    if (processingBookingId) return;
    if (!confirm('Are you sure you want to accept this booking?')) return;

    const prevBooking = getBookingById(bookingId);
    if (!prevBooking) return;

    setProcessingBookingId(bookingId);

    updateBooking(bookingId, {
      status: 'confirmed',
      updated_at: new Date().toISOString(),
    });

    try {
      const csrfToken = await (await import('@/lib/utils/csrf-client')).getCSRFToken();
      const headers: Record<string, string> = {};
      if (csrfToken) headers['x-csrf-token'] = csrfToken;

      const response = await fetch(`/api/bookings/${bookingId}/accept`, {
        method: 'POST',
        headers,
        credentials: 'include',
      });

      if (response.ok) {
        showToast('Booking accepted', 'success', 2000);
        publishBookingUpdated(bookingId, 'confirmed');
      } else {
        updateBooking(bookingId, {
          status: prevBooking.status,
          updated_at: prevBooking.updated_at,
          undo_used_at: prevBooking.undo_used_at,
        });
        const result = await response.json();
        showToast(result.error || 'Failed to accept booking', 'error', 2000);
      }
    } catch {
      updateBooking(bookingId, {
        status: prevBooking.status,
        updated_at: prevBooking.updated_at,
        undo_used_at: prevBooking.undo_used_at,
      });
      showToast('Failed to accept booking', 'error', 2000);
    } finally {
      setProcessingBookingId(null);
    }
  };

  const handleReject = async (bookingId: string) => {
    if (processingBookingId) return;
    if (!confirm('Are you sure you want to reject this booking?')) return;

    const prevBooking = getBookingById(bookingId);
    if (!prevBooking) return;

    setProcessingBookingId(bookingId);

    updateBooking(bookingId, {
      status: 'rejected',
      updated_at: new Date().toISOString(),
    });

    try {
      const csrfToken = await (await import('@/lib/utils/csrf-client')).getCSRFToken();
      const headers: Record<string, string> = {};
      if (csrfToken) headers['x-csrf-token'] = csrfToken;

      const response = await fetch(`/api/bookings/${bookingId}/reject`, {
        method: 'POST',
        headers,
        credentials: 'include',
      });

      if (response.ok) {
        showToast('Booking rejected', 'success', 2000);
        publishBookingUpdated(bookingId, 'rejected');
      } else {
        updateBooking(bookingId, {
          status: prevBooking.status,
          updated_at: prevBooking.updated_at,
          undo_used_at: prevBooking.undo_used_at,
        });
        const result = await response.json();
        showToast(result.error || 'Failed to reject booking', 'error', 2000);
      }
    } catch {
      updateBooking(bookingId, {
        status: prevBooking.status,
        updated_at: prevBooking.updated_at,
        undo_used_at: prevBooking.undo_used_at,
      });
      showToast('Failed to reject booking', 'error', 2000);
    } finally {
      setProcessingBookingId(null);
    }
  };

  const handleUndoAccept = useCallback(
    async (bookingId: string) => {
      if (processingBookingId) return;

      const prevBooking = getBookingById(bookingId);
      if (!prevBooking) return;

      setProcessingBookingId(bookingId);

      if (undoTimeoutRef.current) {
        clearTimeout(undoTimeoutRef.current);
        undoTimeoutRef.current = null;
      }

      updateBooking(bookingId, {
        status: 'pending',
        updated_at: new Date().toISOString(),
      });

      try {
        const csrfToken = await (await import('@/lib/utils/csrf-client')).getCSRFToken();
        const headers: Record<string, string> = {};
        if (csrfToken) headers['x-csrf-token'] = csrfToken;

        const res = await fetch(`/api/bookings/${bookingId}/undo-accept`, {
          method: 'POST',
          headers,
          credentials: 'include',
        });
        const json = await res.json();

        if (res.ok) {
          updateBooking(bookingId, json);
          showToast(UI_CONTEXT.REVERTED_TO_PENDING, 'success', 2000);
          publishBookingUpdated(bookingId, 'pending');
        } else {
          updateBooking(bookingId, {
            status: prevBooking.status,
            undo_used_at: prevBooking.undo_used_at ?? null,
            updated_at: prevBooking.updated_at,
          });
          showToast(json.error || 'Failed to undo', 'error', 2000);
        }
      } catch {
        updateBooking(bookingId, {
          status: prevBooking.status,
          undo_used_at: prevBooking.undo_used_at,
          updated_at: prevBooking.updated_at,
        });
        showToast('Failed to undo', 'error', 2000);
      } finally {
        setProcessingBookingId(null);
      }
    },
    [
      processingBookingId,
      getBookingById,
      updateBooking,
      setProcessingBookingId,
      showToast,
      publishBookingUpdated,
    ]
  );

  const handleUndoReject = useCallback(
    async (bookingId: string) => {
      if (processingBookingId) return;

      const prevBooking = getBookingById(bookingId);
      if (!prevBooking) return;

      setProcessingBookingId(bookingId);

      if (undoTimeoutRef.current) {
        clearTimeout(undoTimeoutRef.current);
        undoTimeoutRef.current = null;
      }

      updateBooking(bookingId, {
        status: 'pending',
        updated_at: new Date().toISOString(),
      });

      try {
        const csrfToken = await (await import('@/lib/utils/csrf-client')).getCSRFToken();
        const headers: Record<string, string> = {};
        if (csrfToken) headers['x-csrf-token'] = csrfToken;

        const res = await fetch(`/api/bookings/${bookingId}/undo-reject`, {
          method: 'POST',
          headers,
          credentials: 'include',
        });
        const json = await res.json();

        if (res.ok) {
          showToast(UI_CONTEXT.REVERTED_TO_PENDING, 'success', 2000);
          publishBookingUpdated(bookingId, 'pending');
        } else {
          updateBooking(bookingId, {
            status: prevBooking.status,
            undo_used_at: prevBooking.undo_used_at,
            updated_at: prevBooking.updated_at,
          });
          showToast(json.error || 'Failed to undo', 'error', 2000);
        }
      } catch {
        updateBooking(bookingId, {
          status: prevBooking.status,
          undo_used_at: prevBooking.undo_used_at,
          updated_at: prevBooking.updated_at,
        });
        showToast('Failed to undo', 'error', 2000);
      } finally {
        setProcessingBookingId(null);
      }
    },
    [
      processingBookingId,
      getBookingById,
      updateBooking,
      setProcessingBookingId,
      showToast,
      publishBookingUpdated,
    ]
  );

  const handleNoShowMarked = useCallback(
    (bookingId: string) => {
      updateBooking(bookingId, { no_show: true });
    },
    [updateBooking]
  );

  const canUndo = useCallback((b: BookingWithDetails) => {
    if (b.status !== 'confirmed' && b.status !== 'rejected') return false;
    if (b.undo_used_at) return false;
    const windowMs = UNDO_ACCEPT_REJECT_WINDOW_MINUTES * 60 * 1000;
    return Date.now() - new Date(b.updated_at).getTime() < windowMs;
  }, []);

  if (isLoading) return <OwnerDashboardSkeleton />;

  return (
    <div className="flex w-full flex-col gap-4 pb-24 md:gap-6">
      {toasts.map((toast) => (
        <Toast
          key={toast.id}
          message={toast.message}
          variant={toast.variant}
          onDismiss={() => dismissToast(toast.id)}
          duration={toast.duration}
        />
      ))}

      <StatsGrid />

      <div>
        <h2 className={cn(OWNER_SCREEN_TITLE_CLASSNAME, 'mb-3 md:mb-4')}>Your Customers</h2>
        <div className="overflow-visible rounded-none border-0 bg-transparent p-0 shadow-none md:rounded-lg md:border md:border-slate-200/90 md:bg-white md:p-6 md:shadow-none">
          <p className="mb-4 hidden text-sm leading-relaxed text-slate-500 md:block">
            {UI_CONTEXT.OWNER_DASHBOARD_FILTERS_HINT}
          </p>

          <div className="mb-4 hidden md:block">
            <div className="flex flex-col gap-4 md:flex-row md:flex-wrap md:items-end md:gap-x-4 md:gap-y-3">
              <h3 className="w-full border-b border-slate-100 pb-3 text-base font-semibold tracking-tight text-slate-900 md:mr-auto md:w-auto md:border-0 md:pb-0 md:text-lg">
                Bookings
              </h3>

              <div className="flex w-full min-w-0 flex-col gap-3 md:w-auto md:flex-1 md:flex-row md:flex-wrap md:items-end md:justify-end md:gap-x-4 md:gap-y-3">
                <div className="hidden w-full min-w-0 flex-col gap-1 md:flex md:w-auto md:min-w-[9.5rem] md:shrink-0">
                  <span className="text-xs font-medium text-slate-500">
                    {UI_CONTEXT.OWNER_DASHBOARD_STATUS}
                  </span>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as OwnerDashboardStatusFilter)}
                    className="h-10 w-full min-w-[9.5rem] rounded-lg border border-slate-200 bg-white px-3 text-sm focus:border-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10"
                    aria-label={UI_CONTEXT.OWNER_DASHBOARD_STATUS}
                  >
                    <option value="all">{UI_CONTEXT.OWNER_DASHBOARD_STATUS_ALL}</option>
                    <option value={BOOKING_STATUS.PENDING}>
                      {UI_CONTEXT.OWNER_DASHBOARD_STATUS_OPTION_PENDING}
                    </option>
                    <option value={BOOKING_STATUS.CONFIRMED}>
                      {UI_CONTEXT.OWNER_DASHBOARD_STATUS_OPTION_CONFIRMED}
                    </option>
                    <option value={BOOKING_STATUS.REJECTED}>
                      {UI_CONTEXT.OWNER_DASHBOARD_STATUS_OPTION_REJECTED}
                    </option>
                    <option value={BOOKING_STATUS.CANCELLED}>
                      {UI_CONTEXT.OWNER_DASHBOARD_STATUS_OPTION_CANCELLED}
                    </option>
                  </select>
                </div>

                {businessOptions.length > 1 && (
                  <div className="hidden w-full min-w-0 flex-col gap-1 md:flex md:max-w-[14rem] md:shrink-0">
                    <span className="text-xs font-medium text-slate-500">
                      {UI_CONTEXT.OWNER_DASHBOARD_BUSINESS}
                    </span>
                    <select
                      value={businessIdFilter}
                      onChange={(e) => setBusinessIdFilter(e.target.value)}
                      className="h-10 w-full min-w-[10rem] rounded-lg border border-slate-200 bg-white px-3 text-sm focus:border-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10"
                      aria-label={UI_CONTEXT.OWNER_DASHBOARD_BUSINESS}
                    >
                      <option value="">{UI_CONTEXT.OWNER_DASHBOARD_BUSINESS_ALL}</option>
                      {businessOptions.map(([id, name]) => (
                        <option key={id} value={id}>
                          {name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="grid w-full grid-cols-2 gap-3 md:contents">
                  <div className="flex min-w-0 flex-col gap-1 md:shrink-0">
                    <span
                      className="text-xs font-medium text-slate-500"
                      title={UI_CONTEXT.OWNER_DASHBOARD_APPOINTMENT_FROM}
                    >
                      {UI_CONTEXT.OWNER_DASHBOARD_APPOINTMENT_FROM}
                    </span>
                    <div className="w-full md:w-36 lg:w-40">
                      <DateFilter
                        value={fromDate}
                        onChange={setFromDate}
                        emptyLabel={UI_CONTEXT.OWNER_DASHBOARD_DATE_ALL}
                      />
                    </div>
                  </div>

                  <div className="flex min-w-0 flex-col gap-1 md:shrink-0">
                    <span
                      className="text-xs font-medium text-slate-500"
                      title={UI_CONTEXT.OWNER_DASHBOARD_APPOINTMENT_TO}
                    >
                      {UI_CONTEXT.OWNER_DASHBOARD_APPOINTMENT_TO}
                    </span>
                    <div className="w-full md:w-36 lg:w-40">
                      <DateFilter
                        value={toDate}
                        onChange={setToDate}
                        emptyLabel={UI_CONTEXT.OWNER_DASHBOARD_DATE_ALL}
                      />
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleClearFilters}
                  className="flex h-10 w-auto shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-800 transition hover:bg-gray-50"
                >
                  {UI_CONTEXT.OWNER_DASHBOARD_CLEAR_FILTERS}
                </button>
              </div>
            </div>

            <div className="mt-4">
              <SearchInput />
            </div>
          </div>

          <div className="mb-4 md:hidden">
            <div className="flex w-full min-w-0 items-center justify-between gap-3">
              <h3 className="min-w-0 truncate text-base font-semibold tracking-tight text-slate-900">
                Bookings
              </h3>
              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  onClick={() => setMobileSearchExpanded((open) => !open)}
                  className={cn(
                    'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-800 shadow-sm transition hover:bg-slate-50',
                    mobileSearchExpanded && 'border-slate-900 ring-2 ring-slate-900/10'
                  )}
                  aria-expanded={mobileSearchExpanded}
                  aria-label={UI_CONTEXT.OWNER_DASHBOARD_MOBILE_OPEN_SEARCH}
                >
                  <Search className="h-5 w-5 shrink-0" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={() => setMobileFilterSheetOpen(true)}
                  className={cn(
                    'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-800 shadow-sm transition hover:bg-slate-50',
                    hasActiveFilters && 'border-slate-900/40 bg-slate-50'
                  )}
                  aria-label={UI_CONTEXT.OWNER_DASHBOARD_MOBILE_OPEN_FILTERS}
                >
                  <ListFilter className="h-5 w-5 shrink-0" aria-hidden="true" />
                </button>
              </div>
            </div>
            {mobileSearchExpanded ? (
              <div className="mt-3">
                <SearchInput />
              </div>
            ) : null}
          </div>

          {mounted &&
            mobileFilterSheetOpen &&
            createPortal(
              <div
                className="fixed inset-0 z-[95] md:hidden"
                role="dialog"
                aria-modal="true"
                aria-labelledby="owner-dashboard-mobile-filters-title"
              >
                <button
                  type="button"
                  className="absolute inset-0 bg-black/40"
                  aria-label={UI_CONTEXT.OWNER_DASHBOARD_MOBILE_FILTERS_CLOSE_OVERLAY}
                  onClick={() => setMobileFilterSheetOpen(false)}
                />
                <div className="absolute bottom-0 left-0 right-0 z-10 max-h-[90vh] overflow-y-auto rounded-t-2xl bg-white px-4 pb-6 pt-4 shadow-xl">
                  <div className="mb-4 flex items-center justify-between gap-2">
                    <h2
                      id="owner-dashboard-mobile-filters-title"
                      className={OWNER_SCREEN_TITLE_CLASSNAME}
                    >
                      {UI_CONTEXT.OWNER_DASHBOARD_MOBILE_FILTERS_SHEET_TITLE}
                    </h2>
                    <button
                      type="button"
                      onClick={() => setMobileFilterSheetOpen(false)}
                      className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100"
                      aria-label={UI_CONTEXT.OWNER_DASHBOARD_MOBILE_FILTERS_CLOSE_OVERLAY}
                    >
                      <X className="h-5 w-5" aria-hidden="true" />
                    </button>
                  </div>
                  <p className="mb-4 text-sm leading-relaxed text-slate-500">
                    {UI_CONTEXT.OWNER_DASHBOARD_FILTERS_HINT}
                  </p>
                  <div className="flex flex-col gap-4">
                    <FilterDropdown
                      label={UI_CONTEXT.OWNER_DASHBOARD_STATUS}
                      options={statusFilterDropdownOptions}
                      onToggle={handleStatusFilterToggle}
                    />
                    {businessOptions.length > 1 ? (
                      <FilterDropdown
                        label={UI_CONTEXT.OWNER_DASHBOARD_BUSINESS}
                        options={businessFilterDropdownOptions}
                        onToggle={handleBusinessFilterToggle}
                      />
                    ) : null}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="flex min-w-0 flex-col gap-1">
                        <span className="text-xs font-medium text-slate-500">
                          {UI_CONTEXT.OWNER_DASHBOARD_APPOINTMENT_FROM}
                        </span>
                        <div className="w-full">
                          <DateFilter
                            value={fromDate}
                            onChange={setFromDate}
                            emptyLabel={UI_CONTEXT.OWNER_DASHBOARD_DATE_ALL}
                          />
                        </div>
                      </div>
                      <div className="flex min-w-0 flex-col gap-1">
                        <span className="text-xs font-medium text-slate-500">
                          {UI_CONTEXT.OWNER_DASHBOARD_APPOINTMENT_TO}
                        </span>
                        <div className="w-full">
                          <DateFilter
                            value={toDate}
                            onChange={setToDate}
                            emptyLabel={UI_CONTEXT.OWNER_DASHBOARD_DATE_ALL}
                          />
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleClearFilters}
                      className="flex h-11 w-full items-center justify-center rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-medium text-slate-800 transition hover:bg-slate-100"
                    >
                      {UI_CONTEXT.OWNER_DASHBOARD_CLEAR_FILTERS}
                    </button>
                    <button
                      type="button"
                      onClick={() => setMobileFilterSheetOpen(false)}
                      className="flex h-11 w-full items-center justify-center rounded-xl bg-slate-900 px-4 text-sm font-medium text-white transition hover:bg-slate-800"
                    >
                      {UI_CONTEXT.OWNER_DASHBOARD_MOBILE_FILTERS_DONE}
                    </button>
                  </div>
                </div>
              </div>,
              document.body
            )}

          {bookings.length > 0 && (
            <p className="mb-3 text-center text-sm text-slate-600 md:text-left">
              {UI_CONTEXT.OWNER_DASHBOARD_SHOWING_COUNT(filteredBookings.length, bookings.length)}
              {hasActiveFilters ? (
                <span className="text-slate-400">
                  {' '}
                  · {UI_CONTEXT.OWNER_DASHBOARD_FILTERS_ACTIVE}
                </span>
              ) : null}
            </p>
          )}

          {bookings.length === 0 ? (
            <div className="py-10 text-center md:py-12">
              <p className="text-sm text-slate-500 md:text-base">
                {UI_CONTEXT.OWNER_DASHBOARD_NO_BOOKINGS}
              </p>
            </div>
          ) : filteredBookings.length === 0 ? (
            <div className="py-10 text-center md:py-12">
              <p className="text-sm text-slate-500 md:text-base">
                {UI_CONTEXT.OWNER_DASHBOARD_NO_MATCH_FILTERS}
              </p>
            </div>
          ) : (
            <>
              <div className="hidden md:-mx-6 md:block md:overflow-x-auto">
                <div className="inline-block min-w-full align-middle px-4 sm:px-6">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 sm:px-6">
                          Customer
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 sm:px-6">
                          Date & Time
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 sm:px-6">
                          Booking ID
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 sm:px-6">
                          Business
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 sm:px-6">
                          Rating
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 sm:px-6">
                          Status & Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 bg-white">
                      {filteredBookings.map((booking) => (
                        <BookingTableRow
                          key={booking.id}
                          booking={booking}
                          processingBookingId={processingBookingId}
                          onAccept={handleAccept}
                          onReject={handleReject}
                          onUndoAccept={handleUndoAccept}
                          onUndoReject={handleUndoReject}
                          onNoShowMarked={handleNoShowMarked}
                          canUndo={canUndo}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="md:hidden">
                <div className="space-y-2.5">
                  {paginatedMobileBookings.map((booking) => (
                    <BookingMobileCard
                      key={booking.id}
                      booking={booking}
                      processingBookingId={processingBookingId}
                      onAccept={handleAccept}
                      onReject={handleReject}
                      onUndoAccept={handleUndoAccept}
                      onUndoReject={handleUndoReject}
                      onNoShowMarked={handleNoShowMarked}
                      canUndo={canUndo}
                    />
                  ))}
                </div>
                <Pagination
                  currentPage={mobileListPage}
                  totalPages={mobileTotalPages}
                  onPageChange={setMobileListPage}
                  totalItems={filteredBookings.length}
                  itemsPerPage={mobilePageSize}
                  itemsLabel={UI_CONTEXT.OWNER_DASHBOARD_PAGINATION_ITEMS_NOUN}
                />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

interface BookingTableRowProps {
  booking: BookingWithDetails;
  processingBookingId: string | null;
  onAccept: (id: string) => void;
  onReject: (id: string) => void;
  onUndoAccept: (id: string) => void;
  onUndoReject: (id: string) => void;
  onNoShowMarked: (id: string) => void;
  canUndo: (b: BookingWithDetails) => boolean;
}

type BookingHandlers = {
  onAccept: (id: string) => void;
  onReject: (id: string) => void;
  onUndoAccept: (id: string) => void;
  onUndoReject: (id: string) => void;
  onNoShowMarked: (id: string) => void;
};

/** Mobile card shows status in the header; hide duplicate pills in the action row. */
function BookingStatusActions({
  booking,
  processingBookingId,
  isSlotExpired,
  canUndoBooking,
  variant,
  omitStatusPills = false,
  ...handlers
}: {
  booking: BookingWithDetails;
  processingBookingId: string | null;
  isSlotExpired: boolean;
  canUndoBooking: boolean;
  variant: 'table' | 'card';
  omitStatusPills?: boolean;
} & BookingHandlers) {
  const { onAccept, onReject, onUndoAccept, onUndoReject, onNoShowMarked } = handlers;
  const hidePills = omitStatusPills && variant === 'card';
  const iconBtn =
    variant === 'card'
      ? 'flex h-10 w-10 min-h-10 min-w-10 items-center justify-center'
      : 'flex h-9 w-9 items-center justify-center';
  const undoBtn =
    variant === 'card'
      ? 'flex h-10 w-10 min-h-10 min-w-10 items-center justify-center rounded-lg'
      : 'flex h-9 w-9 items-center justify-center rounded-lg';

  return (
    <div
      className={cn(
        'flex items-center gap-2',
        variant === 'table' ? 'whitespace-nowrap' : 'mt-2 w-full flex-wrap justify-end gap-1.5'
      )}
    >
      {(() => {
        if (booking.status === 'pending' && !isSlotExpired) {
          return (
            <>
              {!hidePills ? (
                <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-700">
                  Pending
                </span>
              ) : null}
              <button
                type="button"
                onClick={() => onAccept(booking.id)}
                disabled={processingBookingId === booking.id}
                className={cn(
                  iconBtn,
                  'text-green-600 transition hover:text-green-700 disabled:opacity-50'
                )}
                title="Accept"
                aria-label="Accept booking"
              >
                <IconCheck className="h-6 w-6" />
              </button>
              <button
                type="button"
                onClick={() => onReject(booking.id)}
                disabled={processingBookingId === booking.id}
                className={cn(
                  iconBtn,
                  'text-red-600 transition hover:text-red-700 disabled:opacity-50'
                )}
                title="Reject"
                aria-label="Reject booking"
              >
                <IconCross className="h-6 w-6" />
              </button>
            </>
          );
        }
        if (booking.status === 'pending' && isSlotExpired) {
          return hidePills ? null : (
            <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-700">
              Expired
            </span>
          );
        }
        return null;
      })()}

      {booking.status === 'confirmed' && (
        <>
          {!hidePills ? (
            <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-800">
              Accepted
            </span>
          ) : null}
          {canUndoBooking && (
            <button
              type="button"
              onClick={() => onUndoAccept(booking.id)}
              disabled={processingBookingId === booking.id}
              title={UI_CONTEXT.UNDO_LABEL}
              className={cn(
                undoBtn,
                'bg-emerald-100 text-emerald-800 hover:bg-emerald-200 disabled:opacity-50'
              )}
            >
              <UndoIcon className="h-5 w-5" aria-hidden="true" />
            </button>
          )}
          {!booking.no_show &&
            !isSlotExpired &&
            (variant === 'card' ? (
              <div className="w-full basis-full">
                <NoShowButton bookingId={booking.id} onMarked={() => onNoShowMarked(booking.id)} />
              </div>
            ) : (
              <NoShowButton bookingId={booking.id} onMarked={() => onNoShowMarked(booking.id)} />
            ))}
        </>
      )}

      {booking.status === 'rejected' && canUndoBooking && (
        <>
          {!hidePills ? (
            <span className="rounded-full bg-rose-100 px-2.5 py-1 text-xs font-semibold text-rose-900">
              Rejected
            </span>
          ) : null}
          <button
            type="button"
            onClick={() => onUndoReject(booking.id)}
            disabled={processingBookingId === booking.id}
            title={UI_CONTEXT.UNDO_LABEL}
            className={cn(
              undoBtn,
              'bg-rose-100 text-rose-900 hover:bg-rose-200 disabled:opacity-50'
            )}
          >
            <UndoIcon className="h-5 w-5" aria-hidden="true" />
          </button>
        </>
      )}

      {((booking.status === 'rejected' && !canUndoBooking) ||
        booking.status === 'cancelled' ||
        String(booking.status) === 'expired') &&
        !hidePills && (
          <span
            className={cn(
              'rounded-full px-2.5 py-1 text-xs font-semibold',
              booking.status === 'rejected'
                ? 'bg-rose-100 text-rose-900'
                : 'bg-gray-100 text-gray-700'
            )}
          >
            {booking.status === 'rejected'
              ? 'Rejected'
              : booking.status === 'cancelled'
                ? booking.cancelled_by === 'customer'
                  ? UI_CONTEXT.CANCELLED_BY_CUSTOMER
                  : 'Cancelled'
                : 'Expired'}
          </span>
        )}
    </div>
  );
}

function formatAppointmentDate(dateStr: string) {
  try {
    return new Date(dateStr).toLocaleDateString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

function getMobileCardStatusBadge(booking: BookingWithDetails, isSlotExpired: boolean) {
  if (booking.status === 'pending' && !isSlotExpired) {
    return { label: 'Pending', className: 'bg-gray-100 text-gray-700' };
  }
  if (booking.status === 'pending' && isSlotExpired) {
    return { label: 'Expired', className: 'bg-gray-100 text-gray-700' };
  }
  if (booking.status === 'confirmed') {
    return { label: 'Accepted', className: 'bg-emerald-100 text-emerald-800' };
  }
  if (booking.status === 'rejected') {
    return { label: 'Rejected', className: 'bg-rose-100 text-rose-900' };
  }
  if (booking.status === 'cancelled') {
    return {
      label: booking.cancelled_by === 'customer' ? UI_CONTEXT.CANCELLED_BY_CUSTOMER : 'Cancelled',
      className: 'bg-gray-100 text-gray-700',
    };
  }
  if (String(booking.status) === 'expired') {
    return { label: 'Expired', className: 'bg-gray-100 text-gray-700' };
  }
  return null;
}

const BookingMobileCard = memo(function BookingMobileCard({
  booking,
  processingBookingId,
  onAccept,
  onReject,
  onUndoAccept,
  onUndoReject,
  onNoShowMarked,
  canUndo,
}: BookingTableRowProps) {
  const isSlotExpired = booking.slot
    ? new Date(`${booking.slot.date}T${booking.slot.end_time}`) <= new Date()
    : false;
  const canUndoBooking = canUndo(booking);
  const statusBadge = getMobileCardStatusBadge(booking, isSlotExpired);

  return (
    <article
      className="rounded-xl border border-slate-100 bg-white p-3 shadow-sm ring-1 ring-slate-900/[0.03]"
      aria-label={booking.booking_id}
    >
      <div className="flex items-start justify-between gap-3 border-b border-slate-100/90 pb-2.5">
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold leading-tight text-slate-900">
            {booking.customer_name}
          </div>
          <div className="mt-0.5 text-xs text-slate-500">{booking.customer_phone}</div>
        </div>
        <div className="shrink-0 text-right text-xs leading-tight">
          {booking.slot ? (
            <>
              <div className="font-medium text-slate-800">
                {formatAppointmentDate(booking.slot.date)}
              </div>
              <div className="text-slate-500">
                {booking.slot.start_time}–{booking.slot.end_time}
              </div>
            </>
          ) : (
            <span className="text-slate-400">N/A</span>
          )}
        </div>
      </div>

      <div className="mt-2 flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          {booking.salon?.salon_name ? (
            <p className="truncate text-xs font-medium text-slate-800">
              {booking.salon.salon_name}
            </p>
          ) : (
            <span className="text-xs text-slate-400">—</span>
          )}
        </div>
        {statusBadge ? (
          <span
            className={cn(
              'max-w-[48%] shrink-0 truncate rounded-full px-2 py-0.5 text-center text-[10px] font-semibold leading-tight',
              statusBadge.className
            )}
            title={statusBadge.label}
          >
            {statusBadge.label}
          </span>
        ) : null}
      </div>

      <div className="mt-2 flex items-center justify-between gap-2">
        <div className="min-w-0 shrink">
          {booking.review?.rating != null && booking.review.rating > 0 ? (
            <StarRating value={booking.review.rating} readonly size="sm" />
          ) : (
            <span className="text-xs text-slate-400">—</span>
          )}
        </div>
        <p className="max-w-[50%] shrink-0 text-right font-mono text-[10px] leading-snug text-slate-500">
          {booking.booking_id}
        </p>
      </div>

      <BookingStatusActions
        booking={booking}
        processingBookingId={processingBookingId}
        isSlotExpired={isSlotExpired}
        canUndoBooking={canUndoBooking}
        variant="card"
        omitStatusPills
        onAccept={onAccept}
        onReject={onReject}
        onUndoAccept={onUndoAccept}
        onUndoReject={onUndoReject}
        onNoShowMarked={onNoShowMarked}
      />
    </article>
  );
});

const BookingTableRow = memo(function BookingTableRow({
  booking,
  processingBookingId,
  onAccept,
  onReject,
  onUndoAccept,
  onUndoReject,
  onNoShowMarked,
  canUndo,
}: BookingTableRowProps) {
  const isSlotExpired = booking.slot
    ? new Date(`${booking.slot.date}T${booking.slot.end_time}`) <= new Date()
    : false;
  const canUndoBooking = canUndo(booking);

  return (
    <tr className="transition-colors hover:bg-gray-50">
      <td className="whitespace-nowrap px-4 py-4 sm:px-6">
        <div className="text-sm font-medium text-gray-900">{booking.customer_name}</div>
        <div className="text-sm text-gray-500">{booking.customer_phone}</div>
      </td>
      <td className="whitespace-nowrap px-4 py-4 sm:px-6">
        {booking.slot ? (
          <div>
            <div className="text-sm text-gray-900">
              {new Date(booking.slot.date).toLocaleDateString()}
            </div>
            <div className="text-sm text-gray-500">
              {booking.slot.start_time} - {booking.slot.end_time}
            </div>
          </div>
        ) : (
          <span className="text-sm text-gray-500">N/A</span>
        )}
      </td>
      <td className="whitespace-nowrap px-4 py-4 sm:px-6">
        <span className="font-mono text-sm text-gray-500">{booking.booking_id}</span>
      </td>
      <td className="whitespace-nowrap px-4 py-4 sm:px-6">
        <div className="text-sm text-gray-900">{booking.salon?.salon_name}</div>
      </td>
      <td className="whitespace-nowrap px-4 py-4 text-sm text-gray-600 sm:px-6">
        {booking.review?.rating ? (
          <StarRating value={booking.review.rating} readonly size="sm" />
        ) : (
          '—'
        )}
      </td>
      <td className="px-4 py-4 text-sm font-medium sm:px-6">
        <BookingStatusActions
          booking={booking}
          processingBookingId={processingBookingId}
          isSlotExpired={isSlotExpired}
          canUndoBooking={canUndoBooking}
          variant="table"
          onAccept={onAccept}
          onReject={onReject}
          onUndoAccept={onUndoAccept}
          onUndoReject={onUndoReject}
          onNoShowMarked={onNoShowMarked}
        />
      </td>
    </tr>
  );
});
