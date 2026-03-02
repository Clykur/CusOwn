'use client';

import CreateBusinessForm from '@/components/setup/create-business-form';
import { ROUTES } from '@/lib/utils/navigation';

export default function CreateBusinessPage() {
  return (
    <div className="min-h-screen bg-slate-50 py-12">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900">Create New Business</h1>
          <p className="mt-2 text-slate-600">
            Add another business to your account. Each business gets its own booking link.
          </p>
        </div>

        <CreateBusinessForm redirectAfterSuccess={ROUTES.OWNER_DASHBOARD_BASE} embedded={true} />
      </div>
    </div>
  );
}
