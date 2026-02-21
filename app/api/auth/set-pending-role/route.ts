/**
 * Set pending role cookie before OAuth redirect. Used by login page when ?role= is present.
 * Cookie is read and cleared in /auth/callback only. Prevents role in URL and ensures single use.
 */

import { NextRequest, NextResponse } from 'next/server';
import { AUTH_PENDING_ROLE_COOKIE, AUTH_PENDING_ROLE_MAX_AGE_SECONDS } from '@/config/constants';

const ALLOWED_ROLES = ['owner', 'customer'];

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const role = typeof body?.role === 'string' ? body.role.toLowerCase() : null;
    if (!role || !ALLOWED_ROLES.includes(role)) {
      return NextResponse.json({ success: false, error: 'Invalid role' }, { status: 400 });
    }

    const res = NextResponse.json({ success: true });
    res.cookies.set(AUTH_PENDING_ROLE_COOKIE, role, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: AUTH_PENDING_ROLE_MAX_AGE_SECONDS,
      path: '/',
    });
    return res;
  } catch {
    return NextResponse.json({ success: false, error: 'Bad request' }, { status: 400 });
  }
}
