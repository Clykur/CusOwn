'use client';

import { memo } from 'react';
import Image from 'next/image';

interface ShopPhoto {
  id: string;
  url: string;
}

interface ShopPhotosSectionProps {
  photos: ShopPhoto[];
  selectedFiles: File[];
  photosLoading: boolean;
  uploadingPhotos: boolean;
  photoError: string | null;
  deletingPhotoIds: Set<string>;
  uploadQueue: { file: File; status: 'pending' | 'uploading' | 'success' | 'error' }[];
  onFileSelect: (files: File[]) => void;
  onRemoveSelectedFile: (index: number) => void;
  onUpload: () => void;
  onDeletePhoto: (photoId: string) => void;
}

function ShopPhotosSectionComponent({
  photos,
  selectedFiles,
  photosLoading,
  uploadingPhotos,
  photoError,
  deletingPhotoIds,
  uploadQueue,
  onFileSelect,
  onRemoveSelectedFile,
  onUpload,
  onDeletePhoto,
}: ShopPhotosSectionProps) {
  return (
    <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.06)] ring-1 ring-slate-900/[0.04] sm:p-5 md:rounded-lg md:shadow-none md:ring-0 lg:p-6">
      <h2 className="mb-1 text-base font-semibold text-slate-900 md:text-lg">Shop Photos</h2>
      <p className="mb-4 text-xs text-slate-500 md:text-sm">
        Show customers your space. Sharp, well-lit photos work best.
      </p>

      <div className="mb-5 rounded-2xl border-2 border-dashed border-slate-200 bg-gradient-to-b from-slate-50/90 to-white p-4 md:rounded-xl md:p-5">
        <div className="mb-3 flex items-center gap-2">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-900/5 text-slate-600">
            <svg
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z"
              />
            </svg>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Upload shop photos</h3>
            <p className="text-[11px] text-slate-500 md:text-xs">Choose files, then tap Upload</p>
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-stretch">
          <label className="relative flex min-h-[2.75rem] flex-1 cursor-pointer items-center overflow-hidden rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 shadow-sm transition hover:border-slate-300 hover:bg-slate-50/80">
            <input
              id="shop-photo-input"
              type="file"
              multiple
              accept="image/jpeg,image/png,image/webp"
              disabled={uploadingPhotos}
              onChange={(e) => {
                const files = Array.from(e.target.files || []);
                onFileSelect(files);
              }}
              className="absolute inset-0 cursor-pointer opacity-0 disabled:cursor-not-allowed"
            />
            <span className="truncate text-xs font-medium text-slate-700 sm:text-sm">
              {selectedFiles.length > 0
                ? `${selectedFiles.length} file${selectedFiles.length === 1 ? '' : 's'} selected`
                : 'No file chosen'}
            </span>
          </label>
          <button
            type="button"
            onClick={onUpload}
            disabled={uploadingPhotos || selectedFiles.length === 0}
            className="inline-flex h-11 shrink-0 items-center justify-center rounded-xl bg-slate-900 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50 sm:h-auto sm:min-w-[7rem]"
          >
            {uploadingPhotos ? (
              <>
                <span className="mr-2 inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Uploading…
              </>
            ) : (
              'Upload'
            )}
          </button>
        </div>
        <p className="mt-3 flex items-center gap-1.5 text-[11px] leading-relaxed text-slate-500 md:text-xs">
          <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] text-slate-600">
            JPG · PNG · WEBP
          </span>
          <span>Max 5 MB each</span>
        </p>

        {selectedFiles.length > 0 && (
          <div className="mt-4 grid grid-cols-3 gap-1.5 sm:gap-2 md:gap-3 lg:grid-cols-4">
            {selectedFiles.map((file, idx) => {
              const url = URL.createObjectURL(file);
              return (
                <div
                  key={file.name + file.size + idx}
                  className="group relative overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
                >
                  <div className="relative aspect-[4/3] w-full bg-slate-100">
                    <Image
                      src={url}
                      alt={file.name}
                      fill
                      className="object-cover"
                      sizes="(max-width: 640px) 33vw, (max-width: 1024px) 33vw, 25vw"
                    />
                    <button
                      type="button"
                      className="absolute right-1.5 top-1.5 rounded-lg border border-slate-200 bg-white/95 p-1.5 text-slate-600 shadow-sm transition hover:border-red-200 hover:bg-red-50 hover:text-red-600"
                      title="Remove image"
                      onClick={() => onRemoveSelectedFile(idx)}
                    >
                      <svg
                        className="h-4 w-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </button>
                  </div>
                  <div className="absolute bottom-1.5 left-1.5 rounded-md border border-slate-200/80 bg-white/95 px-2 py-0.5 text-[10px] font-medium text-slate-700 shadow-sm">
                    {uploadQueue[idx]?.status === 'uploading'
                      ? 'Uploading…'
                      : uploadQueue[idx]?.status === 'success'
                        ? 'Uploaded'
                        : uploadQueue[idx]?.status === 'error'
                          ? 'Error'
                          : 'Pending'}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {photoError && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {photoError}
        </div>
      )}

      {photosLoading ? (
        <div className="grid grid-cols-3 gap-1.5 sm:gap-2 md:gap-3 lg:grid-cols-4">
          {Array.from({ length: Math.max(4, selectedFiles.length || photos.length) }).map(
            (_, i) => (
              <div
                key={i}
                className="flex aspect-[4/3] flex-col items-center justify-center rounded-xl border border-slate-200 bg-slate-50 skeleton-shimmer"
              >
                <div className="h-full w-full rounded-lg bg-slate-200/80" />
              </div>
            )
          )}
        </div>
      ) : photos.length === 0 ? (
        <div className="rounded-2xl border border-slate-100 bg-slate-50/50 px-4 py-10 text-center md:py-12">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-white shadow-sm ring-1 ring-slate-200/80">
            <svg
              className="h-7 w-7 text-slate-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.25}
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z"
              />
            </svg>
          </div>
          <p className="text-sm font-medium text-slate-700">No shop photos yet</p>
          <p className="mt-1 max-w-xs mx-auto text-xs leading-relaxed text-slate-500">
            Add images above so customers can see your salon before they book.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-1.5 sm:gap-2 md:grid-cols-3 md:gap-3 lg:grid-cols-4">
          {photos.map((photo) => (
            <div
              key={photo.id}
              className="group relative overflow-hidden rounded-lg border border-slate-200 bg-slate-50 shadow-sm sm:rounded-xl"
            >
              <Image
                src={photo.url}
                alt="Shop photo"
                width={1200}
                height={800}
                className="h-auto w-full"
                unoptimized
              />
              <button
                type="button"
                onClick={() => onDeletePhoto(photo.id)}
                disabled={deletingPhotoIds.has(photo.id)}
                className="absolute right-2 top-2 z-10 rounded-lg border border-slate-200 bg-white/95 p-2 text-slate-600 opacity-100 shadow-sm transition hover:border-red-200 hover:bg-red-50 hover:text-red-600 active:opacity-100 md:opacity-0 md:group-hover:opacity-100"
                title="Delete photo"
              >
                {deletingPhotoIds.has(photo.id) ? (
                  <span className="block h-4 w-4 animate-spin rounded-full border-2 border-red-400 border-t-transparent" />
                ) : (
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                    />
                  </svg>
                )}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export const ShopPhotosSection = memo(ShopPhotosSectionComponent);
export default ShopPhotosSection;
