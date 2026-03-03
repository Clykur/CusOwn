/**
 * Self-hosted Nominatim geocoding service wrapper.
 * Provides forward and reverse geocoding with caching and basic rate limiting.
 *
 * Base URL comes from config (env.geo.nominatimUrl or GEO_NOMINATIM_DEFAULT_BASE).
 * If empty, requests will fail.
 *
 * Caching is done in-memory with TTL.  Rate limiting is a simple per-IP token
 * bucket reset every minute.  In production you may want to replace both with
 * Redis or another persistent store.
 */

import { env } from '@/config/env';
import { GEO_NOMINATIM_DEFAULT_BASE } from '@/config/constants';

interface GeocodeResult {
  lat: number;
  lng: number;
  display_name: string;
  source?: string;
  timestamp?: number;
}

export class NominatimService {
  private static instance: NominatimService | null = null;

  private cache: Map<string, GeocodeResult>;
  private cacheTtlMs: number = 24 * 60 * 60 * 1000; // 24 hours

  // simple rate limiter: track requests per IP
  private rateLimitMap: Map<string, { count: number; windowStart: number }>;
  private rateLimitMax: number = 100; // requests per window
  private rateLimitWindowMs: number = 60 * 1000; // 1 minute

  private baseUrl: string;

  private constructor() {
    this.cache = new Map();
    this.rateLimitMap = new Map();
    this.baseUrl = env.geo.nominatimUrl || GEO_NOMINATIM_DEFAULT_BASE;
  }

  static getInstance(): NominatimService {
    if (!NominatimService.instance) {
      NominatimService.instance = new NominatimService();
    }
    return NominatimService.instance;
  }

  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Forward geocode an address string.
   * Optionally pass ip for rate limiting.
   */
  async forwardGeocode(address: string, ip?: string): Promise<GeocodeResult | null> {
    const key = `fwd:${address}`;
    const cached = this.getFromCache(key);
    if (cached) return cached;

    if (!this.allowRequest(ip)) return null;

    const url = `${this.baseUrl}/search?format=json&q=${encodeURIComponent(address)}`;
    try {
      const resp = await fetch(url);
      if (!resp.ok) return null;
      const arr: any = await resp.json();
      if (!Array.isArray(arr) || arr.length === 0) return null;
      const first = arr[0];
      const result: GeocodeResult = {
        lat: parseFloat(first.lat),
        lng: parseFloat(first.lon),
        display_name: first.display_name,
        source: this.baseUrl,
        timestamp: Date.now(),
      };
      this.setInCache(key, result);
      return result;
    } catch (err) {
      console.error('Nominatim forward error', err);
      return null;
    }
  }

  /**
   * Reverse geocode coordinates.
   */
  async reverseGeocode(lat: number, lng: number, ip?: string): Promise<GeocodeResult | null> {
    const key = `rev:${lat},${lng}`;
    const cached = this.getFromCache(key);
    if (cached) return cached;

    if (!this.allowRequest(ip)) return null;

    const url = `${this.baseUrl}/reverse?format=json&lat=${lat}&lon=${lng}`;
    try {
      const resp = await fetch(url);
      if (!resp.ok) return null;
      const obj: any = await resp.json();
      if (!obj || !obj.display_name) return null;
      const result: GeocodeResult = {
        lat,
        lng,
        display_name: obj.display_name,
        source: this.baseUrl,
        timestamp: Date.now(),
      };
      this.setInCache(key, result);
      return result;
    } catch (err) {
      console.error('Nominatim reverse error', err);
      return null;
    }
  }

  private getFromCache(key: string): GeocodeResult | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() - (entry.timestamp || 0) > this.cacheTtlMs) {
      this.cache.delete(key);
      return null;
    }
    return entry;
  }

  private setInCache(key: string, result: GeocodeResult): void {
    this.cache.set(key, { ...result, timestamp: Date.now() });
  }

  private allowRequest(ip?: string): boolean {
    if (!ip) return true; // no-ip means unlimited
    const now = Date.now();
    const entry = this.rateLimitMap.get(ip);
    if (!entry) {
      this.rateLimitMap.set(ip, { count: 1, windowStart: now });
      return true;
    }
    if (now - entry.windowStart > this.rateLimitWindowMs) {
      entry.count = 1;
      entry.windowStart = now;
      return true;
    }
    if (entry.count < this.rateLimitMax) {
      entry.count++;
      return true;
    }
    return false;
  }
}
