import CheckIcon from '@/src/icons/check.svg';
import CloseIcon from '@/src/icons/close.svg';
import ClockIcon from '@/src/icons/clock.svg';
import WarningIcon from '@/src/icons/warning.svg';
import { createElement } from 'react';

export interface StatusConfig {
  bg: string;
  border: string;
  icon: React.ReactNode;
  badge: string;
  text: string;
}

export function getStatusConfig(status: string, isNoShow: boolean): StatusConfig {
  if (isNoShow) {
    return {
      bg: 'bg-amber-50',
      border: 'border-amber-200',
      icon: createElement(WarningIcon, { className: 'w-5 h-5 text-amber-600' }),
      badge: 'bg-amber-100 text-amber-800',
      text: 'text-amber-900',
    };
  }

  switch (status) {
    case 'confirmed':
      return {
        bg: 'bg-green-50',
        border: 'border-green-200',
        icon: createElement(CheckIcon, { className: 'w-5 h-5 text-green-600' }),
        badge: 'bg-green-100 text-green-800',
        text: 'text-green-900',
      };
    case 'pending':
      return {
        bg: 'bg-yellow-50',
        border: 'border-yellow-200',
        icon: createElement(ClockIcon, { className: 'w-5 h-5 text-yellow-600' }),
        badge: 'bg-yellow-100 text-yellow-800',
        text: 'text-yellow-900',
      };
    case 'rejected':
      return {
        bg: 'bg-red-50',
        border: 'border-red-200',
        icon: createElement(CloseIcon, { className: 'w-5 h-5 text-red-600' }),
        badge: 'bg-red-100 text-red-800',
        text: 'text-red-900',
      };
    case 'cancelled':
      return {
        bg: 'bg-gray-50',
        border: 'border-gray-200',
        icon: createElement(CloseIcon, { className: 'w-5 h-5 text-gray-600' }),
        badge: 'bg-gray-100 text-gray-800',
        text: 'text-gray-900',
      };
    default:
      return {
        bg: 'bg-gray-50',
        border: 'border-gray-200',
        icon: createElement(ClockIcon, { className: 'w-5 h-5 text-gray-600' }),
        badge: 'bg-gray-100 text-gray-800',
        text: 'text-gray-900',
      };
  }
}
