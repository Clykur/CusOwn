'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Image from 'next/image';
import { UI_CUSTOMER } from '@/config/constants';
import {
  getCachedBusinessProfile,
  setCachedBusinessProfile,
} from '@/lib/cache/business-profile-cache';

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
}
interface Service {
  id: string;
  name: string;
  duration: string;
  price: string;
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

  if (loading) {
    return (
      <div
        className="w-full pb-24 flex flex-col gap-6"
        aria-busy="true"
        aria-label="Loading business profile"
      >
        <div className="flex items-center justify-between mb-4">
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
      {/* Header Section: Salon Name → Owner Profile Image (circular) → Owner Name → Phone Icon → Owner Phone Number */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex flex-col">
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-slate-900 truncate leading-tight">
            {salon.salon_name}
          </h1>
          <div className="flex items-center gap-2 mt-2">
            <span
              className={`px-2 py-0.5 rounded-full text-xs font-semibold ${isOpen ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}
            >
              {statusText}
            </span>
            <span className="text-gray-500 text-xs">{subText}</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {salon.owner_image && salon.owner_image !== '' ? (
            <Image
              src={salon.owner_image}
              alt={salon.owner_name || 'Owner'}
              className="w-12 h-12 rounded-full object-cover border-2 border-slate-100 shadow-md ring-1 ring-slate-200/50"
              width={48}
              height={48}
              sizes="48px"
              quality={IMAGE_QUALITY_PREMIUM}
              priority
            />
          ) : (
            <Image
              src={UI_CUSTOMER.DEFAULT_AVATAR_DATA_URI}
              alt={salon.owner_name || 'Owner'}
              className="w-12 h-12 rounded-full object-cover border-2 border-slate-100 shadow-md"
              width={48}
              height={48}
              sizes="48px"
              unoptimized
            />
          )}
          <div className="flex flex-col">
            {salon.owner_name && salon.owner_name.trim() !== '' && (
              <span className="font-medium text-slate-900">{salon.owner_name}</span>
            )}
            {salon.whatsapp_number && (
              <a
                href={`https://wa.me/${salon.whatsapp_number}`}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-green-600 font-medium text-sm text-slate-600"
                title="Chat on WhatsApp"
              >
                {salon.whatsapp_number}
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Photo Gallery — premium 4K-style clarity and shine skeleton */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 lg:p-6 shadow-sm ring-1 ring-slate-100/80">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">Shop Photos</h2>
        {photos && photos.length > 0 ? (
          <div className="columns-1 md:columns-2 lg:columns-3 gap-4 space-y-4">
            {photos.map((url, idx) => (
              <div
                key={idx}
                className="relative group break-inside-avoid rounded-xl overflow-hidden border border-slate-100 bg-slate-50/50 shadow-md ring-1 ring-slate-200/30"
              >
                <PremiumGalleryImage
                  src={url}
                  alt={`Salon photo ${idx + 1}`}
                  className="w-full h-full object-cover"
                />
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
                  d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z"
                />
              </svg>
            </div>
            <p className="text-sm text-slate-500">No shop photos yet.</p>
          </div>
        )}
      </div>

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
    </div>
  );
};

export default BusinessProfile;
