'use client';

import { memo } from 'react';
import { PHONE_DIGITS, UI_CUSTOMER } from '@/config/constants';
import type { Slot } from '@/types';

interface CustomerBookingFormProps {
  customerName: string;
  customerPhone: string;
  selectedSlot: Slot | null;
  submitting: boolean;
  validatingSlot: boolean;
  shopClosed?: boolean;
  shopClosedError?: string | null;
  error: string | null;
  slotValidationError: string | null;
  onNameChange: (value: string) => void;
  onPhoneChange: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
}

function CustomerBookingFormComponent({
  customerName,
  customerPhone,
  selectedSlot,
  submitting,
  validatingSlot,
  shopClosed = false,
  shopClosedError,
  error,
  slotValidationError,
  onNameChange,
  onPhoneChange,
  onSubmit,
}: CustomerBookingFormProps) {
  const displayError = shopClosedError || error || slotValidationError;

  return (
    <form onSubmit={onSubmit} className="space-y-4 sm:space-y-6">
      <div>
        <label htmlFor="customer_name" className="block text-sm font-medium text-slate-700 mb-2">
          {UI_CUSTOMER.LABEL_YOUR_NAME} <span className="text-slate-900">*</span>
        </label>
        <input
          type="text"
          id="customer_name"
          value={customerName}
          onChange={(e) => onNameChange(e.target.value)}
          required
          className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-slate-400 focus:border-slate-400 transition-shadow duration-150"
          placeholder={UI_CUSTOMER.PLACEHOLDER_NAME}
        />
      </div>
      <div>
        <label htmlFor="customer_phone" className="block text-sm font-medium text-slate-700 mb-2">
          {UI_CUSTOMER.LABEL_PHONE_NUMBER} <span className="text-slate-900">*</span>
        </label>
        <input
          type="tel"
          id="customer_phone"
          value={customerPhone}
          onChange={(e) => onPhoneChange(e.target.value.replace(/\D/g, '').slice(0, PHONE_DIGITS))}
          required
          maxLength={PHONE_DIGITS}
          pattern="[0-9]{10}"
          inputMode="numeric"
          autoComplete="tel"
          className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-slate-400 focus:border-slate-400 transition-shadow duration-150"
          placeholder={UI_CUSTOMER.PLACEHOLDER_PHONE}
        />
      </div>
      {displayError && (
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-xl">
          {displayError}
        </div>
      )}
      <button
        type="submit"
        disabled={submitting || !selectedSlot || validatingSlot || shopClosed}
        className="w-full bg-slate-900 text-white font-semibold py-3 px-6 rounded-xl hover:bg-slate-800 active:scale-[0.98] transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {submitting ? (
          <>
            <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
            {UI_CUSTOMER.SUBMIT_BOOKING_LOADING}
          </>
        ) : (
          UI_CUSTOMER.SUBMIT_BOOKING
        )}
      </button>
    </form>
  );
}

export const CustomerBookingForm = memo(CustomerBookingFormComponent);
export default CustomerBookingForm;
