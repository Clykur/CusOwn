import { NextRequest, NextResponse } from 'next/server';
import { NominatimService } from '@/lib/geocoding';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { address } = body;

    if (typeof address !== 'string' || address.trim() === '') {
      return NextResponse.json({ error: 'Invalid address' }, { status: 400 });
    }

    const ip = req.headers.get('x-forwarded-for') || undefined;
    const service = NominatimService.getInstance();
    const result = await service.forwardGeocode(address, ip as string | undefined);

    if (!result) {
      return NextResponse.json({ error: 'Geocoding failed or rate limited' }, { status: 502 });
    }

    return NextResponse.json(result);
  } catch (err) {
    console.error('forward geocode error', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
