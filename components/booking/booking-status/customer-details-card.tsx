'use client';

import { memo } from 'react';
import ProfileIcon from '@/src/icons/profile.svg';

interface CustomerDetailsCardProps {
  customerName: string;
  customerPhone: string;
}

function CustomerDetailsCardComponent({ customerName, customerPhone }: CustomerDetailsCardProps) {
  return (
    <div className="bg-slate-50 rounded-xl p-6 border border-slate-200 mb-8">
      <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
        <ProfileIcon className="w-5 h-5 text-slate-600" aria-hidden="true" />
        Your Details
      </h2>
      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Name</p>
          <p className="font-semibold text-slate-900">{customerName}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Phone</p>
          <p className="font-semibold text-slate-900">{customerPhone}</p>
        </div>
      </div>
    </div>
  );
}

export const CustomerDetailsCard = memo(CustomerDetailsCardComponent);
