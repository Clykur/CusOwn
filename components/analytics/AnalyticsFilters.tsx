'use client';

import { useCallback, useEffect, useMemo, useState, memo } from 'react';
import { createPortal } from 'react-dom';
import { Download, ListFilter, Loader2, X } from 'lucide-react';
import FilterDropdown from '@/components/analytics/FilterDropdown';
import DateFilter from '@/components/owner/date-filter';
import { UI_CONTEXT } from '@/config/constants';
import { cn } from '@/lib/utils/cn';

function toDateInputValue(date: Date): string {
  return date.toISOString().split('T')[0];
}

const FILTER_TOKENS = {
  label: 'mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500',
};

/** Mobile: small, borderless ghost controls; md+: slightly larger with borders where needed. */
const ANALYTICS_TOOLBAR_ICON = 'h-[18px] w-[18px] shrink-0 md:h-5 md:w-5';

const analyticsToolbarBtnFilter = cn(
  'inline-flex shrink-0 items-center justify-center rounded-lg transition disabled:cursor-not-allowed',
  'h-8 w-8 border-0 bg-transparent text-slate-700 shadow-none hover:bg-slate-100/90 active:bg-slate-200/80',
  'md:h-9 md:w-9 md:border md:border-slate-200 md:bg-white md:text-slate-800 md:shadow-sm md:hover:bg-slate-50'
);

const analyticsToolbarBtnDownload = cn(
  'inline-flex shrink-0 items-center justify-center rounded-lg transition disabled:cursor-not-allowed',
  'h-8 w-8 border-0 bg-transparent text-slate-900 shadow-none hover:bg-slate-100/90 active:bg-slate-200/80',
  'md:h-9 md:w-9 md:bg-slate-900 md:text-white md:shadow-sm md:hover:bg-slate-800'
);

export function AnalyticsMobileToolbar({
  onExport,
  exporting,
  onOpenFilters,
  hasActiveFilters,
}: {
  onExport: () => void;
  exporting: boolean;
  onOpenFilters: () => void;
  hasActiveFilters: boolean;
}) {
  return (
    <div className="flex shrink-0 items-center gap-1 md:gap-2">
      <button
        type="button"
        onClick={onExport}
        disabled={exporting}
        className={analyticsToolbarBtnDownload}
        aria-label={
          exporting
            ? UI_CONTEXT.OWNER_ANALYTICS_EXPORTING
            : UI_CONTEXT.OWNER_ANALYTICS_DOWNLOAD_CSV_ARIA
        }
      >
        {exporting ? (
          <Loader2 className={cn(ANALYTICS_TOOLBAR_ICON, 'animate-spin')} aria-hidden="true" />
        ) : (
          <Download className={ANALYTICS_TOOLBAR_ICON} strokeWidth={1.75} aria-hidden="true" />
        )}
      </button>
      <button
        type="button"
        onClick={onOpenFilters}
        className={cn(
          analyticsToolbarBtnFilter,
          hasActiveFilters && 'bg-slate-200/60 md:border-slate-900/40 md:bg-slate-50'
        )}
        aria-label={UI_CONTEXT.OWNER_DASHBOARD_MOBILE_OPEN_FILTERS}
      >
        <ListFilter className={ANALYTICS_TOOLBAR_ICON} strokeWidth={1.75} aria-hidden="true" />
      </button>
    </div>
  );
}

interface AnalyticsFiltersProps {
  businesses: { id: string; salon_name: string; created_at?: string }[];
  selectedBusinessId: string;
  onBusinessChange: (value: string) => void;
  startDate: string;
  endDate: string;
  setStartDate: (v: string) => void;
  setEndDate: (v: string) => void;
  onExport: () => void;
  exporting: boolean;
  filterSheetOpen: boolean;
  onFilterSheetOpenChange: (open: boolean) => void;
  onHasActiveFiltersChange?: (active: boolean) => void;
}

