// Geodesic utilities
const EARTH_RADIUS_KM = 6371.0088; // mean Earth radius in kilometers

function toRad(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

// Validate numeric latitude/longitude ranges. Rejects (0,0) as invalid/sentinel. Returns boolean rather than throwing.
export function validateCoordinates(lat: number, lng: number): boolean {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  if (lat === 0 && lng === 0) return false;
  if (lat < -90 || lat > 90) return false;
  if (lng < -180 || lng > 180) return false;
  return true;
}

export function assertValidCoordinates(lat: number, lng: number): void {
  if (!validateCoordinates(lat, lng)) {
    throw new Error(`Invalid coordinates: lat=${lat}, lng=${lng}`);
  }
}

export function validateRadius(radius: number): boolean {
  if (!Number.isFinite(radius)) return false;
  // Allow 0.1km to 200km as reasonable application bounds; callers can further restrict.
  return radius >= 0.1 && radius <= 200;
}

// Haversine formula (inputs in degrees). Returns distance in kilometers.
export function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  // Defensive: ensure numeric inputs
  if (![lat1, lon1, lat2, lon2].every(Number.isFinite)) return NaN;

  // Identical coordinates quick path
  if (lat1 === lat2 && lon1 === lon2) return 0;

  const φ1 = toRad(lat1);
  const φ2 = toRad(lat2);
  const Δφ = toRad(lat2 - lat1);
  const Δλ = toRad(lon2 - lon1);

  const sinΔφ2 = Math.sin(Δφ / 2);
  const sinΔλ2 = Math.sin(Δλ / 2);

  const a = sinΔφ2 * sinΔφ2 + Math.cos(φ1) * Math.cos(φ2) * sinΔλ2 * sinΔλ2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_KM * c;
}

// Compute a bounding box (minLat,maxLat,minLng,maxLng) in degrees for given radiusKm around (lat,lng).
// Uses simple approximations suitable for small-to-moderate radii.
export function boundingBox(lat: number, lng: number, radiusKm: number) {
  assertValidCoordinates(lat, lng);
  if (!validateRadius(radiusKm)) throw new Error('Invalid radius');

  const degLat = radiusKm / 111.32; // approx km per degree latitude
  // longitude degrees per km depends on latitude
  const degLng = radiusKm / (111.32 * Math.cos(toRad(lat)));

  return {
    minLat: lat - degLat,
    maxLat: lat + degLat,
    minLng: lng - degLng,
    maxLng: lng + degLng,
  };
}

// Parse and validate coordinate inputs (strings or numbers). Throws on invalid input.
export function parseAndValidateCoordinates(latRaw: unknown, lngRaw: unknown) {
  const lat = typeof latRaw === 'string' ? parseFloat(latRaw) : (latRaw as number);
  const lng = typeof lngRaw === 'string' ? parseFloat(lngRaw) : (lngRaw as number);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    throw new Error('Malformed coordinates');
  }
  assertValidCoordinates(lat, lng);
  return { lat, lng };
}

// Normalize coordinate value for storage (no rounding here).
export function normalizeCoordinate(lat: number, lng: number) {
  assertValidCoordinates(lat, lng);
  return { lat: Number(lat), lng: Number(lng) };
}
