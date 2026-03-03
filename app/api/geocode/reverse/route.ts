import { NextRequest, NextResponse } from 'next/server';
import { NominatimService } from '@/lib/geocoding';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { lat, lng } = body;

    const latNum = parseFloat(lat);
    const lngNum = parseFloat(lng);
    if (Number.isNaN(latNum) || Number.isNaN(lngNum)) {
      return NextResponse.json({ error: 'Invalid coordinates' }, { status: 400 });
    }
    if (latNum < -90 || latNum > 90 || lngNum < -180 || lngNum > 180) {
      return NextResponse.json({ error: 'Coordinates out of range' }, { status: 400 });
    }

    const ip = req.headers.get('x-forwarded-for') || undefined;
    const service = NominatimService.getInstance();
    const result = await service.reverseGeocode(latNum, lngNum, ip as string | undefined);

    if (!result) {
      return NextResponse.json({ error: 'Geocoding failed or rate limited' }, { status: 502 });
    }

    return NextResponse.json(result);
  } catch (err) {
    console.error('reverse geocode error', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
