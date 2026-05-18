import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { env } from '@cusown/config';
import { getUserState } from '@cusown/shared/server';

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(env.supabase.url, env.supabase.anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({
          request,
        });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const url = request.nextUrl.clone();
  console.log('[PROXY] Path:', url.pathname, { hasUser: !!user });

  // 1. Host Canonicalization
  const host = request.headers.get('host');
  const appHost = new URL(env.app.baseUrl).host;

  if (host && host !== appHost && env.nodeEnv === 'production') {
    return NextResponse.redirect(env.app.baseUrl + url.pathname + url.search);
  }

  // 2. Redirect / to role-based dashboard if authenticated
  if (url.pathname === '/' || url.pathname === '/home') {
    if (user) {
      const state = await getUserState(user.id);
      const target = state.redirectUrl || '/customer/dashboard';
      console.log(`[PROXY] Redirecting to ${target} (authenticated)`);
      return NextResponse.redirect(new URL(target, env.app.baseUrl));
    } else {
      console.log('[PROXY] Redirecting to marketing (unauthenticated)');
      return NextResponse.redirect(env.app.marketingUrl);
    }
  }

  // 3. Catch hardcoded /dashboard 404s
  if (url.pathname === '/dashboard' || url.pathname === '/dashboard/') {
    if (user) {
      const state = await getUserState(user.id);
      const target = state.redirectUrl || '/customer/dashboard';
      console.log(`[PROXY] Catching /dashboard 404 -> Redirecting to ${target}`);
      return NextResponse.redirect(new URL(target, env.app.baseUrl));
    }
  }

  // 3. Protect private routes
  const privatePrefixes = [
    '/dashboard',
    '/admin',
    '/customer',
    '/owner',
    '/profile',
    '/onboarding',
    '/setup',
  ];
  // Keep select-role public so the onboarding entrypoint always resolves.
  const isPrivate = privatePrefixes.some((prefix) => url.pathname.startsWith(prefix));

  // Allow public access to business profile and booking page
  // Business profile: /customer/[slug]
  // Booking page: /customer/book/[id]
  const isPublicCustomerRoute =
    (url.pathname.startsWith('/customer/') &&
      !url.pathname.startsWith('/customer/dashboard') &&
      !url.pathname.startsWith('/customer/bookings')) ||
    url.pathname.startsWith('/customer/book/');

  if (isPrivate && !user && !isPublicCustomerRoute) {
    console.log('[PROXY] Redirecting to /auth/login (private route + unauthenticated)');
    const loginUrl = new URL('/auth/login', request.url);
    loginUrl.searchParams.set('redirect_to', url.pathname);
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * Feel free to modify this pattern to include more paths.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
