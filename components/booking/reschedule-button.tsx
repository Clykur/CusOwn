'use client';

import { useState, useCallback, useMemo } from 'react';
import { Slot } from '@/types';
import { formatDate, formatTime } from '@/lib/utils/string';
import { Toast } from '@/components/ui/toast';
import { useOptimisticMutation } from '@/lib/hooks/use-optimistic-action';
import BookingsIcon from '@/src/icons/bookings.svg';

interface RescheduleButtonProps {
  bookingId: string;
  currentSlot: Slot;
  businessId: string;
  availableSlots: Slot[];
  onRescheduled?: () => void;
  rescheduledBy: 'customer' | 'owner';
}

export default function RescheduleButton({
  bookingId,
  currentSlot,
  businessId,
  availableSlots,
  onRescheduled,
  rescheduledBy,
}: RescheduleButtonProps) {
  const [showModal, setShowModal] = useState(false);
  const [selectedSlotId, setSelectedSlotId] = useState<string>('');
  const [reason, setReason] = useState('');
  const [validatingSlot, setValidatingSlot] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [optimisticSlot, setOptimisticSlot] = useState<Slot | null>(null);

  const rescheduleMutation = useOptimisticMutation({
    mutationFn: async (slotId: string) => {
      const { supabaseAuth } = await import('@/lib/supabase/auth');
      const { getCSRFToken } = await import('@/lib/utils/csrf-client');

      const {
        data: { session },
      } = await supabaseAuth.auth.getSession();

      const csrfToken = await getCSRFToken();

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }

      if (csrfToken) {
        headers['x-csrf-token'] = csrfToken;
      }

      const response = await fetch(`/api/bookings/${bookingId}/reschedule`, {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({
          new_slot_id: slotId,
          reason: reason || undefined,
          rescheduled_by: rescheduledBy,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to reschedule');
      }

      return result;
    },
    onMutate: (slotId: string) => {
      const slot = availableSlots.find((s) => s.id === slotId);
      if (slot) {
        setOptimisticSlot(slot);
        setShowModal(false);
      }
    },
    onSuccess: () => {
      const slot = optimisticSlot;
      if (slot) {
        setToastMessage(
          `Rescheduled to ${formatDate(slot.date)} at ${formatTime(slot.start_time)}`
        );
      }
      if (onRescheduled) onRescheduled();
      setOptimisticSlot(null);
    },
    onError: () => {
      setOptimisticSlot(null);
      setShowModal(true);
    },
  });

  const handleReschedule = useCallback(async () => {
    if (!selectedSlotId) {
      return;
    }

    try {
      await rescheduleMutation.mutate(selectedSlotId);
    } catch {
      // Error handled in onError
    }
  }, [selectedSlotId, rescheduleMutation]);

  const filteredSlots = useMemo(
    () =>
      availableSlots.filter((slot) => slot.id !== currentSlot.id && slot.status === 'available'),
    [availableSlots, currentSlot.id]
  );

  const isLoading = rescheduleMutation.isPending;

  return (
    <>
      {toastMessage && (
        <Toast message={toastMessage} variant="success" onDismiss={() => setToastMessage(null)} />
      )}

      {optimisticSlot && isLoading ? (
        <div className="w-full h-11 bg-slate-100 text-slate-600 font-semibold rounded-lg flex items-center justify-center gap-2">
          <div className="animate-spin rounded-full h-4 w-4 border-2 border-slate-600 border-t-transparent" />
          <span>Rescheduling to {formatTime(optimisticSlot.start_time)}...</span>
        </div>
      ) : (
        <button
          onClick={() => setShowModal(true)}
          disabled={isLoading}
          className="w-full h-11 bg-gray-200 text-gray-800 font-semibold rounded-lg hover:bg-gray-300 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
        >
          <BookingsIcon className="w-5 h-5" aria-hidden="true" />
          <span>Reschedule</span>
        </button>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold mb-4">Reschedule Booking</h3>
            <p className="text-sm text-gray-600 mb-4">
              Current: {formatDate(currentSlot.date)} at {formatTime(currentSlot.start_time)}
            </p>

            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">Select New Time</label>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {filteredSlots.length === 0 ? (
                  <p className="text-sm text-gray-500">No available slots</p>
                ) : (
                  filteredSlots.map((slot) => (
                    <label
                      key={slot.id}
                      className="flex items-center p-2 border rounded hover:bg-gray-50 cursor-pointer"
                    >
                      <input
                        type="radio"
                        name="slot"
                        value={slot.id}
                        checked={selectedSlotId === slot.id}
                        onChange={(e) => setSelectedSlotId(e.target.value)}
                        className="mr-2"
                      />
                      <span className="text-sm">
                        {formatDate(slot.date)} - {formatTime(slot.start_time)} to{' '}
                        {formatTime(slot.end_time)}
                      </span>
                    </label>
                  ))
                )}
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">Reason (Optional)</label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full border rounded px-3 py-2 text-sm"
                rows={3}
                placeholder="Why are you rescheduling?"
              />
            </div>

            {rescheduleMutation.isError && (
              <p className="text-sm text-red-600 mb-4">{rescheduleMutation.error?.message}</p>
            )}

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowModal(false)}
                className="h-11 px-6 bg-gray-200 text-gray-800 font-semibold rounded-lg hover:bg-gray-300 transition-colors disabled:opacity-50"
                disabled={isLoading}
              >
                Cancel
              </button>
              <button
                onClick={handleReschedule}
                disabled={isLoading || !selectedSlotId || validatingSlot}
                className="h-11 px-6 bg-black text-white font-semibold rounded-lg hover:bg-gray-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {validatingSlot ? (
                  <>
                    <span className="animate-spin rounded-full h-3 w-3 border-b-2 border-white" />
                    Verifying...
                  </>
                ) : isLoading ? (
                  <>
                    <span className="animate-spin rounded-full h-3 w-3 border-b-2 border-white" />
                    Rescheduling...
                  </>
                ) : (
                  'Confirm Reschedule'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
