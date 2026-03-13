'use client';

import { memo } from 'react';
import { UI_CUSTOMER, UI_CONTEXT } from '@/config/constants';
import BusinessesIcon from '@/src/icons/businesses.svg';

interface BusinessDetailsCardProps {
  salon: {
    salon_name: string;
    location?: string;
    address?: string;
    rating_avg?: number;
    review_count?: number;
  };
}

function BusinessDetailsCardComponent({ salon }: BusinessDetailsCardProps) {
  return (
    <div className="bg-slate-50 rounded-xl p-6 border border-slate-200">
      <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
        <BusinessesIcon className="w-5 h-5 text-slate-600" aria-hidden="true" />
        Business Details
      </h2>
      <div className="space-y-3">
        <div>
          <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Business Name</p>
          <p className="font-semibold text-slate-900">{salon.salon_name}</p>
        </div>
        {salon.location && (
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Location</p>
            <p className="text-slate-700">{salon.location}</p>
          </div>
        )}
        {salon.address && (
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Address</p>
            <p className="text-sm text-slate-600">{salon.address}</p>
          </div>
        )}
        {((salon.review_count ?? 0) > 0 || salon.rating_avg != null) && (
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">
              {UI_CUSTOMER.LABEL_BUSINESS_RATING}
            </p>
            <p className="font-semibold text-slate-900">
              {UI_CONTEXT.BUSINESS_RATING_REVIEWS(
                (salon.rating_avg ?? 0).toFixed(1),
                salon.review_count ?? 0
              )}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export const BusinessDetailsCard = memo(BusinessDetailsCardComponent);
