'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import AddIcon from '@/src/icons/create-business.svg';

type ServiceInput = {
  name: string;
  duration_minutes: number | '';
  price_rupees: number | '';
};

export default function ServicesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const businessId = searchParams?.get('businessId');
  const bookingLink = searchParams?.get('bookingLink');
  const bookingUrl = searchParams?.get('bookingUrl');
  const qrCode = searchParams?.get('qrCode');

  const [services, setServices] = useState<ServiceInput[]>([
    { name: 'Haircut', duration_minutes: 30, price_rupees: 200 },
    { name: 'Beard Trim', duration_minutes: 15, price_rupees: 100 },
  ]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!businessId || !bookingLink || !bookingUrl) {
    return <div className="p-6 text-red-600">Missing required params</div>;
  }

  const addService = () => {
    setServices([...services, { name: '', duration_minutes: '', price_rupees: '' }]);
  };

  const updateService = (i: number, field: keyof ServiceInput, value: any) => {
    const updated = [...services];

    updated[i] = {
      ...updated[i],
      [field]:
        field === 'duration_minutes' || field === 'price_rupees'
          ? value === ''
            ? ''
            : Number(value)
          : value,
    };

    setServices(updated);
  };

  const removeService = (i: number) => {
    setServices(services.filter((_, index) => index !== i));
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError(null);

    try {
      if (!services.length) {
        throw new Error('Add at least one service');
      }

      if (services.some((s) => !s.name.trim())) {
        throw new Error('Service name is required');
      }

      if (services.some((s) => !s.duration_minutes || s.duration_minutes <= 0)) {
        throw new Error('Duration must be greater than 0');
      }

      if (services.some((s) => !s.price_rupees || s.price_rupees <= 0)) {
        throw new Error('Price must be greater than 0');
      }

      const payload = services.map((s) => ({
        name: s.name.trim(),
        duration_minutes: Number(s.duration_minutes),
        price_cents: Number(s.price_rupees) * 100,
      }));

      const response = await Promise.all(
        payload.map((service) =>
          fetch('/api/owner/services', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
              businessId,
              ...service,
            }),
          })
        )
      );
      const hasError = response.some((res) => !res.ok);

      if (hasError) {
        throw new Error('Failed to save some services');
      }

      router.push(
        `/onboarding/success?bookingLink=${bookingLink}&bookingUrl=${encodeURIComponent(
          bookingUrl
        )}&qrCode=${encodeURIComponent(qrCode || '')}`
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex">
      <div className="flex-1">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="bg-white rounded-2xl shadow-xl p-6 md:p-8">
            {/* Header */}
            <div className="flex justify-center items-center py-6">
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Set Up Your Services</h1>
            </div>
            <div className="bg-blue-50 border-l-4 border-blue-500 rounded-lg p-3 md:p-4 mb-4">
              <p className="text-xs md:text-sm text-blue-800">
                <strong className="font-semibold">Tip:</strong> Start with your most popular
                services. You can always add or edit services later.
              </p>
            </div>

            {/* Services */}
            <div className="space-y-4">
              {services.map((s, i) => (
                <div key={i} className="bg-gray-50 rounded-xl p-4 md:p-5 border border-gray-200">
                  {/* Name */}
                  <label className="block text-sm font-semibold text-gray-900 mb-2">
                    Service Name
                  </label>
                  <input
                    value={s.name}
                    onChange={(e) => updateService(i, 'name', e.target.value)}
                    className="w-full px-4 py-3 text-sm border-2 border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-black focus:border-black"
                    placeholder="e.g. Haircut"
                  />

                  {/* Duration + Price */}
                  <div className="grid grid-cols-2 gap-3 mt-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Duration (mins)
                      </label>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={s.duration_minutes}
                        onChange={(e) => {
                          const val = e.target.value.replace(/\D/g, '');
                          updateService(i, 'duration_minutes', val);
                        }}
                        className="w-full px-3 py-2 text-sm border-2 border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-black focus:border-black"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Price (₹)
                      </label>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={s.price_rupees}
                        onChange={(e) => {
                          const val = e.target.value.replace(/\D/g, '');
                          updateService(i, 'price_rupees', val);
                        }}
                        className="w-full px-3 py-2 text-sm border-2 border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-black focus:border-black"
                      />
                    </div>
                  </div>

                  {/* Remove */}
                  <button
                    onClick={() => removeService(i)}
                    className="mt-3 text-sm text-gray-600 font-medium hover:text-red-500"
                  >
                    - Remove
                  </button>
                </div>
              ))}
            </div>

            {/* Add */}
            <button
              onClick={addService}
              className="mt-4 flex items-center gap-2 
  text-sm font-semibold text-gray-600 
  hover:text-green-800 transition 
  whitespace-nowrap"
            >
              <AddIcon className="w-4 h-4 md:w-5 md:h-5" />
              <span>Add Another Service</span>
            </button>

            {/* Error */}
            {error && (
              <div className="mt-4 bg-red-50 border-l-4 border-red-500 rounded-lg p-3">
                <p className="text-red-800 text-sm">{error}</p>
              </div>
            )}

            {/* Submit */}
            <div className="mt-6">
              <button
                onClick={handleSubmit}
                disabled={loading}
                className="w-full bg-black text-white font-semibold py-3 md:py-4 px-6 rounded-xl hover:bg-gray-900 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <span className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full" />
                    Saving...
                  </>
                ) : (
                  'Continue'
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
