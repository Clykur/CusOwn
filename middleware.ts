import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { securityMiddleware } from '@/lib/security/security-middleware';
import { metricsService } from '@/lib/monitoring/metrics';
import { performanceMonitor } from '@/lib/monitoring/performance';

export async function middleware(request: NextRequest) {
  const startTime = Date.now();

  const securityResponse = await securityMiddleware(request);
  if (securityResponse) {
    return securityResponse;
  }

  const response = NextResponse.next();
  const duration = Date.now() - startTime;

  if (request.nextUrl.pathname.startsWith('/api/')) {
    await performanceMonitor.recordAPITiming(request.nextUrl.pathname, duration);
    await metricsService.increment(`api.${request.nextUrl.pathname}.requests`);
    await metricsService.increment('api.requests.total');
  }

  return response;
}

export const config = {
  matcher: '/api/:path*',
};

