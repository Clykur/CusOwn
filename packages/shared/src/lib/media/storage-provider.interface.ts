/**
 * Storage provider abstraction. Enables swap to S3, GCS, or multi-region later.
 */

export interface UploadOptions {
  contentType: string;
  cacheControl?: string;
  metadata?: Record<string, string>;
  upsert?: boolean;
}

export interface SignedUrlOptions {
  expiresInSeconds: number;
  /** Optional single-use: revoke after first access (provider-dependent). */
  singleUse?: boolean;
}

export interface StorageProvider {
  upload(
    bucket: string,
    path: string,
    body: Buffer,
    options: UploadOptions
  ): Promise<{ etag?: string }>;

  remove(bucket: string, paths: string[]): Promise<void>;

  createSignedUrl(
    bucket: string,
    path: string,
    options: SignedUrlOptions
  ): Promise<{ url: string; expiresAt: string } | null>;

  /** Optional: get object metadata for ETag/cache. */
  head?(bucket: string, path: string): Promise<{ etag?: string; contentLength?: number } | null>;
}
