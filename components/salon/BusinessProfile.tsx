'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Image from 'next/image';
import { UI_CUSTOMER } from '@/config/constants';
import {
  getCachedBusinessProfile,
  setCachedBusinessProfile,
} from '@/lib/cache/business-profile-cache';
import StarRating from '../booking/star-rating';
import SalonDetailsHeader from '@/components/customer/SalonDetailsHeader';
import SalonShopPhotos from '@/components/customer/SalonShopPhotos';

const IMAGE_QUALITY_PREMIUM = 95;
const GALLERY_IMAGE_WIDTH = 1200;
const GALLERY_IMAGE_HEIGHT = 800;

function PremiumGalleryImage({
  src,
  alt,
  className,
}: {
  src: string;
  alt: string;
  className?: string;
}) {
  const [loaded, setLoaded] = useState(false);
  return (
    <div className="relative aspect-[3/2] w-full overflow-hidden rounded-xl bg-slate-100">
      <div
        className={`absolute inset-0 image-skeleton-shine transition-opacity duration-300 ${
          loaded ? 'opacity-0 pointer-events-none' : 'opacity-100'
        }`}
        aria-hidden
      />
      <Image
        src={src}
        alt={alt}
        width={GALLERY_IMAGE_WIDTH}
        height={GALLERY_IMAGE_HEIGHT}
        quality={IMAGE_QUALITY_PREMIUM}
        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
        loading="lazy"
        className={`${className ?? ''} transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-0'}`}
        onLoad={() => setLoaded(true)}
      />
    </div>
  );
}

const getTimeParts = (time: string) => {
  const [h, m] = time.split(':').map(Number);
  return { h, m };
};
const getTimeDiffString = (from: Date, to: Date) => {
  const diff = Math.max(0, to.getTime() - from.getTime());
  const mins = Math.floor(diff / 60000);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
};

interface Salon {
  id: string;
  salon_name: string;
  opening_time: string;
  closing_time: string;
  owner_name: string;
  owner_image?: string;
  whatsapp_number?: string;
  rating_avg?: number;
  review_count?: number;
  rating_counts?: Record<number, number>;
}
interface Service {
  id: string;
  name: string;
  duration: string;
  price: string;
}

interface ReviewData {
  rating_avg: number;
  review_count: number;
  rating_counts: Record<number, number>;
}

const FETCH_CACHE: RequestCache = 'default';

