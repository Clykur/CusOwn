'use client';

import { useState } from 'react';
import Image from 'next/image';

const GALLERY_IMAGE_WIDTH = 1200;
const GALLERY_IMAGE_HEIGHT = 800;
const IMAGE_QUALITY_PREMIUM = 95;

function GalleryImage({ src, alt, className }: { src: string; alt: string; className?: string }) {
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
        className={`${className ?? ''} object-cover transition-all duration-500 group-hover:scale-105 ${
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
    <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 lg:p-6 shadow-sm ring-1 ring-slate-100/80">
      <h2 className="text-lg font-semibold text-slate-900 mb-4">Shop Photos</h2>

      {photos && photos.length > 0 ? (
        <div className="columns-1 md:columns-2 lg:columns-3 gap-4 space-y-4">
          {photos.map((url, idx) => (
            <div
              key={idx}
              className="relative group break-inside-avoid rounded-xl overflow-hidden border border-slate-100 bg-slate-50/50 shadow-md ring-1 ring-slate-200/30 gallery-shine hover:shadow-xl transition"
            >
              <GalleryImage src={url} alt={`Salon photo ${idx + 1}`} className="w-full h-full" />
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
  );
}
