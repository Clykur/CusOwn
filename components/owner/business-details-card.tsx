'use client';

import { memo } from 'react';
import type { Salon } from '@/types';

interface BusinessDetailsCardProps {
  salon: Salon;
  onEdit: () => void;
  onDelete: () => void;
  deleteSaving: boolean;
}

function BusinessDetailsCardComponent({
  salon,
  onEdit,
  onDelete,
  deleteSaving,
}: BusinessDetailsCardProps) {
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-4 sm:p-5 lg:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
        <h2 className="text-lg font-semibold text-slate-900">Business details</h2>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onEdit}
            className="px-4 py-2 border border-slate-300 text-slate-700 font-medium rounded-lg hover:bg-slate-50 transition-colors"
          >
            Edit
          </button>
          <button
            type="button"
            onClick={onDelete}
            disabled={deleteSaving}
            className="px-4 py-2 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
          >
            {deleteSaving ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </div>
      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="text-slate-500">Business name</dt>
          <dd className="font-medium text-slate-900">{salon.salon_name}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Owner name</dt>
          <dd className="font-medium text-slate-900">{salon.owner_name}</dd>
        </div>
        <div>
          <dt className="text-slate-500">WhatsApp</dt>
          <dd className="font-medium text-slate-900">{salon.whatsapp_number}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Hours</dt>
          <dd className="font-medium text-slate-900">
            {salon.opening_time?.substring(0, 5)} – {salon.closing_time?.substring(0, 5)}
          </dd>
        </div>
        <div>
          <dt className="text-slate-500">Slot duration</dt>
          <dd className="font-medium text-slate-900">{salon.slot_duration} min</dd>
        </div>
        {salon.location && (
          <div>
            <dt className="text-slate-500">Location</dt>
            <dd className="font-medium text-slate-900">{salon.location}</dd>
          </div>
        )}
        {salon.address && (
          <div className="sm:col-span-2">
            <dt className="text-slate-500">Address</dt>
            <dd className="font-medium text-slate-900">{salon.address}</dd>
          </div>
        )}
      </dl>
    </div>
  );
}

export const BusinessDetailsCard = memo(BusinessDetailsCardComponent);
export default BusinessDetailsCard;