function AnalyticsFiltersFields({
  variant,
  businesses,
  selectedBusinessId,
  onBusinessChange,
  startDate,
  endDate,
  setStartDate,
  setEndDate,
  onExport,
  exporting,
  selectedPreset,
  applyPreset,
  applyOverallRange,
}: Omit<
  AnalyticsFiltersProps,
  'filterSheetOpen' | 'onFilterSheetOpenChange' | 'onHasActiveFiltersChange'
> & {
  variant: 'desktop' | 'sheet';
  selectedPreset: string;
  applyPreset: (days: number) => void;
  applyOverallRange: () => void;
}) {
  const dropdownLayout = variant === 'sheet' ? 'inline' : 'popover';
  const showExport = variant === 'desktop';
  const businessOptions = useMemo(
    () => [
      {
        value: 'all',
        label: UI_CONTEXT.OWNER_DASHBOARD_BUSINESS_ALL,
        checked: selectedBusinessId === 'all',
      },
      ...businesses.map((business) => ({
        value: business.id,
        label: business.salon_name,
        checked: business.id === selectedBusinessId,
      })),
    ],
    [businesses, selectedBusinessId]
  );

  const quickRangeOptions = useMemo(
    () => [
      {
        value: 'all',
        label: UI_CONTEXT.OWNER_ANALYTICS_PRESET_OVERALL,
        checked: selectedPreset === 'all',
      },
      {
        value: '1',
        label: UI_CONTEXT.OWNER_ANALYTICS_PRESET_TODAY,
        checked: selectedPreset === '1',
      },
      {
        value: '7',
        label: UI_CONTEXT.OWNER_ANALYTICS_PRESET_7D,
        checked: selectedPreset === '7',
      },
      {
        value: '30',
        label: UI_CONTEXT.OWNER_ANALYTICS_PRESET_30D,
        checked: selectedPreset === '30',
      },
      {
        value: '90',
        label: UI_CONTEXT.OWNER_ANALYTICS_PRESET_90D,
        checked: selectedPreset === '90',
      },
    ],
    [selectedPreset]
  );

  const handleBusinessToggle = useCallback(
    (value: string, checked: boolean) => {
      if (checked) onBusinessChange(value);
    },
    [onBusinessChange]
  );

  const handleQuickRangeToggle = useCallback(
    (value: string, checked: boolean) => {
      if (!checked) return;

      if (value === 'all') {
        applyOverallRange();
        return;
      }

      applyPreset(Number(value));
    },
    [applyOverallRange, applyPreset]
  );

  const outerClass =
    variant === 'desktop'
      ? 'flex flex-col gap-4 rounded-xl bg-slate-100/60 p-4 xl:flex-row xl:flex-wrap xl:items-end xl:gap-6'
      : 'flex flex-col gap-4';

  return (
    <div className={outerClass}>
      <div className="w-full sm:w-[260px] xl:flex-1">
        <FilterDropdown
          layout={dropdownLayout}
          label={UI_CONTEXT.OWNER_DASHBOARD_BUSINESS}
          options={businessOptions}
          onToggle={handleBusinessToggle}
        />
      </div>

      <div className="w-full sm:w-[260px] xl:flex-1">
        <label className={FILTER_TOKENS.label}>{UI_CONTEXT.OWNER_ANALYTICS_START_DATE}</label>
        <DateFilter value={startDate} onChange={setStartDate} />
      </div>

      <div className="w-full sm:w-[260px] xl:flex-1">
        <label className={FILTER_TOKENS.label}>{UI_CONTEXT.OWNER_ANALYTICS_END_DATE}</label>
        <DateFilter value={endDate} onChange={setEndDate} />
      </div>

      <div className="w-full sm:w-[260px] xl:flex-1">
        <FilterDropdown
          layout={dropdownLayout}
          label={UI_CONTEXT.OWNER_ANALYTICS_QUICK_RANGE}
          options={quickRangeOptions}
          onToggle={handleQuickRangeToggle}
        />
      </div>

      {showExport ? (
        <div className="flex w-full items-end sm:w-auto">
          <button
            type="button"
            onClick={onExport}
            disabled={exporting}
            className={analyticsToolbarBtnDownload}
            aria-label={
              exporting
                ? UI_CONTEXT.OWNER_ANALYTICS_EXPORTING
                : UI_CONTEXT.OWNER_ANALYTICS_DOWNLOAD_CSV_ARIA
            }
          >
            {exporting ? (
              <Loader2 className={cn(ANALYTICS_TOOLBAR_ICON, 'animate-spin')} aria-hidden="true" />
            ) : (
              <Download className={ANALYTICS_TOOLBAR_ICON} strokeWidth={1.75} aria-hidden="true" />
            )}
          </button>
        </div>
      ) : null}
    </div>
  );
}

