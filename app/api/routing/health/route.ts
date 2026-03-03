import { NextRequest, NextResponse } from 'next/server';
import { getRoutingHealth } from '@/lib/routing';

export async function GET(_req: NextRequest) {
  const health = getRoutingHealth();
  return NextResponse.json({ status: 'ok', routing: health });
}
