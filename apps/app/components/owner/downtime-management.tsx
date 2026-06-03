'use client';

import { memo } from 'react';
import { formatDate } from '@cusown/shared';
import CreateBusinessIcon from '@cusown/shared/icons/create-business.svg';
import DateFilter from '@/components/owner/date-filter';

interface Holiday {
  id: string;
  holiday_date: string;
  holiday_name?: string;
}

interface Closure {
  id: string;
  start_date: string;
  end_date: string;
  reason?: string;
}

interface DowntimeManagementProps {
  holidays: Holiday[];
  closures: Closure[];
  newHolidayDate: string;
  newHolidayName: string;
  newClosureStart: string;
  newClosureEnd: string;
  newClosureReason: string;
  onHolidayDateChange: (value: string) => void;
  onHolidayNameChange: (value: string) => void;
  onClosureStartChange: (value: string) => void;
  onClosureEndChange: (value: string) => void;
  onClosureReasonChange: (value: string) => void;
  onAddHoliday: () => void;
  onAddClosure: () => void;
  onRemoveHoliday?: (holidayId: string) => void;
  onRemoveClosure?: (closureId: string) => void;
}

function DowntimeManagementComponent({
  holidays,
  closures,
  newHolidayDate,
  newHolidayName,
  newClosureStart,
  newClosureEnd,
  newClosureReason,
  onHolidayDateChange,
  onHolidayNameChange,
  onClosureStartChange,
  onClosureEndChange,
  onClosureReasonChange,
  onAddHoliday,
  onAddClosure,
  onRemoveHoliday,
  onRemoveClosure,
}: DowntimeManagementProps) {
  return (
    <div className="space-y-6">
      <div className="bg-surface-card border border-border-primary rounded-lg p-4 lg:p-6">
        <h3 className="text-lg font-semibold text-text-primary mb-4">Holidays</h3>

        <div className="space-y-3 mb-6">
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">
              Holiday Date
            </label>
            <DateFilter value={newHolidayDate} onChange={onHolidayDateChange} />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-text-secondary">
              Holiday Name (Optional)
            </label>

            <input
              type="text"
              value={newHolidayName}
              onChange={(e) => onHolidayNameChange(e.target.value)}
              placeholder="e.g., New Year"
              className="
            h-11
            w-full
            rounded-xl
            border
            border-border-primary
            bg-surface-input
            px-4
            text-base
            text-text-primary
            placeholder:text-text-tertiary
            transition-all
            focus:outline-none
            focus:border-brand-primary
            focus:ring-2
            focus:ring-brand-primary/20
        "
            />
          </div>

          <button
            onClick={onAddHoliday}
            disabled={!newHolidayDate}
            className="w-full h-11 bg-brand-primary text-text-inverse font-semibold rounded-lg hover:bg-brand-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            <CreateBusinessIcon className="w-5 h-5" aria-hidden="true" />
            Add Holiday
          </button>
        </div>

        {holidays.length > 0 && (
          <div className="space-y-2">
            {holidays.map((holiday) => (
              <div
                key={holiday.id}
                className="flex justify-between items-center p-3 bg-surface-elevated rounded-lg"
              >
                <div>
                  <p className="font-medium text-text-primary">
                    {formatDate(holiday.holiday_date)}
                  </p>
                  {holiday.holiday_name && (
                    <p className="text-sm text-text-secondary">{holiday.holiday_name}</p>
                  )}
                </div>
                {onRemoveHoliday && (
                  <button
                    type="button"
                    onClick={() => onRemoveHoliday(holiday.id)}
                    className="text-sm font-medium text-state-error hover:text-state-error"
                  >
                    Remove
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-surface-card border border-border-primary rounded-lg p-4 lg:p-6">
        <h3 className="text-lg font-semibold text-text-primary mb-4">Closures</h3>

        <div className="space-y-3 mb-6">
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">Start Date</label>
            <DateFilter value={newClosureStart} onChange={onClosureStartChange} />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">End Date</label>
            <DateFilter value={newClosureEnd} onChange={onClosureEndChange} />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-text-secondary">
              Reason (Optional)
            </label>

            <input
              type="text"
              value={newClosureReason}
              onChange={(e) => onClosureReasonChange(e.target.value)}
              placeholder="e.g., Maintenance"
              className="
            h-11
            w-full
            rounded-xl
            border
            border-border-primary
            bg-surface-input
            px-4
            text-base
            text-text-primary
            placeholder:text-text-tertiary
            transition-all
            focus:outline-none
            focus:border-brand-primary
            focus:ring-2
            focus:ring-brand-primary/20
        "
            />
          </div>

          <button
            onClick={onAddClosure}
            disabled={!newClosureStart || !newClosureEnd}
            className="w-full h-11 bg-brand-primary text-text-inverse font-semibold rounded-lg hover:bg-brand-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            <CreateBusinessIcon className="w-5 h-5" aria-hidden="true" />
            Add Closure
          </button>
        </div>

        {closures.length > 0 && (
          <div className="space-y-2">
            {closures.map((closure) => (
              <div
                key={closure.id}
                className="flex justify-between items-center p-3 bg-surface-elevated rounded-lg"
              >
                <div>
                  <p className="font-medium text-text-primary">
                    {formatDate(closure.start_date)} - {formatDate(closure.end_date)}
                  </p>
                  {closure.reason && (
                    <p className="text-sm text-text-secondary">{closure.reason}</p>
                  )}
                </div>
                {onRemoveClosure && (
                  <button
                    type="button"
                    onClick={() => onRemoveClosure(closure.id)}
                    className="text-sm font-medium text-state-error hover:text-state-error"
                  >
                    Remove
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export const DowntimeManagement = memo(DowntimeManagementComponent);
export default DowntimeManagement;
