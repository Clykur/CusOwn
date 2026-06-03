'use client';

import { Suspense } from 'react';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { UI_CONTEXT } from '@cusown/config';
import { ROUTES } from '@cusown/shared';
import { CusownMarketingNav } from '@/components/marketing/cusown-marketing-nav';
import BusinessesIcon from '@cusown/shared/icons/businesses.svg';
import ProfileIcon from '@cusown/shared/icons/profile.svg';

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
        icon: <BusinessesIcon className="h-10 w-10 text-brand-primary" aria-hidden="true" />,
      };
    }
    if (role === 'customer') {
      return {
        title: UI_CONTEXT.AUTH_LOGIN_HEADING_CUSTOMER,
        description: UI_CONTEXT.AUTH_LOGIN_DESC_CUSTOMER,
        icon: <ProfileIcon className="h-10 w-10 text-brand-primary" aria-hidden="true" />,
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
    <div className="flex min-h-[100dvh] flex-col bg-background-primary">
      <CusownMarketingNav sectionNavMode="external" />
      <div className="flex w-full flex-1 flex-col lg:flex-row">
        {/* Left Side: Form */}
        <div className="flex flex-1 flex-col relative z-10 lg:max-w-2xl xl:max-w-3xl">
          <main className="flex flex-1 flex-col px-6 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-8 sm:px-12 lg:px-16 xl:px-24">
            <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-12 lg:max-w-md items-center">
              <div className="text-center">
                {context.icon && (
                  <div className="mb-8 flex justify-center">
                    <div className="rounded-2xl p-4 ring-1 ring-border-primary shadow-sm">
                      {context.icon}
                    </div>
                  </div>
                )}
                <h1 className="text-balance text-3xl font-bold tracking-tight text-text-primary sm:text-4xl">
                  {context.title}
                </h1>
                <p className="mt-3 text-base leading-relaxed text-text-secondary sm:text-lg">
                  {context.description}
                </p>
              </div>

              {error && (
                <div
                  className="mt-8 w-full rounded-xl border border-state-error/50 bg-state-error/10 px-4 py-3 text-left text-sm leading-relaxed text-state-error shadow-sm"
                  role="alert"
                >
                  {decodeURIComponent(error)}
                </div>
              )}

              <div className="mt-10 w-full">
                <a
                  href={loginUrl}
                  className="group relative flex min-h-[56px] w-full touch-manipulation items-center justify-center gap-3 rounded-xl border border-border-primary bg-surface-input px-5 py-4 text-base font-semibold text-text-primary shadow-sm transition hover:border-brand-primary hover:bg-surface-elevated hover:shadow-md active:scale-[0.99] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary"
                >
                  <GoogleMark className="h-5 w-5 shrink-0 text-text-secondary transition group-hover:text-brand-primary" />
                  {UI_CONTEXT.AUTH_LOGIN_CTA_GOOGLE}
                </a>
              </div>

              <p className="mt-8 w-full text-center text-sm leading-relaxed text-text-secondary">
                {UI_CONTEXT.AUTH_LOGIN_TERMS_NOTICE}
              </p>

              <button
                type="button"
                onClick={() => router.push(ROUTES.HOME)}
                className="mt-6 w-full touch-manipulation rounded-xl py-3 text-sm font-medium text-text-secondary transition hover:bg-surface-elevated hover:text-text-primary active:bg-surface-input"
              >
                {UI_CONTEXT.AUTH_LOGIN_BACK_HOME}
              </button>
            </div>
          </main>
        </div>

        {/* Right Side: Illustration */}
        <div className="hidden lg:block relative flex-1 bg-surface-card overflow-hidden">
          <Image
            src="/login-illustration.png"
            alt="Login Background"
            fill
            className="object-cover opacity-90"
            priority
            unoptimized
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background-primary via-background-primary/20 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-r from-background-primary via-background-primary/5 to-transparent" />
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[100dvh] flex-col bg-background-primary">
          <CusownMarketingNav sectionNavMode="external" />
          <div className="flex flex-1 items-center justify-center px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
            <div className="h-10 w-10 animate-spin rounded-full border-2 border-border-primary border-t-brand-primary" />
          </div>
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  );
}
