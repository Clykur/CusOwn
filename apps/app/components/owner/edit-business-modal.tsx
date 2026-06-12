'use client';

import { memo } from 'react';
import {
  SLOT_DURATIONS,
  VALIDATION,
  DEFAULT_CONCURRENT_BOOKING_CAPACITY,
  MAX_CONCURRENT_BOOKING_CAPACITY,
} from '@cusown/config';
import Dropdown from '@/components/ui/dropdown';

export interface EditBusinessFormData {
  salon_name: string;
  owner_name: string;
  whatsapp_number: string;
  opening_time: string;
  closing_time: string;
  slot_duration: number;
  concurrent_booking_capacity: number;
  address: string;
  location: string;
  city: string;
  area: string;
  pincode: string;
  latitude: string;
  longitude: string;
  address_line1: string;
  address_line2: string;
  state: string;
  country: string;
  postal_code: string;
}

interface EditBusinessModalProps {
  isOpen: boolean;
  editForm: EditBusinessFormData;
  editError: string | null;
  editSaving: boolean;
  onFormChange: (updater: (prev: EditBusinessFormData) => EditBusinessFormData) => void;
  onSave: () => void;
  onClose: () => void;
}
const inputStyles =
  'w-full px-3 py-2.5 bg-surface-input text-text-primary placeholder:text-text-tertiary border border-border-primary rounded-lg transition-all focus:outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20';
