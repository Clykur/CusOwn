'use client';

import { memo, type ReactNode } from 'react';
import type { Salon } from '@/types';
import { cn } from '@/lib/utils/cn';

interface BusinessDetailsCardProps {
  salon: Salon;
  onEdit: () => void;
  onDelete: () => void;
  deleteSaving: boolean;
}

function DetailField({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('min-w-0', className)}>
      <dt className="text-xs font-medium text-slate-500">{label}</dt>
      <dd className="mt-1 break-words text-sm font-semibold leading-snug text-slate-900 md:font-medium">
        {children}
      </dd>
    </div>
  );
}

function BusinessDetailsCardComponent({
  salon,
  onEdit,
  onDelete,
  deleteSaving,
}: BusinessDetailsCardProps) {
  return (
    <div
      className={cn(
        'rounded-2xl border border-slate-200/90 bg-white p-4',
        'shadow-[0_1px_3px_rgba(15,23,42,0.06)] ring-1 ring-slate-900/[0.04]',
        'md:rounded-lg md:p-5 md:shadow-none md:ring-0 lg:p-6'
      )}
    >
      <div className="mb-4 flex flex-row items-center justify-between gap-3 border-b border-slate-100 pb-3 md:mb-5 md:pb-4">
        <h2 className="text-sm font-semibold tracking-tight text-slate-900 md:text-lg">
          Business details
        </h2>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={onEdit}
            className="rounded-lg border border-slate-200/90 bg-white px-3 py-1.5 text-xs font-semibold text-slate-900 shadow-sm transition hover:border-slate-300 hover:bg-slate-50/50 active:bg-slate-50 md:px-4 md:py-2 md:text-sm"
          >
            Edit
          </button>
          <button
            type="button"
            onClick={onDelete}
            disabled={deleteSaving}
            className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-red-700 disabled:opacity-50 md:px-4 md:py-2 md:text-sm"
          >
            {deleteSaving ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-x-3 gap-y-4 md:gap-x-8 md:gap-y-5">
        <DetailField label="Business name">{salon.salon_name}</DetailField>
        <DetailField label="Owner name">{salon.owner_name}</DetailField>
        <DetailField label="WhatsApp">{salon.whatsapp_number}</DetailField>
        <DetailField label="Hours">
          {salon.opening_time?.substring(0, 5)} – {salon.closing_time?.substring(0, 5)}
        </DetailField>
        <DetailField label="Slot duration">{salon.slot_duration} min</DetailField>
        {salon.location ? <DetailField label="Location">{salon.location}</DetailField> : null}
        {salon.address ? (
          <DetailField label="Address" className="col-span-2">
            {salon.address}
          </DetailField>
        ) : null}
      </dl>
    </div>
  );
}

export const BusinessDetailsCard = memo(BusinessDetailsCardComponent);
export default BusinessDetailsCard;