function AnalyticsFiltersComponent({
  businesses,
  selectedBusinessId,
  onBusinessChange,
  startDate,
  endDate,
  setStartDate,
  setEndDate,
  onExport,
  exporting,
  filterSheetOpen,
  onFilterSheetOpenChange,
  onHasActiveFiltersChange,
}: AnalyticsFiltersProps) {
  const [selectedPreset, setSelectedPreset] = useState<string>('30');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!filterSheetOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onFilterSheetOpenChange(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [filterSheetOpen, onFilterSheetOpenChange]);

  const overallStartDate = useMemo(() => {
    if (businesses.length === 0) return toDateInputValue(new Date());

    if (selectedBusinessId === 'all') {
      const timestamps = businesses
        .map((business) => (business.created_at ? new Date(business.created_at).getTime() : NaN))
        .filter((value) => Number.isFinite(value));

      if (timestamps.length === 0) return toDateInputValue(new Date());

      return toDateInputValue(new Date(Math.min(...timestamps)));
    }

    const selectedBusiness = businesses.find((business) => business.id === selectedBusinessId);

    if (!selectedBusiness?.created_at) return toDateInputValue(new Date());

    return toDateInputValue(new Date(selectedBusiness.created_at));
  }, [businesses, selectedBusinessId]);

  const applyPreset = useCallback(
    (days: number) => {
      const end = new Date();
      const start = new Date();
      start.setDate(end.getDate() - (days - 1));

      setStartDate(toDateInputValue(start));
      setEndDate(toDateInputValue(end));
      setSelectedPreset(String(days));
    },
    [setStartDate, setEndDate]
  );

  const applyOverallRange = useCallback(() => {
    setStartDate(overallStartDate);
    setEndDate(toDateInputValue(new Date()));
    setSelectedPreset('all');
  }, [overallStartDate, setStartDate, setEndDate]);

  useEffect(() => {
    if (selectedPreset !== 'all') return;
    setStartDate(overallStartDate);
    setEndDate(toDateInputValue(new Date()));
  }, [overallStartDate, selectedPreset, setEndDate, setStartDate]);

  const hasActiveFilters = useMemo(() => {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - 29);
    const defaultStart = toDateInputValue(start);
    const defaultEnd = toDateInputValue(end);
    const dateChanged = startDate !== defaultStart || endDate !== defaultEnd;
    const businessChanged = businesses.length > 1 && selectedBusinessId !== 'all';
    return dateChanged || businessChanged || selectedPreset !== '30';
  }, [startDate, endDate, businesses.length, selectedBusinessId, selectedPreset]);

  useEffect(() => {
    onHasActiveFiltersChange?.(hasActiveFilters);
  }, [hasActiveFilters, onHasActiveFiltersChange]);

  const sheetFieldProps = {
    businesses,
    selectedBusinessId,
    onBusinessChange,
    startDate,
    endDate,
    setStartDate,
    setEndDate,
    onExport,
    exporting,
    selectedPreset,
    applyPreset,
    applyOverallRange,
  };

  return (
    <div className="space-y-3">
      <div className="hidden md:block">
        <AnalyticsFiltersFields variant="desktop" {...sheetFieldProps} />
      </div>

      {mounted &&
        filterSheetOpen &&
        createPortal(
          <div
            className="fixed inset-0 z-[95] md:hidden"
            role="dialog"
            aria-modal="true"
            aria-labelledby="owner-analytics-mobile-filters-title"
          >
            <button
              type="button"
              className="absolute inset-0 bg-black/40"
              aria-label={UI_CONTEXT.OWNER_DASHBOARD_MOBILE_FILTERS_CLOSE_OVERLAY}
              onClick={() => onFilterSheetOpenChange(false)}
            />
            <div className="absolute bottom-0 left-0 right-0 z-10 max-h-[90vh] overflow-y-auto rounded-t-2xl bg-white px-4 pb-6 pt-4 shadow-xl">
              <div className="mb-4 flex items-center justify-between gap-2">
                <h2
                  id="owner-analytics-mobile-filters-title"
                  className="text-lg font-semibold text-slate-900"
                >
                  {UI_CONTEXT.OWNER_DASHBOARD_MOBILE_FILTERS_SHEET_TITLE}
                </h2>
                <button
                  type="button"
                  onClick={() => onFilterSheetOpenChange(false)}
                  className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100"
                  aria-label={UI_CONTEXT.OWNER_DASHBOARD_MOBILE_FILTERS_CLOSE_OVERLAY}
                >
                  <X className="h-5 w-5" aria-hidden="true" />
                </button>
              </div>
              <p className="mb-4 text-sm leading-relaxed text-slate-500">
                {UI_CONTEXT.OWNER_ANALYTICS_FILTERS_HINT}
              </p>
              <AnalyticsFiltersFields variant="sheet" {...sheetFieldProps} />
              <button
                type="button"
                onClick={() => onFilterSheetOpenChange(false)}
                className="mt-6 flex h-11 w-full items-center justify-center rounded-xl bg-slate-900 px-4 text-sm font-medium text-white transition hover:bg-slate-800"
              >
                {UI_CONTEXT.OWNER_DASHBOARD_MOBILE_FILTERS_DONE}
              </button>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}

const AnalyticsFilters = memo(AnalyticsFiltersComponent);
export default AnalyticsFilters;
