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

  // Fire-and-forget: do not block response on metrics (avoids extra latency per request)
  if (request.nextUrl.pathname.startsWith('/api/')) {
    void performanceMonitor.recordAPITiming(request.nextUrl.pathname, duration);
    void metricsService.increment(`api.${request.nextUrl.pathname}.requests`);
    void metricsService.increment('api.requests.total');
  }

  return response;
}

export const config = {
  matcher: '/api/:path*',
};

