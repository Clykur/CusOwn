'use client';

import { memo } from 'react';
import ProfileIcon from '@cusown/shared/icons/profile.svg';

interface CustomerDetailsCardProps {
  customerName: string;
  customerPhone: string;
}

function CustomerDetailsCardComponent({ customerName, customerPhone }: CustomerDetailsCardProps) {
  return (
    <div className="bg-surface-elevated rounded-xl p-6 border border-border-primary mb-8">
      <h2 className="text-lg font-semibold text-text-primary mb-4 flex items-center gap-2">
        <ProfileIcon className="w-5 h-5 text-text-secondary" aria-hidden="true" />
        Your Details
      </h2>
      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <p className="text-xs text-text-secondary uppercase tracking-wide mb-1">Name</p>
          <p className="font-semibold text-text-primary">{customerName}</p>
        </div>
        <div>
          <p className="text-xs text-text-secondary uppercase tracking-wide mb-1">Phone</p>
          <p className="font-semibold text-text-primary">{customerPhone}</p>
        </div>
      </div>
    </div>
  );
}

export const CustomerDetailsCard = memo(CustomerDetailsCardComponent);
