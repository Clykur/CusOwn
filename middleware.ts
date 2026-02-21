import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { securityMiddleware } from '@/lib/security/security-middleware';
import { applySecurityHeaders } from '@/lib/security/security-headers';

export async function middleware(request: NextRequest) {
  if (process.env.NODE_ENV === 'development') {
    const host = request.headers.get('host') ?? '';
    const isRsc = request.headers.get('RSC') === '1';
    const isPrefetch = request.headers.get('Next-Router-Prefetch') === '1';
    const purpose = isRsc ? (isPrefetch ? 'prefetch' : 'rsc') : 'navigation';
    const pathname = request.nextUrl.pathname;
    console.log(`[middleware] ${pathname} ${purpose} host=${host}`);
    const isProtected =
      pathname.startsWith('/admin') ||
      pathname.startsWith('/owner') ||
      pathname.startsWith('/customer') ||
      pathname.startsWith('/setup') ||
      pathname.startsWith('/profile');
    if (isProtected && purpose === 'navigation') {
      const cookieHeader = request.headers.get('cookie') ?? '';
      const hasCookies = cookieHeader.length > 0;
      const hasSupabaseAuth = cookieHeader.includes('sb-');
      console.log('[AUTH] protected route request', {
        pathname,
        hasCookieHeader: hasCookies,
        hasSupabaseAuthCookie: hasSupabaseAuth,
        cookieLength: cookieHeader.length,
      });
    }
    if (host === 'localhost' && !pathname.startsWith('/_next')) {
      console.log('[middleware] Dev server runs on port 3000. Use http://localhost:3000');
    }
  }

  let response: NextResponse;

  if (request.nextUrl.pathname.startsWith('/api/')) {
    const apiResponse = await securityMiddleware(request);
    response = apiResponse ?? NextResponse.next();
  } else {
    // Forward Cookie to request headers so layouts/RSC see it (Next.js may not pass Cookie to server components).
    const cookie = request.headers.get('cookie');
    const requestHeaders = new Headers(request.headers);
    if (cookie) requestHeaders.set('x-middleware-cookie', cookie);
    response = NextResponse.next({ request: { headers: requestHeaders } });
  }

  applySecurityHeaders(response);
  return response;
}

export const config = {
  matcher: [
    '/api/:path*',
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:ico|png|jpg|jpeg|gif|webp|svg|woff2?)$).*)',
  ],
};
