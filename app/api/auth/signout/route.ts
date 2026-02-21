/**
 * Server-only auth: sign out. Clears session server-side and redirects to login.
 * Frontend links or navigates here; no client-side Supabase auth.
 */

import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server-auth';
import { ROUTES } from '@/lib/utils/navigation';
import { env } from '@/config/env';

export async function GET() {
  const supabase = await createServerClient();
  const { error } = await supabase.auth.signOut();
  if (error) {
    console.log('[AUTH] signout GET: negative', { error: error.message });
  } else {
    console.log('[AUTH] signout GET: positive — session cleared, redirect to login');
  }
  const loginPath = typeof ROUTES.AUTH_LOGIN === 'function' ? ROUTES.AUTH_LOGIN() : '/auth/login';
  return NextResponse.redirect(new URL(loginPath, env.app.baseUrl));
}

export async function POST() {
  const supabase = await createServerClient();
  const { error } = await supabase.auth.signOut();
  if (error) {
    console.log('[AUTH] signout POST: negative', { error: error.message });
  } else {
    console.log('[AUTH] signout POST: positive — session cleared');
  }
  return NextResponse.json({ success: true });
}
