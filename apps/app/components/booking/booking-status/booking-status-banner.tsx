'use client';

import { memo } from 'react';
import { UI_BOOKING_STATE } from '@cusown/config';
import WarningIcon from '@cusown/shared/icons/warning.svg';
import CheckIcon from '@cusown/shared/icons/check.svg';
import ClockIcon from '@cusown/shared/icons/clock.svg';

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
      return 'bg-amber-500/10 border-amber-500/20 text-amber-400';
    }
    switch (status) {
      case 'confirmed':
        return 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400';
      case 'pending':
        return 'bg-amber-500/10 border-amber-500/20 text-amber-400';
      case 'rejected':
        return 'bg-state-error/10 border-state-error/20 text-state-error';
      default:
        return 'bg-surface-elevated border-border-primary text-text-primary';
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
