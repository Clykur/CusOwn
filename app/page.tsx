'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import { ROUTES } from '@/lib/utils/navigation';
import { PublicHeader } from '@/components/layout/public-header';
import { SplashScreen } from '@/components/ui/splash-screen';
import ArrowRightIcon from '@/src/icons/arrow-right.svg';
import ExploreIcon from '@/src/icons/explore.svg';
import CheckIcon from '@/src/icons/check.svg';
import BusinessesIcon from '@/src/icons/businesses.svg';
import ProfileIcon from '@/src/icons/profile.svg';
import BookingsIcon from '@/src/icons/bookings.svg';
import DashboardIcon from '@/src/icons/dashboard.svg';
import CreateBusinessIcon from '@/src/icons/create-business.svg';

function getUserRoleCookie(): string | null {
  if (typeof document === 'undefined') return null;
  const m = document.cookie.match(/(?:^|;\s*)cusown_user_role=([^;]*)/);
  return m ? decodeURIComponent(m[1]) : null;
}

function getDashboardForRole(role: string): string {
  switch (role) {
    case 'admin':
      return '/admin/dashboard';
    case 'owner':
      return '/owner/dashboard';
    default:
      return '/customer/dashboard';
  }
}

export default function Home() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [shouldRenderSplash, setShouldRenderSplash] = useState(false);
  useEffect(() => {
    const role = getUserRoleCookie();

    if (role) {
      router.replace(getDashboardForRole(role));
      return;
    }

    // ✅ Only allow splash if user is NOT redirected
    setShouldRenderSplash(true);

    const handlePageShow = (e: PageTransitionEvent) => {
      if (e.persisted) {
        const r = getUserRoleCookie();
        if (r) window.location.replace(getDashboardForRole(r));
      }
    };

    window.addEventListener('pageshow', handlePageShow);
    return () => window.removeEventListener('pageshow', handlePageShow);
  }, [router]);

  useEffect(() => {
    const role = getUserRoleCookie();
    if (role) {
      router.replace(getDashboardForRole(role));
      return;
    }
    const handlePageShow = (e: PageTransitionEvent) => {
      if (e.persisted) {
        const r = getUserRoleCookie();
        if (r) window.location.replace(getDashboardForRole(r));
      }
    };
    window.addEventListener('pageshow', handlePageShow);
    return () => window.removeEventListener('pageshow', handlePageShow);
  }, [router]);

  useEffect(() => {
    const error = searchParams?.get('error');
    const errorCode = searchParams?.get('error_code');
    const errorDesc = searchParams?.get('error_description');
    if (error || errorCode === 'bad_oauth_state' || errorDesc) {
      const msg = errorDesc || error || 'Sign-in was cancelled or expired. Please try again.';
      router.replace(
        `${typeof ROUTES.AUTH_LOGIN === 'function' ? ROUTES.AUTH_LOGIN() : '/auth/login'}?error=${encodeURIComponent(msg)}`
      );
    }
  }, [router, searchParams]);

  return (
    <div className="min-h-screen bg-white antialiased">
      {shouldRenderSplash && <SplashScreen />}
      <PublicHeader />

      {/* Hero Section */}
      <section className="relative pt-24 pb-32 sm:pt-32 sm:pb-40 overflow-hidden bg-gradient-to-b from-slate-50 to-white">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-gradient-to-br from-slate-100/80 via-transparent to-transparent rounded-full blur-3xl" />

        <div className="relative mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-100 text-sm text-slate-600 mb-8 border border-slate-200/60">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              Now live for salon businesses
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-slate-900 leading-[1.1]">
              The smarter way to
              <span className="relative whitespace-nowrap">
                <span className="relative z-10"> manage</span>
              </span>
              <br />
              <span className="text-slate-400">your appointments</span>
            </h1>

            <p className="mt-6 text-lg sm:text-xl text-slate-600 leading-relaxed max-w-2xl mx-auto">
              A modern booking platform designed for service businesses. Simple for you, seamless
              for your customers.
            </p>

            <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
              <button
                onClick={() => router.push(ROUTES.SELECT_ROLE())}
                className="group inline-flex items-center justify-center gap-2 bg-slate-900 text-white px-8 py-4 text-base font-medium rounded-xl hover:bg-slate-800 transition-all duration-200 w-full sm:w-auto shadow-lg shadow-slate-900/10 hover:shadow-xl hover:shadow-slate-900/20"
              >
                Get started free
                <ArrowRightIcon className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
              </button>
              <button
                onClick={() => router.push(ROUTES.SELECT_ROLE('customer'))}
                className="group inline-flex items-center justify-center gap-2 bg-white text-slate-700 px-8 py-4 text-base font-medium rounded-xl border border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition-all duration-200 w-full sm:w-auto"
              >
                Browse businesses
                <ExploreIcon className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
              </button>
            </div>

            <div className="mt-12 flex items-center justify-center gap-8 text-sm text-slate-500">
              <div className="flex items-center gap-2">
                <CheckIcon className="w-4 h-4 text-emerald-500" />
                <span>Free to start</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckIcon className="w-4 h-4 text-emerald-500" />
                <span>No credit card</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckIcon className="w-4 h-4 text-emerald-500" />
                <span>Setup in 5 min</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Social Proof Bar */}
      <section className="border-y border-slate-100 bg-slate-50/50 py-8">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row items-center justify-center gap-6 sm:gap-12 text-center">
            <div>
              <div className="text-2xl font-bold text-slate-900">500+</div>
              <div className="text-sm text-slate-500">Appointments booked</div>
            </div>
            <div className="hidden sm:block w-px h-10 bg-slate-200" />
            <div>
              <div className="text-2xl font-bold text-slate-900">50+</div>
              <div className="text-sm text-slate-500">Active businesses</div>
            </div>
            <div className="hidden sm:block w-px h-10 bg-slate-200" />
            <div>
              <div className="text-2xl font-bold text-slate-900">4.9/5</div>
              <div className="text-sm text-slate-500">Customer rating</div>
            </div>
          </div>
        </div>
      </section>

      {/* Two Sides Section */}
      <section className="py-24 sm:py-32">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900">
              Built for everyone
            </h2>
            <p className="mt-4 text-lg text-slate-600 max-w-2xl mx-auto">
              Whether you run a business or need to book an appointment, we&apos;ve got you covered.
            </p>
          </div>

          <div className="grid lg:grid-cols-2 gap-8 max-w-5xl mx-auto">
            {/* Business Owner Card */}
            <div className="group relative bg-white rounded-2xl p-8 lg:p-10 border border-slate-200 hover:border-slate-300 transition-all duration-300 hover:shadow-xl hover:shadow-slate-200/50">
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-slate-100 to-transparent rounded-tr-2xl opacity-50" />

              <div className="relative">
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-xl bg-slate-900 text-white mb-6">
                  <BusinessesIcon className="w-7 h-7" />
                </div>

                <h3 className="text-2xl font-bold text-slate-900 mb-4">For business owners</h3>
                <p className="text-slate-600 mb-6 leading-relaxed">
                  Create your booking page in minutes. Let customers book online while you focus on
                  what matters running your business.
                </p>

                <ul className="space-y-3 mb-8">
                  {[
                    'Online booking page with your branding',
                    'Automated WhatsApp confirmations',
                    'Real-time availability management',
                    'Customer insights dashboard',
                  ].map((item, i) => (
                    <li key={i} className="flex items-start gap-3 text-sm text-slate-600">
                      <CheckIcon className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => router.push(ROUTES.SELECT_ROLE('owner'))}
                  className="w-full inline-flex items-center justify-center gap-2 bg-slate-900 text-white px-6 py-3.5 text-sm font-medium rounded-xl hover:bg-slate-800 transition-colors"
                >
                  <CreateBusinessIcon className="w-4 h-4" />
                  Create your business page
                </button>
              </div>
            </div>

            {/* Customer Card */}
            <div className="group relative bg-white rounded-2xl p-8 lg:p-10 border border-slate-200 hover:border-slate-300 transition-all duration-300 hover:shadow-xl hover:shadow-slate-200/50">
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-slate-100 to-transparent rounded-tr-2xl opacity-50" />

              <div className="relative">
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-xl bg-slate-100 text-slate-900 mb-6">
                  <ProfileIcon className="w-7 h-7" />
                </div>

                <h3 className="text-2xl font-bold text-slate-900 mb-4">For customers</h3>
                <p className="text-slate-600 mb-6 leading-relaxed">
                  Find and book appointments in seconds. No phone calls, no waiting just pick a time
                  that works for you.
                </p>

                <ul className="space-y-3 mb-8">
                  {[
                    'Browse available time slots instantly',
                    'Book without creating an account',
                    'Get instant WhatsApp confirmation',
                    'View and manage your bookings',
                  ].map((item, i) => (
                    <li key={i} className="flex items-start gap-3 text-sm text-slate-600">
                      <CheckIcon className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => router.push(ROUTES.SELECT_ROLE('customer'))}
                  className="w-full inline-flex items-center justify-center gap-2 bg-white text-slate-900 px-6 py-3.5 text-sm font-medium rounded-xl border border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition-colors"
                >
                  <BookingsIcon className="w-4 h-4" />
                  Book an appointment
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Industries Section */}
      <section className="py-24 sm:py-32 bg-slate-50">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900">
              Designed for service businesses
            </h2>
            <p className="mt-4 text-lg text-slate-600">
              Starting with salons, expanding to more industries soon
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 max-w-4xl mx-auto">
            <div className="relative bg-slate-900 text-white rounded-2xl p-6 text-center">
              <div className="absolute inset-0 bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl" />
              <div className="relative">
                <div className="flex justify-center mb-4">
                  <Image
                    src="/icons/categories/salon.png"
                    alt="Salon"
                    width={40}
                    height={40}
                    className="object-contain brightness-0 invert"
                  />
                </div>
                <h3 className="font-semibold text-sm">Salons</h3>
                <span className="inline-flex items-center gap-1 mt-2 text-xs text-emerald-400">
                  <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full" />
                  Live now
                </span>
              </div>
            </div>

            {[
              { name: 'Clinics', icon: '/icons/categories/clinic.png' },
              { name: 'Fitness', icon: '/icons/categories/fitness.png' },
              { name: 'Consultants', icon: '/icons/categories/consultant.png' },
              { name: 'Home Services', icon: '/icons/categories/home-services.png' },
            ].map((cat) => (
              <div
                key={cat.name}
                className="bg-white rounded-2xl p-6 text-center border border-slate-200 border-dashed"
              >
                <div className="flex justify-center mb-4 opacity-40">
                  <Image
                    src={cat.icon}
                    alt={cat.name}
                    width={40}
                    height={40}
                    className="object-contain grayscale"
                  />
                </div>
                <h3 className="font-semibold text-sm text-slate-400">{cat.name}</h3>
                <span className="text-xs text-slate-400 mt-2 block">Coming soon</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-24 sm:py-32">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900">
              Everything you need
            </h2>
            <p className="mt-4 text-lg text-slate-600 max-w-2xl mx-auto">
              Powerful features wrapped in simplicity
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {[
              {
                title: 'Online Booking',
                description:
                  'Customers view and book available slots in real-time. No back-and-forth calls.',
                icon: <BookingsIcon className="w-5 h-5" />,
              },
              {
                title: 'WhatsApp Notifications',
                description:
                  'Instant booking confirmations and reminders sent directly via WhatsApp.',
                icon: (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                    />
                  </svg>
                ),
              },
              {
                title: 'QR Code Links',
                description:
                  'Generate QR codes for your booking page. Perfect for in-store display.',
                icon: (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z"
                    />
                  </svg>
                ),
              },
              {
                title: 'Business Dashboard',
                description:
                  'Track all bookings, manage availability, and view business insights in one place.',
                icon: <DashboardIcon className="w-5 h-5" />,
              },
              {
                title: 'Mobile Ready',
                description:
                  'Fully responsive design. Manage bookings from your phone or any device.',
                icon: (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"
                    />
                  </svg>
                ),
              },
              {
                title: 'Secure & Reliable',
                description:
                  'Enterprise-grade security with role-based access. Your data is always protected.',
                icon: (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                    />
                  </svg>
                ),
              },
            ].map((feature, i) => (
              <div
                key={i}
                className="group bg-white rounded-xl p-6 border border-slate-200 hover:border-slate-300 hover:shadow-lg hover:shadow-slate-100 transition-all duration-300"
              >
                <div className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-slate-100 text-slate-900 mb-4 group-hover:bg-slate-900 group-hover:text-white transition-colors duration-300">
                  {feature.icon}
                </div>
                <h3 className="text-lg font-semibold text-slate-900 mb-2">{feature.title}</h3>
                <p className="text-sm text-slate-600 leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-24 sm:py-32 bg-white">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="text-center mb-20">
            <span className="inline-block px-4 py-1.5 mb-4 text-xs font-semibold tracking-wider text-slate-600 uppercase bg-slate-100 rounded-full">
              Simple Process
            </span>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-slate-900">
              How it works
            </h2>
            <p className="mt-5 text-lg text-slate-600 max-w-2xl mx-auto">
              Get your booking system running in minutes, not days
            </p>
          </div>

          <div className="max-w-5xl mx-auto">
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
              {[
                {
                  step: '1',
                  title: 'Create your page',
                  description: 'Set up your business profile and configure your availability.',
                },
                {
                  step: '2',
                  title: 'Share your link',
                  description: 'Get a unique booking link and QR code for your customers.',
                },
                {
                  step: '3',
                  title: 'Customers book',
                  description: 'Customers browse slots and book instantly, no account needed.',
                },
                {
                  step: '4',
                  title: 'Manage & confirm',
                  description: 'Review bookings and let the platform handle confirmations.',
                },
              ].map((item, i) => (
                <div key={i} className="text-center">
                  {/* Step number */}
                  <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-slate-900 text-white text-xl font-semibold mb-5">
                    {item.step}
                  </div>

                  {/* Content */}
                  <h3 className="text-lg font-semibold text-slate-900 mb-3">{item.title}</h3>
                  <p className="text-sm text-slate-600 leading-relaxed">{item.description}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="relative py-24 sm:py-32 bg-slate-900 overflow-hidden">
        <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-slate-800 rounded-full blur-3xl opacity-40" />
        <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] bg-slate-800 rounded-full blur-3xl opacity-30" />

        <div className="relative mx-auto max-w-3xl px-6 lg:px-8 text-center">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-white mb-6">
            Ready to simplify your bookings?
          </h2>
          <p className="text-lg text-slate-400 mb-10 max-w-xl mx-auto">
            Join businesses already using CusOwn to manage appointments effortlessly.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={() => router.push(ROUTES.SELECT_ROLE('owner'))}
              className="inline-flex items-center justify-center gap-2 bg-white text-slate-900 px-8 py-4 text-base font-medium rounded-xl hover:bg-slate-100 transition-colors w-full sm:w-auto"
            >
              <CreateBusinessIcon className="w-5 h-5" />
              Start your business page
            </button>
            <button
              onClick={() => router.push(ROUTES.SELECT_ROLE('customer'))}
              className="inline-flex items-center justify-center gap-2 bg-transparent text-white px-8 py-4 text-base font-medium rounded-xl border border-slate-700 hover:bg-slate-800 transition-colors w-full sm:w-auto"
            >
              <BookingsIcon className="w-5 h-5" />
              Book an appointment
            </button>
          </div>

          <div className="mt-10 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-sm text-slate-400">
            <div className="flex items-center gap-2">
              <CheckIcon className="w-4 h-4 text-emerald-500" />
              No credit card required
            </div>
            <div className="flex items-center gap-2">
              <CheckIcon className="w-4 h-4 text-emerald-500" />
              Free forever for small teams
            </div>
            <div className="flex items-center gap-2">
              <CheckIcon className="w-4 h-4 text-emerald-500" />
              Works on any device
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-8">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row items-center sm:items-center justify-between gap-6">
            {/* Clykur Branding - Left */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-500">A</span>
              <Image
                src="/icons/Clykur Logo.svg"
                alt="Clykur"
                width={120}
                height={120}
                className="w-16 h-16"
              />
              <span className="text-sm text-slate-500">Product</span>
            </div>

            {/* Copyright - Right */}
            <div className="text-sm text-slate-500">
              &copy; {new Date().getFullYear()} CusOwn. All rights reserved.
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
