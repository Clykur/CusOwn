'use client';

import { memo, type ReactNode } from 'react';
import type { Salon } from '@cusown/shared';
import { cn } from '@cusown/shared';
import ActionButton from '@/components/ui/action-button';

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
      <dt className="text-xs font-medium text-text-secondary">{label}</dt>
      <dd className="mt-1 break-words text-sm font-semibold leading-snug text-text-primary md:font-medium">
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
        'rounded-2xl border border-border-primary bg-surface-card p-4',
        'shadow-sm ring-1 ring-white/5',
        'md:rounded-lg md:p-5 md:shadow-none md:ring-0 lg:p-6'
      )}
    >
      <div className="mb-4 flex flex-row items-center justify-between gap-3 border-b border-border-primary pb-3 md:mb-5 md:pb-4">
        <h2 className="text-sm font-semibold tracking-tight text-text-primary md:text-lg">
          Business details
        </h2>
        <div className="flex shrink-0 items-center gap-2">
          <ActionButton
            action="delete"
            onClick={onDelete}
            loading={deleteSaving}
            tooltip="Delete Business"
          />
          <ActionButton action="edit" onClick={onEdit} tooltip="Edit Business" />
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
