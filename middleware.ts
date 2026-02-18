import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { securityMiddleware } from '@/lib/security/security-middleware';
import { metricsService } from '@/lib/monitoring/metrics';
import { performanceMonitor } from '@/lib/monitoring/performance';
import { SLOW_REQUEST_MS } from '@/config/constants';

export async function middleware(request: NextRequest) {
  const startTime = Date.now();

  const securityResponse = await securityMiddleware(request);
  if (securityResponse) {
    return securityResponse;
  }

  const response = NextResponse.next();
  const duration = Date.now() - startTime;

  if (request.nextUrl.pathname.startsWith('/api/')) {
    void performanceMonitor.recordAPITiming(request.nextUrl.pathname, duration);
    void metricsService.increment(`api.${request.nextUrl.pathname}.requests`);
    void metricsService.increment('api.requests.total');
    if (duration > SLOW_REQUEST_MS) {
      const query = request.nextUrl.searchParams.toString();
      void performanceMonitor.recordSlowRequest(request.nextUrl.pathname, duration, {
        route: request.nextUrl.pathname,
        query: query ? query.slice(0, 200) : undefined,
      });
    }
  }

  return response;
}

export const config = {
  matcher: '/api/:path*',
};
