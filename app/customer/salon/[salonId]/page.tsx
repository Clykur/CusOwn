'use client';

import { useEffect, useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { CUSTOMER_SCREEN_TITLE_CLASSNAME, UI_CUSTOMER } from '@/config/constants';
import { BookingWithDetails } from '@/types';
import { setRebookData } from '@/components/booking/booking-utils';
import SalonDetailsHeader from '@/components/customer/SalonDetailsHeader';
import SalonShopPhotos from '@/components/customer/SalonShopPhotos';
import SalonBookingHistoryTable from '@/components/customer/SalonBookingHistoryTable';
import Breadcrumb from '@/components/ui/breadcrumb';

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

  const breadcrumbItems = useMemo(
    () => [
      { label: UI_CUSTOMER.NAV_MY_ACTIVITY, href: '/customer/dashboard' },
      {
        label: salon?.salon_name || UI_CUSTOMER.SALON_DETAILS_BREADCRUMB_FALLBACK,
        href: `/customer/salon/${salonId}`,
      },
    ],
    [salon?.salon_name, salonId]
  );

  if (loading) {
    return (
      <div
        className="flex w-full flex-col gap-6 pb-[calc(4.5rem+env(safe-area-inset-bottom,0px))] md:pb-8"
        aria-busy="true"
        aria-label="Loading salon"
      >
        <Breadcrumb
          items={[
            { label: UI_CUSTOMER.NAV_MY_ACTIVITY, href: '/customer/dashboard' },
            { label: '…', href: `/customer/salon/${salonId}` },
          ]}
        />
        <div className="h-10 w-64 rounded-lg image-skeleton-shine" />
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 h-6 w-32 rounded image-skeleton-shine" />
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div
                key={i}
                className="aspect-[3/2] w-full rounded-lg image-skeleton-shine sm:rounded-xl"
                aria-hidden
              />
            ))}
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 h-5 w-40 rounded image-skeleton-shine" />
          <div className="h-32 rounded-xl image-skeleton-shine" />
        </div>
      </div>
    );
  }

  if (error || !salon) {
    return (
      <div className="w-full pb-[calc(4.5rem+env(safe-area-inset-bottom,0px))] md:pb-8">
        <Breadcrumb
          items={[
            { label: 'My Activity', href: '/customer/dashboard' },
            { label: 'Salon Details', href: `/customer/salon/${salonId}` },
          ]}
        />
        <div className="py-16 flex flex-col items-center justify-center gap-4">
          <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center">
            <svg
              className="w-8 h-8 text-slate-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
              />
            </svg>
          </div>
          <h2 className={CUSTOMER_SCREEN_TITLE_CLASSNAME}>Salon No Longer Available</h2>
          <p className="text-slate-500 text-center max-w-sm">
            This salon has been removed from our platform. Your booking history with this salon is
            still saved in your activity.
          </p>
          <Link
            href="/customer/dashboard"
            className="mt-2 inline-flex items-center justify-center rounded-xl bg-slate-900 px-6 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 transition-colors"
          >
            Back to My Activity
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col gap-6 pb-[calc(4.5rem+env(safe-area-inset-bottom,0px))] md:pb-8">
      <Breadcrumb items={breadcrumbItems} />

      <SalonDetailsHeader
        salonName={salon.salon_name}
        ownerName={salon.owner_name ?? null}
        ownerPhone={salon.whatsapp_number ?? null}
        ownerImage={salon.owner_image ?? null}
        openingTime={salon.opening_time ?? '09:00'}
        closingTime={salon.closing_time ?? '21:00'}
      />

      <SalonShopPhotos photos={photos} />

      <section className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm ring-1 ring-slate-900/[0.04] sm:p-6">
        <div className="mb-4 flex flex-col gap-3 sm:mb-6 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <h2 className="text-lg font-semibold tracking-tight text-slate-900">
            {UI_CUSTOMER.SALON_DETAILS_BOOKING_HISTORY}
          </h2>
          <button
            type="button"
            onClick={handleRebook}
            disabled={!salon}
            className="inline-flex min-h-[44px] w-full touch-manipulation items-center justify-center rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-slate-800 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto sm:min-w-[8.5rem]"
          >
            {UI_CUSTOMER.REBOOK}
          </button>
        </div>
        <SalonBookingHistoryTable bookings={bookings} />
      </section>
    </div>
  );
}
