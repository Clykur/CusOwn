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
    <div className="bg-white border border-slate-200 rounded-lg p-4 sm:p-5 lg:p-6">
      <h2 className="text-lg font-semibold text-slate-900 mb-4">Shop Photos</h2>

      <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
        <h3 className="text-sm font-medium text-slate-800 mb-2">Upload Shop Photos</h3>
        <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
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
            className="block w-full text-sm text-slate-700 file:mr-3 file:rounded-lg file:border-0 file:bg-black file:px-3 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-gray-900"
          />
          <button
            type="button"
            onClick={onUpload}
            disabled={uploadingPhotos || selectedFiles.length === 0}
            className="inline-flex items-center justify-center rounded-lg bg-black px-4 py-2 text-sm font-semibold text-white hover:bg-gray-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
          >
            {uploadingPhotos ? (
              <>
                <span className="animate-spin mr-2 inline-block h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                Uploading…
              </>
            ) : (
              'Upload'
            )}
          </button>
        </div>
        <p className="mt-2 text-xs text-slate-500">JPG, PNG, or WEBP · Max 5 MB each</p>

        {selectedFiles.length > 0 && (
          <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {selectedFiles.map((file, idx) => {
              const url = URL.createObjectURL(file);
              return (
                <div
                  key={file.name + file.size + idx}
                  className="relative group overflow-hidden rounded-lg border border-slate-200 bg-slate-50"
                >
                  <div className="relative h-40 w-full">
                    <Image
                      src={url}
                      alt={file.name}
                      className="object-cover w-full h-full rounded-lg"
                      width={320}
                      height={160}
                    />
                    <button
                      type="button"
                      className="absolute top-2 right-2 rounded-lg bg-white/90 border border-slate-200 p-1.5 text-slate-600 opacity-100 hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-all"
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
                  <div className="absolute bottom-2 left-2 bg-white/90 rounded px-2 py-1 text-xs font-medium text-slate-700 border border-slate-200">
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
        <div className="mb-4 rounded-lg bg-red-50 border border-red-200 text-red-800 px-4 py-3 text-sm">
          {photoError}
        </div>
      )}

      {photosLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {Array.from({ length: Math.max(4, selectedFiles.length || photos.length) }).map(
            (_, i) => (
              <div
                key={i}
                className="rounded-lg border border-gray-200 bg-white p-3 flex flex-col items-center justify-center h-40 skeleton-shimmer"
              >
                <div className="h-28 w-full bg-gray-200 rounded mb-3" />
              </div>
            )
          )}
        </div>
      ) : photos.length === 0 ? (
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
          <p className="text-sm text-slate-500">
            No shop photos yet. Upload your first photo above.
          </p>
        </div>
      ) : (
        <div className="columns-1 md:columns-2 lg:columns-3 gap-4 space-y-4">
          {photos.map((photo) => (
            <div
              key={photo.id}
              className="relative group break-inside-avoid rounded-lg overflow-hidden border border-slate-200 bg-slate-50"
            >
              <Image
                src={photo.url}
                alt="Shop photo"
                width={1200}
                height={800}
                className="w-full h-auto"
                unoptimized
              />
              <button
                type="button"
                onClick={() => onDeletePhoto(photo.id)}
                disabled={deletingPhotoIds.has(photo.id)}
                className="absolute top-2 right-2 z-10 rounded-lg bg-white/90 border border-slate-200 p-1.5 text-slate-600 opacity-0 group-hover:opacity-100 hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                title="Delete photo"
              >
                {deletingPhotoIds.has(photo.id) ? (
                  <span className="block h-4 w-4 animate-spin border-2 border-red-400 border-t-transparent rounded-full" />
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
