'use client';

import { Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { UI_CONTEXT } from '@/config/constants';
import { ROUTES } from '@/lib/utils/navigation';
import { PublicHeader } from '@/components/layout/public-header';
import BusinessesIcon from '@/src/icons/businesses.svg';
import ProfileIcon from '@/src/icons/profile.svg';

/** Build server auth URL: frontend only navigates; auth is done server-side via /api/auth/login. */
function buildLoginUrl(redirectTo: string, role: 'owner' | 'customer' | null): string {
  const params = new URLSearchParams();
  if (redirectTo && redirectTo !== '/') params.set('redirect_to', redirectTo);
  if (role) params.set('role', role);
  const q = params.toString();
  return `/api/auth/login${q ? `?${q}` : ''}`;
}

function GoogleMark({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="currentColor"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="currentColor"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="currentColor"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const error = searchParams?.get('error');

  const redirectTo = searchParams?.get('redirect_to') || '/';
  const role = (searchParams?.get('role') as 'owner' | 'customer' | null) ?? null;
  const loginUrl = buildLoginUrl(redirectTo, role);

  const getRoleContext = () => {
    if (role === 'owner') {
      return {
        title: UI_CONTEXT.AUTH_LOGIN_HEADING_OWNER,
        description: UI_CONTEXT.AUTH_LOGIN_DESC_OWNER,
        icon: <BusinessesIcon className="h-10 w-10 text-slate-700" aria-hidden="true" />,
      };
    }
    if (role === 'customer') {
      return {
        title: UI_CONTEXT.AUTH_LOGIN_HEADING_CUSTOMER,
        description: UI_CONTEXT.AUTH_LOGIN_DESC_CUSTOMER,
        icon: <ProfileIcon className="h-10 w-10 text-slate-700" aria-hidden="true" />,
      };
    }
    return {
      title: UI_CONTEXT.AUTH_LOGIN_HEADING_DEFAULT,
      description: UI_CONTEXT.AUTH_LOGIN_DESC_DEFAULT,
      icon: null,
    };
  };

  const context = getRoleContext();

  return (
    <div className="flex min-h-[100dvh] flex-col bg-gradient-to-b from-slate-100/95 via-white to-slate-50/90">
      <PublicHeader />
      <main className="flex flex-1 flex-col px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-2 sm:px-6 sm:pb-10 sm:pt-6">
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center sm:justify-center sm:py-6">
          <div className="relative overflow-hidden rounded-[1.35rem] border border-slate-200/90 bg-white/95 p-6 shadow-[0_24px_64px_-20px_rgba(15,23,42,0.14)] ring-1 ring-slate-900/[0.035] backdrop-blur-sm sm:p-9">
            <div
              className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-slate-300/70 to-transparent"
              aria-hidden="true"
            />

            <div className="text-center">
              {context.icon && (
                <div className="mb-6 flex justify-center">
                  <div className="rounded-2xl bg-gradient-to-br from-slate-50 to-slate-100/90 p-4 ring-1 ring-slate-200/70 shadow-inner">
                    {context.icon}
                  </div>
                </div>
              )}
              <h1 className="text-balance text-2xl font-semibold tracking-tight text-slate-900 sm:text-[1.65rem] sm:leading-snug">
                {context.title}
              </h1>
              <p className="mx-auto mt-2 max-w-sm text-pretty text-sm leading-relaxed text-slate-600 sm:text-[15px]">
                {context.description}
              </p>
            </div>

            {error && (
              <div
                className="mt-6 rounded-xl border border-rose-200/90 bg-rose-50/95 px-4 py-3 text-left text-sm leading-relaxed text-rose-900 shadow-sm"
                role="alert"
              >
                {decodeURIComponent(error)}
              </div>
            )}

            <div className="mt-8">
              <a
                href={loginUrl}
                className="group relative flex min-h-[52px] w-full touch-manipulation items-center justify-center gap-3 rounded-xl border border-slate-200/95 bg-white px-5 py-3.5 text-[15px] font-semibold text-slate-800 shadow-sm transition hover:border-slate-300 hover:bg-slate-50/90 hover:shadow-md active:scale-[0.99] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
              >
                <GoogleMark className="h-5 w-5 shrink-0 text-slate-700 transition group-hover:text-slate-900" />
                {UI_CONTEXT.AUTH_LOGIN_CTA_GOOGLE}
              </a>
            </div>

            <p className="mt-8 text-center text-xs leading-relaxed text-slate-500">
              {UI_CONTEXT.AUTH_LOGIN_TERMS_NOTICE}
            </p>

            <button
              type="button"
              onClick={() => router.push(ROUTES.HOME)}
              className="mt-5 w-full touch-manipulation rounded-xl py-3 text-sm font-medium text-slate-600 transition hover:bg-slate-100/80 hover:text-slate-900 active:bg-slate-100"
            >
              {UI_CONTEXT.AUTH_LOGIN_BACK_HOME}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[100dvh] flex-col bg-gradient-to-b from-slate-100/95 via-white to-slate-50/90">
          <PublicHeader />
          <div className="flex flex-1 items-center justify-center px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
            <div className="h-10 w-10 animate-spin rounded-full border-2 border-slate-200 border-t-slate-700" />
          </div>
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  );
}
