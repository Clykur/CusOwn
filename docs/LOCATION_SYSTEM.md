# Location system (production-grade)

## Principles

- **Never call BigDataCloud on every request.** Location is resolved once and then read from cookie or Supabase.
- **BigDataCloud is fallback only** when: no browser coordinates, no stored user location in Supabase, and no valid cookie.
- **All resolved locations are cached and persisted** (cookie + `user_locations` for logged-in users).

## User location flow

1. **First visit**
   - Client tries `navigator.geolocation` (user can allow or deny).
   - If **allowed** → send `latitude`, `longitude` to `POST /api/location/set`. Server reverse-geocodes once (if needed), stores in DB + cookie.
   - If **denied** → client calls `GET /api/location` once. Server finds no cookie/DB → calls BigDataCloud IP once → stores in cookie (and DB if logged in).
2. **Later requests**
   - `GET /api/location`: read cookie (signed, HTTP-only). If valid and fresh (< 7 days), return it and **do not** call BigDataCloud.
   - If no cookie: for logged-in users, read latest row from `user_locations` where `detected_at` is within 7 days. If found, return it.
   - Only if still missing: call BigDataCloud IP once, persist, return.

## Supabase

- **Table `user_locations`**: `id`, `user_id`, `city`, `region`, `country_code`, `latitude`, `longitude`, `detected_at`, `source` ('gps' | 'ip'). Index on `user_id`.
- **Optional PostGIS**: see `database/user_locations_postgis_optional.migration.sql` for `businesses.location_geo` and distance search. Business search currently uses in-app haversine; can be switched to PostGIS when the optional migration is applied.

## BigDataCloud usage

- API key only if `BIGDATACLOUD_API_KEY` is set in env (config/env.ts). Never logged or exposed to frontend.
- **Provider** (`lib/geo/provider.ts`): 3s timeout, 1 retry. Used only when cookie/DB miss.
- **IP lookups**: in-memory LRU cache (1h TTL, 5000 entries) so the same IP is not looked up repeatedly.
- **Rate limiting**: applied at API routes (`/api/location`, `/api/location/set`).

## Business search

- Uses coordinates stored in Supabase (`businesses.latitude`, `businesses.longitude`). No reverse-geocode in search path.
- Distance filtering/sort is in-app haversine. Optional: enable PostGIS and use `location_geo` for `ORDER BY distance` in DB.

## Security

- Location cookie is signed (HMAC). Validated server-side; client cannot forge.
- API key exists only in config/env.ts. Coordinates validated with `validateCoordinates`.

## Scalability

- Geo search relies on Supabase only. External geo is not on the critical path; if BigDataCloud is down, existing cookie/DB locations still work.
