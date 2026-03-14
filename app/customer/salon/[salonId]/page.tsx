'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { UI_CUSTOMER } from '@/config/constants';
import { BookingWithDetails } from '@/types';
import { setRebookData } from '@/components/booking/booking-utils';
import SalonDetailsHeader from '@/components/customer/SalonDetailsHeader';
import SalonShopPhotos from '@/components/customer/SalonShopPhotos';
import SalonBookingHistoryTable from '@/components/customer/SalonBookingHistoryTable';

interface SalonPayload {
  id: string;
  salon_name: string;
  owner_name?: string | null;
  whatsapp_number?: string | null;
  owner_image?: string | null;
  opening_time?: string | null;
  closing_time?: string | null;
}

export default function CustomerSalonDetailsPage() {
  const params = useParams<{ salonId: string }>();
  const salonId = params?.salonId ?? '';
  const router = useRouter();

  const [salon, setSalon] = useState<SalonPayload | null>(null);
  const [photos, setPhotos] = useState<string[]>([]);
  const [bookings, setBookings] = useState<BookingWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!salonId) {
      setLoading(false);
      return;
    }

    (async () => {
      try {
        setLoading(true);
        setError(null);

        const [salonRes, bookingsRes] = await Promise.all([
          fetch(`/api/salons/${encodeURIComponent(salonId)}`, { credentials: 'include' }),
          fetch('/api/customer/bookings', { credentials: 'include' }),
        ]);

        if (cancelled) return;

        if (!salonRes.ok) {
          const json = await salonRes.json().catch(() => ({}));
          setError(json.error || 'Salon not found');
          setLoading(false);
          return;
        }

        const salonJson = await salonRes.json();
        if (!salonJson.success || !salonJson.data) {
          setError('Salon not found');
          setLoading(false);
          return;
        }

        setSalon(salonJson.data as SalonPayload);

        if (!bookingsRes.ok) {
          setBookings([]);
        } else {
          const bookingsJson = await bookingsRes.json();
          const all: BookingWithDetails[] = bookingsJson.data || [];
          const forSalon = all
            .filter((b: BookingWithDetails) => b.business_id === salonId)
            .sort((a: BookingWithDetails, b: BookingWithDetails) =>
              a.created_at < b.created_at ? 1 : -1
            );
          setBookings(forSalon);
        }

        const mediaRes = await fetch(`/api/media/business/${encodeURIComponent(salonId)}`, {
          credentials: 'include',
        });
        if (cancelled) return;

        let photoUrls: string[] = [];
        if (mediaRes.ok) {
          const mediaJson = await mediaRes.json();
          const items = (mediaJson?.data?.items ?? []) as { id: string }[];
          if (items.length > 0) {
            const urls = await Promise.all(
              items.map(async (item: { id: string }) => {
                const signedRes = await fetch(
                  `/api/media/signed-url?mediaId=${encodeURIComponent(item.id)}`,
                  { credentials: 'include' }
                );
                const signedJson = await signedRes.json();
                return signedJson?.data?.url ?? null;
              })
            );
            photoUrls = urls.filter(Boolean);
          }
        }
        if (!cancelled) setPhotos(photoUrls);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Something went wrong');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [salonId]);

  const handleRebook = () => {
    const latest = bookings[0];
    if (latest?.customer_name || latest?.customer_phone) {
      setRebookData(latest.customer_name ?? '', latest.customer_phone ?? '');
    }
    router.push(`/customer/book/${encodeURIComponent(salonId)}`);
  };

  useEffect(() => {
    if (!salonId) return;

    router.prefetch(`/customer/book/${encodeURIComponent(salonId)}`);
  }, [router, salonId]);

  if (loading) {
    return (
      <div className="w-full pb-24 flex flex-col gap-6" aria-busy="true" aria-label="Loading salon">
        <div className="h-10 w-64 rounded-lg image-skeleton-shine" />
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
          <div className="h-6 w-28 mb-4 rounded image-skeleton-shine" />
          <div className="columns-1 md:columns-2 lg:columns-3 gap-4 space-y-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div
                key={i}
                className="aspect-[3/2] w-full rounded-xl image-skeleton-shine break-inside-avoid mb-4"
                aria-hidden
              />
            ))}
          </div>
        </div>
        <div className="py-10 text-center text-sm text-slate-500">Loading booking history…</div>
      </div>
    );
  }

  if (error || !salon) {
    return (
      <div className="w-full py-24 text-center">
        <p className="text-red-600 text-lg">{error ?? 'Salon not found'}</p>
        <Link
          href="/customer/dashboard"
          className="mt-4 inline-block text-slate-600 hover:text-slate-900 underline"
        >
          {UI_CUSTOMER.NAV_MY_ACTIVITY}
        </Link>
      </div>
    );
  }

  return (
    <div className="w-full pb-24 flex flex-col gap-6">
      <SalonDetailsHeader
        salonName={salon.salon_name}
        ownerName={salon.owner_name ?? null}
        ownerPhone={salon.whatsapp_number ?? null}
        ownerImage={salon.owner_image ?? null}
        openingTime={salon.opening_time ?? '09:00'}
        closingTime={salon.closing_time ?? '21:00'}
      />

      <SalonShopPhotos photos={photos} />

      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-slate-900">Booking History</h2>
          <button
            type="button"
            onClick={handleRebook}
            disabled={!salon}
            className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-6 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {UI_CUSTOMER.REBOOK}
          </button>
        </div>
        <SalonBookingHistoryTable bookings={bookings} />
      </div>
    </div>
  );
}
