import { NextRequest, NextResponse } from 'next/server';

/**
 * Back-compat route.
 * We keep `/auth/callback/process` in the allow-list, but the canonical handler
 * is now `/auth/callback` (server-side) using `@supabase/ssr`.
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const redirect = new URL('/auth/callback', url.origin);
  redirect.search = url.search; // keep code/role/redirect_to/etc.
  return NextResponse.redirect(redirect);
}
