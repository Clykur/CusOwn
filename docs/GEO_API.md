# Geo API (BigDataCloud)

Location APIs use [BigDataCloud](https://www.bigdatacloud.com). **No API key required** for free tier; set `BIGDATACLOUD_API_KEY` in env when you need higher limits or guaranteed IP lookup.

## Endpoints

### GET /api/geo/reverse-geocode

Reverse-geocode coordinates to city/region/country.

**Query:**

- `latitude` (required) — -90 to 90
- `longitude` (required) — -180 to 180
- `localityLanguage` (optional) — e.g. `en`

**Response (200):** `{ success: true, data: { city, region, countryCode, countryName, localityInfo, latitude, longitude } }`

**Rate limit:** Per IP (see `GEO_RATE_LIMIT_*` in constants). **Cache:** 24h.

---

### GET /api/geo/ip

Geolocation for the request’s client IP, or optional `?ip=` for a specific IP.

**Query:**

- `ip` (optional) — IPv4 or IPv6. If omitted, the connecting client’s IP is used.

**Response (200):** `{ success: true, data: { ip, city, region, countryCode, countryName, latitude, longitude } }`

**Rate limit:** Per IP. **Cache:** 1h.

## Usage

- **API key:** Optional. Set `BIGDATACLOUD_API_KEY` in `.env.local` / env when required (e.g. higher limits). If unset, free tier is used.
- All calls are server-side proxy, rate-limited and cached.
- Use for: getting city/region from coordinates (e.g. business search), or approximate location from IP (e.g. default city in filters).
- Errors: 400 (invalid params), 429 (rate limit), 503 (upstream unavailable). Use `ERROR_MESSAGES.GEO_*` in responses.
