'use client';

import { useEffect, useMemo, useState } from 'react';
import FilterDropdown from '@/components/analytics/FilterDropdown';

function toDateInputValue(date: Date): string {
  return date.toISOString().split('T')[0];
}

const FILTER_TOKENS = {
  label: 'mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500',
  input:
    'h-11 w-full rounded-xl border border-slate-300 bg-white px-3.5 text-sm text-slate-800 shadow-sm transition-colors hover:border-slate-400 focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200',
  button:
    'h-11 whitespace-nowrap rounded-xl bg-slate-900 px-5 text-sm font-semibold text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60',
};

export default function AnalyticsFilters({
  businesses,
  selectedBusinessId,
  onBusinessChange,
  startDate,
  endDate,
  setStartDate,
  setEndDate,
  onExport,
  exporting,
}: {
  businesses: { id: string; salon_name: string; created_at?: string }[];
  selectedBusinessId: string;
  onBusinessChange: (value: string) => void;
  startDate: string;
  endDate: string;
  setStartDate: (v: string) => void;
  setEndDate: (v: string) => void;
  onExport: () => void;
  exporting: boolean;
}) {
  const [selectedPreset, setSelectedPreset] = useState<string>('30');

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

  const applyPreset = (days: number) => {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - (days - 1));
    setStartDate(toDateInputValue(start));
    setEndDate(toDateInputValue(end));
    setSelectedPreset(String(days));
  };

  const applyOverallRange = () => {
    setStartDate(overallStartDate);
    setEndDate(toDateInputValue(new Date()));
    setSelectedPreset('all');
  };

  useEffect(() => {
    if (selectedPreset !== 'all') return;
    setStartDate(overallStartDate);
    setEndDate(toDateInputValue(new Date()));
  }, [overallStartDate, selectedPreset, setEndDate, setStartDate]);

  const businessOptions = useMemo(
    () => [
      {
        value: 'all',
        label: 'All businesses',
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
      { value: 'all', label: 'Overall', checked: selectedPreset === 'all' },
      { value: '1', label: 'Today', checked: selectedPreset === '1' },
      { value: '7', label: '7 Days', checked: selectedPreset === '7' },
      { value: '30', label: '30 Days', checked: selectedPreset === '30' },
      { value: '90', label: '90 Days', checked: selectedPreset === '90' },
    ],
    [selectedPreset]
  );

  return (
    <div className="grid grid-cols-1 gap-4 rounded-xl bg-slate-50/70 p-4 xl:grid-cols-[minmax(260px,1fr)_minmax(180px,220px)_minmax(180px,220px)_minmax(180px,220px)_auto] xl:items-end">
      <FilterDropdown
        label="Business"
        options={businessOptions}
        onToggle={(value, checked) => {
          if (checked) onBusinessChange(value);
        }}
      />

      <div>
        <label className={FILTER_TOKENS.label}>Start date</label>
        <input
          type="date"
          value={startDate}
          onChange={(e) => {
            setSelectedPreset('');
            setStartDate(e.target.value);
          }}
          className={FILTER_TOKENS.input}
        />
      </div>

      <div>
        <label className={FILTER_TOKENS.label}>End date</label>
        <input
          type="date"
          value={endDate}
          onChange={(e) => {
            setSelectedPreset('');
            setEndDate(e.target.value);
          }}
          className={FILTER_TOKENS.input}
        />
      </div>

      <FilterDropdown
        label="Quick range"
        options={quickRangeOptions}
        onToggle={(value, checked) => {
          if (!checked) return;
          if (value === 'all') {
            applyOverallRange();
            return;
          }
          applyPreset(Number(value));
        }}
      />

      <button
        type="button"
        onClick={onExport}
        disabled={exporting}
        className={FILTER_TOKENS.button}
      >
        {exporting ? 'Exporting...' : 'Export CSV'}
      </button>
    </div>
  );
}
