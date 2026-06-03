'use client';

import { useState } from 'react';
import Image from 'next/image';
import { UI_CUSTOMER } from '@cusown/config';

const GALLERY_IMAGE_WIDTH = 1200;
const GALLERY_IMAGE_HEIGHT = 800;
const IMAGE_QUALITY_PREMIUM = 95;

function GalleryImage({ src, alt, className }: { src: string; alt: string; className?: string }) {
  const [loaded, setLoaded] = useState(false);

  return (
    <div className="relative aspect-[3/2] w-full overflow-hidden rounded-lg bg-surface-elevated sm:rounded-xl">
      <div
        className={`absolute inset-0 bg-surface-elevated skeleton-shimmer transition-opacity duration-300 ${
          loaded ? 'pointer-events-none opacity-0' : 'opacity-100'
        }`}
        aria-hidden
      />

      <Image
        src={src}
        alt={alt}
        width={GALLERY_IMAGE_WIDTH}
        height={GALLERY_IMAGE_HEIGHT}
        quality={IMAGE_QUALITY_PREMIUM}
        sizes="(max-width: 640px) 34vw, (max-width: 1024px) 33vw, 320px"
        loading="lazy"
        className={`${className ?? ''} h-full w-full object-cover transition-all duration-500 group-hover:scale-[1.03] ${
          loaded ? 'opacity-100' : 'opacity-0'
        }`}
        onLoad={() => setLoaded(true)}
      />
    </div>
  );
}

export interface SalonShopPhotosProps {
  photos: string[];
}

export default function SalonShopPhotos({ photos }: SalonShopPhotosProps) {
  return (
    <section className="rounded-2xl border border-border-secondary bg-surface-card p-4 shadow-sm sm:p-5 lg:p-6">
      <h2 className="mb-4 text-lg font-semibold tracking-tight text-text-primary">
        {UI_CUSTOMER.SALON_DETAILS_SHOP_PHOTOS}
      </h2>

      {photos && photos.length > 0 ? (
        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          {photos.map((url, idx) => (
            <div
              key={idx}
              className="group relative overflow-hidden rounded-lg border border-border-secondary bg-surface-elevated shadow-sm transition hover:border-border-primary hover:shadow-md sm:rounded-xl"
            >
              <GalleryImage src={url} alt={`${UI_CUSTOMER.SALON_DETAILS_SHOP_PHOTOS} ${idx + 1}`} />
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-surface-elevated">
            <svg
              className="h-8 w-8 text-text-secondary"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z"
              />
            </svg>
          </div>

          <p className="text-sm text-text-secondary">{UI_CUSTOMER.SALON_DETAILS_NO_PHOTOS}</p>
        </div>
      )}
    </section>
  );
}
