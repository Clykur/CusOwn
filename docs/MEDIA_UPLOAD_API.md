# Media Upload API — Contracts & Scalability

## Overview

Production-grade file upload for **business photos** (multiple per business) and **profile images** (owner and customer). Storage is Supabase Storage; metadata and referential integrity are in the `media` table.

## API Contracts

### 1. Upload profile image

- **Endpoint:** `POST /api/media/profile`
- **Auth:** Required (any authenticated user; upload applies to own profile).
- **Body:** `multipart/form-data` with field `file` (image file).
- **Rate limit:** Per user + per IP (see `RATE_LIMIT_MEDIA_UPLOAD_*` in constants).

**Example request:**

```http
POST /api/media/profile
Authorization: Bearer <token>
Content-Type: multipart/form-data; boundary=----boundary

------boundary
Content-Disposition: form-data; name="file"; filename="avatar.jpg"
Content-Type: image/jpeg

<binary>
------boundary--
```

**Example response (200):**

```json
{
  "success": true,
  "data": {
    "media": {
      "id": "uuid",
      "entity_type": "profile",
      "entity_id": "user-uuid",
      "content_type": "image/jpeg",
      "size_bytes": 12345,
      "sort_order": 0,
      "created_at": "..."
    }
  },
  "message": "Profile image updated successfully"
}
```

**Errors:** 400 (invalid type/size), 401 (unauthenticated), 429 (rate limit).

---

### 2. List business images

- **Endpoint:** `GET /api/media/business/:businessId?limit=25&offset=0`
- **Auth:** Not required (public for customer UI).
- **Query:** `limit` (default 25, max 100), `offset` (default 0).

