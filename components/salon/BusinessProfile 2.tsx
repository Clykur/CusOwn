'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Image from 'next/image';

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

export const BusinessProfile = () => {
  const params = useParams();
  const slug = typeof params?.slug === 'string' ? params.slug : '';

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
  const [salon, setSalon] = useState<Salon | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [photos, setPhotos] = useState<string[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [statusText, setStatusText] = useState('');
  const [subText, setSubText] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    // Fetch salon
    fetch(`/api/salons/${slug}`)
      .then((res) => res.json())
      .then((result) => {
        if (result.success && result.data) {
          setSalon(result.data);
        } else {
          setSalon(null);
        }
      })
      .catch(() => setSalon(null));
  }, [slug]);

  useEffect(() => {
    if (!salon?.id) return;
    // If salon.owner_id exists, search services by user id, else by business id
    const userId = (salon as any).owner_id;
    const queryParam = userId ? `userId=${userId}` : `businessId=${salon.id}`;
    fetch(`/api/services/list?${queryParam}`)
      .then((res) => res.json())
      .then((result) => {
        if (result.success && result.data) {
          setServices(
            result.data.map((s: any) => ({
              id: s.id,
              name: s.name,
              duration: `${s.duration_minutes} min`,
              price: (s.price_cents / 100).toFixed(0),
            }))
          );
        } else {
          setServices([]);
        }
      })
      .catch(() => setServices([]));
  }, [salon]);

  useEffect(() => {
    if (!salon?.id) return;
    // Fetch photos
    fetch(`/api/media/business/${salon.id}`)
      .then((res) => res.json())
      .then(async (result) => {
        if (result.success && result.data?.items) {
          const urls = await Promise.all(
            result.data.items.map(async (item: any) => {
              const signedRes = await fetch(
                `/api/media/signed-url?mediaId=${encodeURIComponent(item.id)}`
              );
              const signedResult = await signedRes.json();
              return signedResult?.data?.url || null;
            })
          );
          setPhotos(urls.filter(Boolean));
        } else {
          setPhotos([]);
        }
      })
      .catch(() => setPhotos([]));
    setLoading(false);
  }, [salon?.id]);

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
    return <div className="w-full py-24 text-center text-gray-500 text-lg">Loading...</div>;
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
          <Image
            src={
              salon.owner_image && salon.owner_image !== ''
                ? salon.owner_image
                : '/default-avatar.png'
            }
            alt={salon.owner_name}
            className="w-12 h-12 rounded-full object-cover border border-gray-200"
            width={48}
            height={48}
          />
          <span aria-label="Phone" className="text-gray-400">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path
                d="M22 16.92V19a2 2 0 01-2.18 2A19.86 19.86 0 013 5.18 2 2 0 015 3h2.09a2 2 0 012 1.72c.13 1.13.37 2.23.72 3.28a2 2 0 01-.45 2.11l-1.27 1.27a16.06 16.06 0 006.11 6.11l1.27-1.27a2 2 0 012.11-.45c1.05.35 2.15.59 3.28.72A2 2 0 0122 16.92z"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M19.07 4.93a7.007 7.007 0 010 9.9"
                stroke="currentColor"
                strokeWidth="1.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M15.54 8.46a3.003 3.003 0 010 4.24"
                stroke="currentColor"
                strokeWidth="1.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          {salon.whatsapp_number ? (
            <a
              href={`https://wa.me/${salon.whatsapp_number}`}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-green-600 font-medium"
              title="Chat on WhatsApp or Call"
            >
              {salon.whatsapp_number}
            </a>
          ) : (
            <a
              href={`tel:${salon.owner_name || ''}`}
              className="hover:text-blue-600 font-medium"
              title="Call Owner"
            >
              {salon.owner_name || 'N/A'}
            </a>
          )}
        </div>
      </div>

      {/* Photo Gallery */}
      <div className="bg-white border border-slate-200 rounded-lg p-4 sm:p-5 lg:p-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">Shop Photos</h2>
        {photos && photos.length > 0 ? (
          <div className="columns-1 md:columns-2 lg:columns-3 gap-4 space-y-4">
            {photos.map((url, idx) => (
              <div
                key={idx}
                className="relative group break-inside-avoid rounded-lg overflow-hidden border border-slate-200 bg-slate-50"
              >
                <Image
                  src={url}
                  alt={`Salon photo ${idx + 1}`}
                  className="w-full h-auto object-cover"
                  width={600}
                  height={400}
                  loading="lazy"
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
      <div className="bg-white border border-slate-200 rounded-lg p-4 sm:p-5 lg:p-6">
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