export const BusinessProfile = () => {
  const params = useParams();
  const slug = typeof params?.slug === 'string' ? params.slug : '';

  const [salon, setSalon] = useState<Salon | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [photos, setPhotos] = useState<string[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [statusText, setStatusText] = useState('');
  const [subText, setSubText] = useState('');
  const [loading, setLoading] = useState(true);
  const [reviewData, setReviewData] = useState<ReviewData | null>(null);

  useEffect(() => {
    if (!slug) return;

    const cached = getCachedBusinessProfile(slug) as {
      salon: Salon;
      services: Service[];
      photos: string[];
    } | null;
    if (cached?.salon) {
      setSalon(cached.salon);
      setServices(cached.services ?? []);
      setPhotos(cached.photos ?? []);
      setLoading(false);
    } else {
      setLoading(true);
    }

    let cancelled = false;

    fetch(`/api/salons/${slug}`, { cache: FETCH_CACHE })
      .then((res) => res.json())
      .then(async (result: { success?: boolean; data?: Salon }) => {
        if (cancelled) return;
        if (!result.success || !result.data) {
          setSalon(null);
          setLoading(false);
          return;
        }
        const salonData = result.data;
        setSalon(salonData);

        const userId = (salonData as Salon & { owner_id?: string }).owner_id;
        const queryParam = userId ? `userId=${userId}` : `businessId=${salonData.id}`;

        const [servicesRes, mediaRes] = await Promise.all([
          fetch(`/api/services/list?${queryParam}`, {
            cache: FETCH_CACHE,
          }).then((r) => r.json()),
          fetch(`/api/media/business/${salonData.id}`, {
            cache: FETCH_CACHE,
          }).then((r) => r.json()),
        ]);

        if (cancelled) return;

        const servicesList =
          servicesRes?.success && Array.isArray(servicesRes.data)
            ? (
                servicesRes.data as {
                  id: string;
                  name: string;
                  duration_minutes: number;
                  price_cents: number;
                }[]
              ).map((s) => ({
                id: s.id,
                name: s.name,
                duration: `${s.duration_minutes} min`,
                price: (s.price_cents / 100).toFixed(0),
              }))
            : [];
        setServices(servicesList);

        let photoUrls: string[] = [];
        if (mediaRes?.success && mediaRes.data?.items?.length) {
          const urls = await Promise.all(
            (mediaRes.data.items as { id: string }[]).map(async (item) => {
              const signedRes = await fetch(
                `/api/media/signed-url?mediaId=${encodeURIComponent(item.id)}`,
                { cache: FETCH_CACHE }
              );
              const signedResult = await signedRes.json();
              return signedResult?.data?.url ?? null;
            })
          );
          photoUrls = urls.filter(Boolean);
        }
        if (cancelled) return;
        setPhotos(photoUrls);
        setLoading(false);
        setCachedBusinessProfile(slug, {
          salon: salonData,
          services: servicesList,
          photos: photoUrls,
        });
      })
      .catch(() => {
        if (!cancelled) {
          setSalon(null);
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [slug]);

  useEffect(() => {
    if (!salon) return;
    const checkStatus = () => {
      const now = new Date();
      const { h: openH, m: openM } = getTimeParts(salon.opening_time);
      const { h: closeH, m: closeM } = getTimeParts(salon.closing_time);
      const open = new Date(now);
      open.setHours(openH, openM, 0, 0);
      const close = new Date(now);
      close.setHours(closeH, closeM, 0, 0);
      let openNow = false;
      if (close <= open) {
        openNow = now >= open || now < close;
      } else {
        openNow = now >= open && now < close;
      }
      setIsOpen(openNow);
      if (openNow) {
        setStatusText('Open Now');
        setSubText(`Closes in ${getTimeDiffString(now, close)}`);
      } else {
        setStatusText('Closed');
        setSubText(`Opens at ${salon.opening_time}`);
      }
    };
    checkStatus();
    const interval = setInterval(checkStatus, 60000);
    return () => clearInterval(interval);
  }, [salon]);

  // Fetch reviews from API
  useEffect(() => {
    if (!salon?.id) return;

    let cancelled = false;

    fetch(`/api/reviews?business_id=${salon.id}`, { cache: FETCH_CACHE })
      .then((res) => res.json())
      .then(
        (result: {
          success?: boolean;
          data?: { rating_avg: number; review_count: number; reviews: { rating: number }[] };
        }) => {
          if (cancelled) return;
          if (result.success && result.data) {
            // Calculate rating counts from reviews
            const reviews = result.data.reviews || [];
            const rating_counts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
            reviews.forEach((review) => {
              const rating = Number(review.rating);
              if (rating_counts[rating] !== undefined) {
                rating_counts[rating]++;
              }
            });
            setReviewData({
              rating_avg: result.data.rating_avg || 0,
              review_count: result.data.review_count || 0,
              rating_counts,
            });
          }
        }
      )
      .catch(() => {
        // Silently handle error - reviews are optional
      });

    return () => {
      cancelled = true;
    };
  }, [salon]);

  if (loading) {
    return (
      <div
        className="w-full pb-24 flex flex-col gap-6"
        aria-busy="true"
        aria-label="Loading business profile"
      >
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
          <div className="flex flex-col gap-2">
            <div className="h-8 w-64 rounded-lg image-skeleton-shine" />
            <div className="h-5 w-32 rounded-full image-skeleton-shine" />
          </div>
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-full image-skeleton-shine" />
            <div className="flex flex-col gap-1">
              <div className="h-4 w-24 rounded image-skeleton-shine" />
              <div className="h-3 w-20 rounded image-skeleton-shine" />
            </div>
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 lg:p-6 shadow-sm">
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
        <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 lg:p-6 shadow-sm">
          <div className="h-6 w-24 mb-4 rounded image-skeleton-shine" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-24 w-full rounded-lg image-skeleton-shine" aria-hidden />
            ))}
          </div>
        </div>
      </div>
    );
  }
  if (!salon) {
    return <div className="w-full py-24 text-center text-red-600 text-lg">Business not found.</div>;
  }

  return (
    <div className="w-full pb-24 flex flex-col gap-6">
      {/* Header */}
      <SalonDetailsHeader
        salonName={salon.salon_name}
        ownerName={salon.owner_name ?? null}
        ownerPhone={salon.whatsapp_number ?? null}
        ownerImage={salon.owner_image ?? null}
        openingTime={salon.opening_time}
        closingTime={salon.closing_time}
      />

      {/* Shop Photos */}
      <SalonShopPhotos photos={photos} />

      {/* Services Section */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 lg:p-6 shadow-sm ring-1 ring-slate-100/80">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">Services</h2>

        {services && services.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {services.map((service) => (
              <div
                key={service.id}
                className="border rounded-lg p-4 hover:shadow-lg transition-shadow bg-white"
              >
                <div className="font-bold text-lg mb-1">{service.name}</div>

                <div className="flex items-center justify-between text-gray-600 text-sm">
                  <span>Duration: {service.duration}</span>

                  <span className="font-semibold text-black">₹{service.price}</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-3">
              <svg
                className="w-8 h-8 text-slate-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M8 7V3m8 4V3M3 11h18M5 19h14a2 2 0 002-2v-7H3v7a2 2 0 002 2z"
                />
              </svg>
            </div>

            <p className="text-lg text-gray-500">No services available</p>
          </div>
        )}
      </div>

      {/* Reviews */}
      <ReviewSummary reviewData={reviewData} />
    </div>
  );
};
function ReviewSummary({ reviewData }: { reviewData: ReviewData | null }) {
  // Show "No reviews yet." when there's no review data
  if (!reviewData || (reviewData.rating_avg === 0 && reviewData.review_count === 0)) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 lg:p-6 shadow-sm ring-1 ring-slate-100/80">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">Customer Reviews</h2>

        <div className="flex flex-col items-center justify-center min-h-[120px] text-center">
          <div className="flex items-center gap-1 mb-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <svg
                key={i}
                className="w-5 h-5 text-slate-300"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.286 3.963a1 1 0 00.95.69h4.167c.969 0 1.371 1.24.588 1.81l-3.373 2.451a1 1 0 00-.364 1.118l1.287 3.963c.3.921-.755 1.688-1.54 1.118l-3.373-2.452a1 1 0 00-1.175 0l-3.373 2.452c-.784.57-1.838-.197-1.539-1.118l1.286-3.963a1 1 0 00-.364-1.118L2.09 9.39c-.783-.57-.38-1.81.588-1.81h4.167a1 1 0 00.95-.69l1.254-3.963z" />
              </svg>
            ))}
          </div>

          <p className="text-sm text-slate-500">No reviews yet.</p>
        </div>
      </div>
    );
  }
  const { rating_avg, review_count, rating_counts } = reviewData;

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 lg:p-6 shadow-sm ring-1 ring-slate-100/80">
      <h2 className="text-lg font-semibold text-slate-900 mb-4">Customer Reviews</h2>

      <div className="flex flex-col sm:flex-row gap-6">
        {/* Average Rating */}
        <div className="flex flex-col items-center sm:items-start">
          <div className="text-4xl font-bold text-slate-900">{rating_avg?.toFixed(1) ?? '—'}</div>

          <StarRating value={Math.round(rating_avg ?? 0)} readonly size="md" />

          <p className="text-sm text-slate-500 mt-1">{review_count ?? 0} reviews</p>
        </div>

        {/* Distribution */}
        <div className="flex-1 space-y-2">
          {[5, 4, 3, 2, 1].map((star) => {
            const count = rating_counts?.[star] ?? 0;

            const percent =
              review_count && review_count > 0 ? Math.round((count / review_count) * 100) : 0;

            return (
              <div key={star} className="flex items-center gap-3">
                <span className="flex items-center gap-1 w-8 text-sm text-slate-600">
                  {star}
                  <svg className="w-4 h-4 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.286 3.963a1 1 0 00.95.69h4.167c.969 0 1.371 1.24.588 1.81l-3.373 2.451a1 1 0 00-.364 1.118l1.287 3.963c.3.921-.755 1.688-1.54 1.118l-3.373-2.452a1 1 0 00-1.175 0l-3.373 2.452c-.784.57-1.838-.197-1.539-1.118l1.286-3.963a1 1 0 00-.364-1.118L2.09 9.39c-.783-.57-.38-1.81.588-1.81h4.167a1 1 0 00.95-.69l1.254-3.963z" />
                  </svg>
                </span>

                <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
                  <div className="h-full bg-amber-400" style={{ width: `${percent}%` }} />
                </div>

                <span className="text-xs text-slate-500 w-8">{count}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
export default BusinessProfile;
