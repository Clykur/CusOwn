import { env } from '@/config/env';

export interface ReverseGeocodeResult {
  address_line1: string;
  city: string;
  state: string;
  country: string;
  postal_code: string;
  countryCode?: string;
  locality?: string;
  principalSubdivision?: string;
  latitude?: number;
  longitude?: number;
}

export interface IpLookupResult {
  latitude: number;
  longitude: number;
  city: string;
  country: string;
  countryCode?: string;
  state?: string;
  ip?: string;
}

class GeolocationService {
  private readonly apiKey: string = env.geo.bigDataCloudApiKey;
  private readonly baseUrl: string = 'https://api.bigdatacloud.net/data';

  private async fetchWithRetry(url: string, retries: number = 2): Promise<Response> {
    let lastError: Error | undefined;
    for (let i = 0; i <= retries; i++) {
      try {
        const response = await fetch(url, {
          method: 'GET',
          headers: { Accept: 'application/json' },
          signal: AbortSignal.timeout(5000), // 5s timeout
        });
        if (response.ok) return response;
        if (response.status >= 500) {
          throw new Error(`Server error: ${response.status}`);
        }
        return response; // Return non-retryable errors (4xx)
      } catch (error) {
        lastError = error as Error;
        if (i < retries) {
          await new Promise((resolve) => setTimeout(resolve, 1000 * (i + 1))); // Exponential-ish backoff
        }
      }
    }
    throw lastError || new Error('Fetch failed after retries');
  }

  async reverseGeocode(lat: number, lng: number): Promise<ReverseGeocodeResult | null> {
    const url = new URL(`${this.baseUrl}/reverse-geocode-client`);
    url.searchParams.set('latitude', lat.toString());
    url.searchParams.set('longitude', lng.toString());
    url.searchParams.set('localityLanguage', 'en');
    if (this.apiKey) url.searchParams.set('key', this.apiKey);

    try {
      const response = await this.fetchWithRetry(url.toString());
      if (!response.ok) return null;

      const data = await response.json();

      // Construct address_line1 from locality and principalSubdivision if needed
      const address_line1 = data.locality || data.city || '';

      return {
        address_line1,
        city: data.city || data.locality || '',
        state: data.principalSubdivision || '',
        country: data.countryName || '',
        postal_code: data.postcode || '',
        countryCode: data.countryCode || '',
        locality: data.locality || '',
        principalSubdivision: data.principalSubdivision || '',
        latitude: data.latitude || lat,
        longitude: data.longitude || lng,
      };
    } catch (error) {
      console.error('[GeolocationService] reverseGeocode error:', error);
      return null;
    }
  }

  async ipLookup(ip: string): Promise<IpLookupResult | null> {
    const url = new URL(`${this.baseUrl}/ip-geolocation`);
    url.searchParams.set('ip', ip);
    if (this.apiKey) url.searchParams.set('key', this.apiKey);

    try {
      const response = await this.fetchWithRetry(url.toString());
      if (!response.ok) return null;

      const data = await response.json();

      const latResult = data.location?.latitude || 0;
      const lngResult = data.location?.longitude || 0;
      const cityName = data.location?.city || data.locality || '';

      // If we get 0,0 and no city, it's a failure to pinpoint (Null Island)
      if (latResult === 0 && lngResult === 0 && !cityName) {
        return null;
      }

      return {
        latitude: latResult,
        longitude: lngResult,
        city: cityName,
        country: data.country?.name || '',
        countryCode: data.country?.code || '',
        state: data.location?.principalSubdivision || '',
        ip: data.ip || ip,
      };
    } catch (error) {
      console.error('[GeolocationService] ipLookup error:', error);
      return null;
    }
  }
}

export const geolocationService = new GeolocationService();