**Example response (200):**

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "uuid",
        "entity_type": "business",
        "entity_id": "business-uuid",
        "content_type": "image/jpeg",
        "size_bytes": 50000,
        "sort_order": 0,
        "created_at": "..."
      }
    ],
    "limit": 25,
    "offset": 0
  }
}
```

---

### 3. Upload business image

- **Endpoint:** `POST /api/media/business/:businessId`
- **Auth:** Required; caller must own the business.
- **Body:** `multipart/form-data` with `file`; optional `sortOrder` (integer).

**Example response (200):**

```json
{
  "success": true,
  "data": {
    "media": {
      "id": "uuid",
      "entity_type": "business",
      "entity_id": "business-uuid",
      "content_type": "image/webp",
      "size_bytes": 8000,
      "sort_order": 1,
      "created_at": "..."
    }
  },
  "message": "Image uploaded successfully"
}
```

**Errors:** 400 (invalid file or max images reached), 403 (not owner), 404 (invalid businessId).

---

### 4. Get signed URL

- **Endpoint:** `GET /api/media/signed-url?mediaId=:mediaId`
- **Auth:** Business media — public. Profile media — only profile owner or admin.
- **Rate limit:** Per user + per IP.

**Example response (200):**

```json
{
  "success": true,
  "data": {
    "url": "https://...supabase.co/storage/v1/object/sign/uploads/business/...?token=...",
    "expiresAt": "2025-02-28T12:00:00.000Z"
  }
}
```

TTL is from `env.security.signedUrlTtlSeconds` (e.g. 24h).

---

### 5. Delete media

- **Endpoint:** `DELETE /api/media/:mediaId`
- **Auth:** Required. Business media: must own business. Profile media: must be profile owner.

**Example response (200):**

```json
{
  "success": true,
  "data": { "id": "media-uuid" },
  "message": "Image removed successfully"
}
```

---

## Security

- **Validation:** Allowed MIME types and max size from `config/constants.ts`. Filename sanitized; path traversal prevented in `lib/validation/upload-validation.ts`.
- **Authorization:** Profile = self only. Business = owner only (via `userService.getUserBusinesses`). Signed URL for profile = owner or admin.
- **Rate limiting:** Upload endpoints use `RATE_LIMIT_MEDIA_UPLOAD_*`; signed-URL endpoint has its own limit.
- **Storage:** Private bucket; access only via signed URLs or service role. No raw storage paths exposed to client.

## Scalability

- **Horizontal:** Stateless API; rate limit store is in-memory per instance (for multi-instance, use a shared store e.g. Redis and keep the same `keyPrefix`/window contract).
- **DB:** Indexes on `(entity_type, entity_id)` and `(entity_type, entity_id, deleted_at)` for list/count; unique partial index for one active profile image per user.
- **Storage:** Supabase Storage scales with the plan; paths are `business/:id/:uuid.ext` and `profile/:userId/:uuid.ext` to avoid hot prefixes.
- **CDN:** Signed URLs can be generated with short TTL; front-end or a separate service can cache signed URLs per media id with a short TTL (e.g. 5–15 min) and refresh; origin remains the Supabase Storage signed URL.
- **N+1:** List endpoints return only metadata; clients request signed URLs per media id in batch or on demand, so no N+1 in a single list call.

## Production hardening (enterprise)

- **Content security:** Magic-byte validation (file signature) verifies real image type; MIME mismatch rejected. EXIF stripped on upload (config: `MEDIA_STRIP_EXIF`). Optional recompression via sharp. Polyglot attacks prevented by signature check.
- **Duplicate & spam:** SHA-256 content hash stored; duplicate uploads for same entity (same hash) rejected. Per-business max enforced at DB trigger (`MEDIA_MAX_BUSINESS_IMAGES`). Circuit breaker opens after repeated upload failures (config: `MEDIA_CIRCUIT_BREAKER_*`).
- **Atomicity & idempotency:** Upload flow: storage write first, then DB insert; on insert failure storage object is removed. Idempotency via `Idempotency-Key` header; same key returns stored response (resource types: `media_profile`, `media_business`). Profile replacement avoids race via single active row per user.
- **Background pipeline:** `processing_status` and `variants` (thumbnail, medium, large) on `media`. Queue-ready: `lib/media/variants-pipeline.ts` exposes `processMediaVariants(mediaId)` for cron or distributed workers.
- **Security controls:** `media_security_log` table for anomaly events (upload_failed, mime_mismatch, magic_byte_reject, size_abuse, duplicate_reject, circuit_open). Circuit breaker per user/key. Signed URLs use storage provider abstraction; short TTL supported via `MEDIA_SIGNED_URL_TTL_SHORT`.
- **Storage & cache:** Cache-Control header on uploads (`MEDIA_CACHE_CONTROL_HEADER`). ETag stored for client caching. Lifecycle: cron `purge-soft-deleted-media` hard-deletes rows and removes objects after `MEDIA_RETENTION_DAYS`.
- **Observability:** Metrics: `media.upload.success`, `media.upload.failure`, `media.upload.duration_ms`, `media.signed_url.generated`, `media.signed_url.duration_ms`, `media.purge.count`. Structured JSON logs in `lib/media/structured-log.ts`. Health: `GET /api/health/media` (storage + media table).
- **Scalability:** Rate limit store abstracted (`lib/security/rate-limit-store.interface.ts`); in-memory impl default; swap for Redis/DB for horizontal scaling. Storage abstracted (`lib/media/storage-provider.interface.ts`); Supabase impl; ready for multi-region bucket swap.

## Setup

1. Run migrations: `database/media-uploads.migration.sql` then `database/media-hardening.migration.sql`.
2. Create Supabase Storage bucket named per `env.upload.storageBucket` (default `uploads`). Set bucket to **private**; all access via signed URLs.
3. Env (optional): `UPLOAD_STORAGE_BUCKET`, `MEDIA_RETENTION_DAYS`, `MEDIA_SIGNED_URL_TTL_SHORT`, `MEDIA_STRIP_EXIF`, `MEDIA_VALIDATE_MAGIC_BYTES` (see `env.template`).
4. Cron: schedule `POST /api/cron/purge-soft-deleted-media` with `CRON_SECRET` for retention purge.
