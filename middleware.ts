import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { applySecurityHeaders } from '@/lib/security/security-headers';

export async function middleware(request: NextRequest) {
  let response: NextResponse;

  // DO NOT call securityMiddleware here anymore

  const cookie = request.headers.get('cookie');
  const requestHeaders = new Headers(request.headers);
  if (cookie) requestHeaders.set('x-middleware-cookie', cookie);

  response = NextResponse.next({
    request: { headers: requestHeaders },
  });

  applySecurityHeaders(response);
  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:ico|png|jpg|jpeg|gif|webp|svg|woff2?)$).*)',
  ],
};
