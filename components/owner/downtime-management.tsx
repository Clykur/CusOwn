'use client';

import { memo } from 'react';
import { formatDate } from '@/lib/utils/string';
import CreateBusinessIcon from '@/src/icons/create-business.svg';
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
}: DowntimeManagementProps) {
  return (
    <div className="space-y-6">
      <div className="bg-white border border-gray-200 rounded-lg p-4 lg:p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Holidays</h3>

        <div className="space-y-3 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Holiday Date</label>
            <DateFilter value={newHolidayDate} onChange={onHolidayDateChange} />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Holiday Name (Optional)
            </label>
            <input
              type="text"
              value={newHolidayName}
              onChange={(e) => onHolidayNameChange(e.target.value)}
              className="w-full h-11 px-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent text-base"
              placeholder="e.g., New Year"
            />
          </div>

          <button
            onClick={onAddHoliday}
            disabled={!newHolidayDate}
            className="w-full h-11 bg-black text-white font-semibold rounded-lg hover:bg-gray-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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
                className="flex justify-between items-center p-3 bg-gray-50 rounded-lg"
              >
                <div>
                  <p className="font-medium text-gray-900">{formatDate(holiday.holiday_date)}</p>
                  {holiday.holiday_name && (
                    <p className="text-sm text-gray-600">{holiday.holiday_name}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-4 lg:p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Closures</h3>

        <div className="space-y-3 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Start Date</label>
            <DateFilter value={newClosureStart} onChange={onClosureStartChange} />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">End Date</label>
            <DateFilter value={newClosureEnd} onChange={onClosureEndChange} />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Reason (Optional)
            </label>
            <input
              type="text"
              value={newClosureReason}
              onChange={(e) => onClosureReasonChange(e.target.value)}
              className="w-full h-11 px-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent text-base"
              placeholder="e.g., Maintenance"
            />
          </div>

          <button
            onClick={onAddClosure}
            disabled={!newClosureStart || !newClosureEnd}
            className="w-full h-11 bg-black text-white font-semibold rounded-lg hover:bg-gray-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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
                className="flex justify-between items-center p-3 bg-gray-50 rounded-lg"
              >
                <div>
                  <p className="font-medium text-gray-900">
                    {formatDate(closure.start_date)} - {formatDate(closure.end_date)}
                  </p>
                  {closure.reason && <p className="text-sm text-gray-600">{closure.reason}</p>}
                </div>
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
