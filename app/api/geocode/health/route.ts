import { NextRequest, NextResponse } from 'next/server';
import { NominatimService } from '@/lib/geocoding';

export async function GET(_req: NextRequest) {
  const service = NominatimService.getInstance();
  const cacheSize = service['cache'] ? (service as any).cache.size : 0;
  return NextResponse.json({
    status: 'ok',
    cacheSize,
  });
}
