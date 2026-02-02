'use client';

import { useState } from 'react';
import { Slot } from '@/types';
import { formatDate, formatTime } from '@/lib/utils/string';

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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validatingSlot, setValidatingSlot] = useState(false);

  const handleReschedule = async () => {
    if (!selectedSlotId) {
      setError('Please select a new time slot');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/bookings/${bookingId}/reschedule`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          new_slot_id: selectedSlotId,
          reason: reason || undefined,
          rescheduled_by: rescheduledBy,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to reschedule');
      }

      setShowModal(false);
      if (onRescheduled) onRescheduled();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reschedule');
    } finally {
      setLoading(false);
    }
  };

  const filteredSlots = availableSlots.filter(
    (slot) => slot.id !== currentSlot.id && slot.status === 'available'
  );

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className="w-full h-11 bg-gray-200 text-gray-800 font-semibold rounded-lg hover:bg-gray-300 transition-colors flex items-center justify-center gap-2"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        <span>Reschedule</span>
      </button>

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

            {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowModal(false)}
                className="h-11 px-6 bg-gray-200 text-gray-800 font-semibold rounded-lg hover:bg-gray-300 transition-colors disabled:opacity-50"
                disabled={loading}
              >
                Cancel
              </button>
              <button
                onClick={handleReschedule}
                disabled={loading || !selectedSlotId || validatingSlot}
                className="h-11 px-6 bg-black text-white font-semibold rounded-lg hover:bg-gray-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {validatingSlot ? (
                  <>
                    <span className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></span>
                    Verifying...
                  </>
                ) : loading ? (
                  <>
                    <span className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></span>
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
