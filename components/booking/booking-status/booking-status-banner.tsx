'use client';

import { memo } from 'react';
import { UI_BOOKING_STATE } from '@/config/constants';
import WarningIcon from '@/src/icons/warning.svg';
import CheckIcon from '@/src/icons/check.svg';
import ClockIcon from '@/src/icons/clock.svg';

interface BookingStatusBannerProps {
  status: string;
  isNoShow: boolean;
  cancelledBy?: string;
}

function BookingStatusBannerComponent({ status, isNoShow, cancelledBy }: BookingStatusBannerProps) {
  const getStatusMessage = () => {
    if (status === 'confirmed' && isNoShow) return UI_BOOKING_STATE.NO_SHOW;
    switch (status) {
      case 'confirmed':
        return UI_BOOKING_STATE.CONFIRMED;
      case 'pending':
        return UI_BOOKING_STATE.PENDING;
      case 'rejected':
        return UI_BOOKING_STATE.REJECTED;
      case 'cancelled':
        return cancelledBy === 'system' ? UI_BOOKING_STATE.EXPIRED : UI_BOOKING_STATE.CANCELLED;
      default:
        return status;
    }
  };

  const getStatusStyles = () => {
    if (isNoShow) {
      return 'bg-amber-50 border-amber-200 text-amber-800';
    }
    switch (status) {
      case 'confirmed':
        return 'bg-green-50 border-green-200 text-green-800';
      case 'pending':
        return 'bg-amber-50 border-amber-200 text-amber-800';
      case 'rejected':
        return 'bg-red-50 border-red-200 text-red-800';
      default:
        return 'bg-slate-50 border-slate-200 text-slate-800';
    }
  };

  const renderIcon = () => {
    if (isNoShow) {
      return <WarningIcon className="w-6 h-6 shrink-0" aria-hidden="true" />;
    }
    if (status === 'confirmed') {
      return <CheckIcon className="w-6 h-6" aria-hidden="true" />;
    }
    if (status === 'pending') {
      return <ClockIcon className="w-6 h-6" aria-hidden="true" />;
    }
    return null;
  };

  return (
    <div className={`px-6 py-4 rounded-xl mb-8 border-2 ${getStatusStyles()}`}>
      <div className="flex items-center gap-3">
        {renderIcon()}
        <p className="font-bold text-lg">{getStatusMessage()}</p>
      </div>
    </div>
  );
}

export const BookingStatusBanner = memo(BookingStatusBannerComponent);