function EditBusinessModalComponent({
  isOpen,
  editForm,
  editError,
  editSaving,
  onFormChange,
  onSave,
  onClose,
}: EditBusinessModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-surface-modal border border-border-primary rounded-2xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6">
        <div className="sticky top-0 z-10 border-b border-border-primary bg-surface-modal px-6 py-4">
          <h3 className="text-lg font-semibold text-text-primary">Edit Business</h3>
        </div>
        {editError && (
          <div className="mb-4 rounded-lg border border-state-error/20 bg-state-error/10 p-3 text-sm text-state-error">
            {editError}
          </div>
        )}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">
              Business name *
            </label>
            <input
              type="text"
              value={editForm.salon_name}
              onChange={(e) => onFormChange((f) => ({ ...f, salon_name: e.target.value }))}
              className={inputStyles}
              maxLength={VALIDATION.SALON_NAME_MAX_LENGTH}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">
              Owner name *
            </label>
            <input
              type="text"
              value={editForm.owner_name}
              onChange={(e) => onFormChange((f) => ({ ...f, owner_name: e.target.value }))}
              className={inputStyles}
              maxLength={VALIDATION.OWNER_NAME_MAX_LENGTH}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">
              WhatsApp number * (10 digits)
            </label>
            <input
              type="tel"
              value={editForm.whatsapp_number}
              onChange={(e) => {
                const digits = e.target.value
                  .replace(/\D/g, '')
                  .slice(0, VALIDATION.WHATSAPP_NUMBER_MAX_LENGTH);
                onFormChange((f) => ({ ...f, whatsapp_number: digits }));
              }}
              className={inputStyles}
              placeholder="10 digits"
              inputMode="numeric"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">
                Opening time
              </label>
              <input
                type="time"
                value={editForm.opening_time}
                onChange={(e) => onFormChange((f) => ({ ...f, opening_time: e.target.value }))}
                className={inputStyles}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">
                Closing time
              </label>
              <input
                type="time"
                value={editForm.closing_time}
                onChange={(e) => onFormChange((f) => ({ ...f, closing_time: e.target.value }))}
                className={inputStyles}
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">
              Slot duration (min)
            </label>
            <Dropdown
              value={editForm.slot_duration}
              onChange={(val) =>
                onFormChange((f) => ({
                  ...f,
                  slot_duration: Number(val),
                }))
              }
              options={SLOT_DURATIONS.map((d) => ({ value: d, label: String(d) }))}
              triggerClassName="h-10 border border-border-primary bg-surface-input text-text-primary px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">
              Concurrent bookings (max {MAX_CONCURRENT_BOOKING_CAPACITY})
            </label>
            <input
              type="number"
              min={1}
              max={MAX_CONCURRENT_BOOKING_CAPACITY}
              value={editForm.concurrent_booking_capacity ?? DEFAULT_CONCURRENT_BOOKING_CAPACITY}
              onChange={(e) =>
                onFormChange((f) => ({
                  ...f,
                  concurrent_booking_capacity: Math.min(
                    MAX_CONCURRENT_BOOKING_CAPACITY,
                    Math.max(1, parseInt(e.target.value, 10) || DEFAULT_CONCURRENT_BOOKING_CAPACITY)
                  ),
                }))
              }
              className={inputStyles}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">
              Location / City
            </label>
            <input
              type="text"
              value={editForm.location}
              onChange={(e) => onFormChange((f) => ({ ...f, location: e.target.value }))}
              className={inputStyles}
              maxLength={200}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">City</label>
              <input
                type="text"
                value={editForm.city}
                onChange={(e) => onFormChange((f) => ({ ...f, city: e.target.value }))}
                className={inputStyles}
                maxLength={100}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">Area</label>
              <input
                type="text"
                value={editForm.area}
                onChange={(e) => onFormChange((f) => ({ ...f, area: e.target.value }))}
                className={inputStyles}
                maxLength={100}
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">Pincode</label>
            <input
              type="text"
              value={editForm.pincode}
              onChange={(e) => onFormChange((f) => ({ ...f, pincode: e.target.value }))}
              className={inputStyles}
              maxLength={10}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">Latitude</label>
              <input
                type="text"
                inputMode="decimal"
                value={editForm.latitude}
                onChange={(e) => onFormChange((f) => ({ ...f, latitude: e.target.value }))}
                className={inputStyles}
                placeholder="-90 to 90"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">
                Longitude
              </label>
              <input
                type="text"
                inputMode="decimal"
                value={editForm.longitude}
                onChange={(e) => onFormChange((f) => ({ ...f, longitude: e.target.value }))}
                className={inputStyles}
                placeholder="-180 to 180"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">
              Address line 1
            </label>
            <input
              type="text"
              value={editForm.address_line1}
              onChange={(e) => onFormChange((f) => ({ ...f, address_line1: e.target.value }))}
              className={inputStyles}
              maxLength={300}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">
              Address line 2
            </label>
            <input
              type="text"
              value={editForm.address_line2}
              onChange={(e) => onFormChange((f) => ({ ...f, address_line2: e.target.value }))}
              className={inputStyles}
              maxLength={300}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">State</label>
              <input
                type="text"
                value={editForm.state}
                onChange={(e) => onFormChange((f) => ({ ...f, state: e.target.value }))}
                className={inputStyles}
                maxLength={100}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">Country</label>
              <input
                type="text"
                value={editForm.country}
                onChange={(e) => onFormChange((f) => ({ ...f, country: e.target.value }))}
                className={inputStyles}
                maxLength={100}
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">
              Postal code
            </label>
            <input
              type="text"
              value={editForm.postal_code}
              onChange={(e) => onFormChange((f) => ({ ...f, postal_code: e.target.value }))}
              className={inputStyles}
              maxLength={20}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">Address</label>
            <textarea
              value={editForm.address}
              onChange={(e) => onFormChange((f) => ({ ...f, address: e.target.value }))}
              rows={2}
              className={inputStyles}
              maxLength={VALIDATION.ADDRESS_MAX_LENGTH}
            />
          </div>
        </div>
        <div className="flex gap-3 mt-6">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-border-primary text-text-secondary font-medium rounded-lg hover:bg-surface-elevated"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={
              editSaving ||
              !editForm.salon_name.trim() ||
              !editForm.owner_name.trim() ||
              editForm.whatsapp_number.length !== VALIDATION.WHATSAPP_NUMBER_MIN_LENGTH
            }
            className="flex-1 px-4 py-2 bg-brand-primary text-text-inverse font-medium rounded-lg hover:bg-brand-primaryHover disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {editSaving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

export const EditBusinessModal = memo(EditBusinessModalComponent);
export default EditBusinessModal;
