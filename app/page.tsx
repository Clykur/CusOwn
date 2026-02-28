'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import { ROUTES } from '@/lib/utils/navigation';
import { PublicHeader } from '@/components/layout/public-header';
import ArrowRightIcon from '@/src/icons/arrow-right.svg';
import ExploreIcon from '@/src/icons/explore.svg';
import CheckIcon from '@/src/icons/check.svg';
import ClockIcon from '@/src/icons/clock.svg';
import BusinessesIcon from '@/src/icons/businesses.svg';
import ProfileIcon from '@/src/icons/profile.svg';
import BookingsIcon from '@/src/icons/bookings.svg';
import DashboardIcon from '@/src/icons/dashboard.svg';
import ChevronRightIcon from '@/src/icons/chevron-right.svg';
import CreateBusinessIcon from '@/src/icons/create-business.svg';

/** Read cusown_user_role cookie. */
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

/**
 * Public landing page. No auth required; zero client session fetch.
 * Redirects to login with error message when OAuth fails and user lands on /?error=...
 * Redirects authenticated users (detected via role cookie) to their dashboard.
 */
export default function Home() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // If user is authenticated (role cookie present), redirect to dashboard.
  // This catches bfcache restores when back-button brings them here.
  useEffect(() => {
    const role = getUserRoleCookie();
    if (role) {
      router.replace(getDashboardForRole(role));
      return;
    }
    // Also handle bfcache page restoration (persisted pages)
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
    <div className="min-h-screen bg-white">
      <PublicHeader />
      {/* Hero Section */}
      <section className="relative bg-gradient-to-b from-gray-50 to-white pt-20 pb-20 sm:pt-28 sm:pb-28 overflow-hidden">
        {/* Background decorative elements */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-gray-100 rounded-full opacity-20 blur-3xl"></div>
          <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-gray-100 rounded-full opacity-20 blur-3xl"></div>
        </div>

        <div className="w-full px-6 sm:px-8 lg:px-16 xl:px-24 2xl:px-32 relative z-10">
          <div className="mx-auto max-w-4xl text-center">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gray-100 border border-gray-200 text-sm text-gray-700 mb-8">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
              <span>Trusted by service businesses</span>
            </div>

            {/* Main Heading */}
            <h1 className="text-5xl font-bold tracking-tight text-gray-900 sm:text-6xl lg:text-7xl leading-tight">
              Effortless bookings for{' '}
              <span className="relative inline-block">
                <span className="relative z-10">modern service</span>
                <span className="absolute bottom-2 left-0 right-0 h-3 bg-yellow-200 opacity-40 -z-0"></span>
              </span>
              <br />
              businesses
            </h1>

            {/* Subheading */}
            <p className="mt-8 text-xl leading-8 text-gray-600 max-w-3xl mx-auto font-light">
              A professional appointment and slot management platform that works for your business
              and your customers.
              <span className="block mt-2 text-gray-500 text-lg">
                Simple, reliable, and designed to grow with you.
              </span>
            </p>

            {/* CTA Buttons */}
            <div className="mt-12 flex flex-col sm:flex-row items-center justify-center gap-4">
              <button
                onClick={() => router.push(ROUTES.SELECT_ROLE())}
                className="group relative bg-black text-white hover:bg-gray-900 px-10 py-5 text-base font-semibold rounded-lg shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:scale-105 w-full sm:w-auto min-w-[200px]"
              >
                <span className="relative z-10 flex items-center justify-center gap-2">
                  Get Started
                  <ArrowRightIcon
                    className="w-5 h-5 group-hover:translate-x-1 transition-transform"
                    aria-hidden="true"
                  />
                </span>
              </button>
              <button
                onClick={() => {
                  const role = getUserRoleCookie();

                  if (!role) {
                    document.cookie =
                      'post_login_redirect=/customer/categories; path=/; max-age=600; SameSite=Lax';

                    router.push('/auth/login');
                    return;
                  }

                  router.push('/customer/categories');
                }}
                className="group border-2 border-gray-300 text-gray-700 hover:border-gray-400 hover:bg-gray-50 px-10 py-5 text-base font-semibold rounded-lg transition-all duration-300 transform hover:scale-105 bg-white w-full sm:w-auto min-w-[200px]"
              >
                <span className="flex items-center justify-center gap-2">
                  Explore Businesses
                  <ExploreIcon
                    className="w-5 h-5 group-hover:translate-x-1 transition-transform"
                    aria-hidden="true"
                  />
                </span>
              </button>
            </div>

            {/* Trust Indicators */}
            <div className="mt-12 flex flex-col sm:flex-row items-center justify-center gap-6 text-sm text-gray-500">
              <div className="flex items-center gap-2">
                <CheckIcon className="w-5 h-5 text-gray-400" aria-hidden="true" />
                <span>Free to start</span>
              </div>
              <div className="hidden sm:block w-1 h-1 bg-gray-300 rounded-full"></div>
              <div className="flex items-center gap-2">
                <ClockIcon className="w-5 h-5 text-gray-400" aria-hidden="true" />
                <span>Set up in minutes</span>
              </div>
              <div className="hidden sm:block w-1 h-1 bg-gray-300 rounded-full"></div>
              <div className="flex items-center gap-2">
                <svg
                  className="w-5 h-5 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"
                  />
                </svg>
                <span>Works on mobile</span>
              </div>
            </div>

            {/* Coming Soon Badge */}
            <p className="mt-8 text-sm text-gray-400">More industries coming soon</p>
          </div>
        </div>
      </section>

      {/* Who It's For Section */}
      <section className="py-24 sm:py-32 bg-gray-50">
        <div className="w-full px-6 sm:px-8 lg:px-16 xl:px-24 2xl:px-32">
          <div className="mx-auto max-w-2xl text-center mb-16">
            <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
              Built for both sides of the booking
            </h2>
            <p className="mt-4 text-lg text-gray-600">
              A platform that serves business owners and customers equally
            </p>
          </div>
          <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
            {/* Business Owner Card */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 hover:shadow-md transition-shadow">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-black text-white mb-6">
                <BusinessesIcon className="h-6 w-6" aria-hidden="true" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">For Business Owners</h3>
              <p className="text-gray-600 mb-4">
                Manage your appointments without complexity. Create your booking page in minutes,
                set your availability, and let the platform handle confirmations and reminders.
              </p>
              <ul className="space-y-2 text-sm text-gray-600 mb-6">
                <li className="flex items-start">
                  <CheckIcon
                    className="h-5 w-5 text-black mr-2 flex-shrink-0 mt-0.5"
                    aria-hidden="true"
                  />
                  <span>Simple setup with no technical knowledge required</span>
                </li>
                <li className="flex items-start">
                  <CheckIcon
                    className="h-5 w-5 text-black mr-2 flex-shrink-0 mt-0.5"
                    aria-hidden="true"
                  />
                  <span>Automated confirmations and customer communication</span>
                </li>
                <li className="flex items-start">
                  <CheckIcon
                    className="h-5 w-5 text-black mr-2 flex-shrink-0 mt-0.5"
                    aria-hidden="true"
                  />
                  <span>Clear dashboard to track bookings and availability</span>
                </li>
              </ul>
              <button
                onClick={() => router.push(ROUTES.SELECT_ROLE('owner'))}
                className="w-full bg-black text-white hover:bg-gray-800 px-8 py-4 text-base font-semibold rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105"
              >
                Start Your Business Page
              </button>
            </div>

            {/* Customer Card */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 hover:shadow-md transition-shadow">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-black text-white mb-6">
                <ProfileIcon className="h-6 w-6" aria-hidden="true" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">For Customers</h3>
              <p className="text-gray-600 mb-4">
                Book appointments quickly and confidently. Find available slots, book instantly, and
                receive confirmations through your preferred channel.
              </p>
              <ul className="space-y-2 text-sm text-gray-600 mb-6">
                <li className="flex items-start">
                  <CheckIcon
                    className="h-5 w-5 text-black mr-2 flex-shrink-0 mt-0.5"
                    aria-hidden="true"
                  />
                  <span>Browse and book in seconds, no account required</span>
                </li>
                <li className="flex items-start">
                  <CheckIcon
                    className="h-5 w-5 text-black mr-2 flex-shrink-0 mt-0.5"
                    aria-hidden="true"
                  />
                  <span>Instant confirmations via WhatsApp or email</span>
                </li>
                <li className="flex items-start">
                  <CheckIcon
                    className="h-5 w-5 text-black mr-2 flex-shrink-0 mt-0.5"
                    aria-hidden="true"
                  />
                  <span>Works seamlessly on mobile and desktop</span>
                </li>
              </ul>
              <button
                onClick={() => router.push(ROUTES.SELECT_ROLE('customer'))}
                className="w-full border-2 border-gray-300 text-gray-700 hover:bg-gray-50 px-8 py-4 text-base font-semibold rounded-lg transition-all duration-200 transform hover:scale-105 bg-transparent"
              >
                Book an Appointment
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Categories Section */}
      <section className="py-24 sm:py-32 bg-white">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center mb-16">
            <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
              Built for multiple industries
            </h2>
            <p className="mt-4 text-lg text-gray-600">
              Starting with salons, expanding to serve more service businesses
            </p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 max-w-4xl mx-auto">
            {/* Active: Salons */}
            <div className="bg-black text-white rounded-xl p-6 text-center hover:bg-gray-900 transition-colors cursor-pointer">
              <div className="flex justify-center mb-3">
                <Image
                  src="/icons/categories/salon.png"
                  alt="Salon"
                  width={48}
                  height={48}
                  className="object-contain brightness-0 invert"
                />
              </div>
              <h3 className="font-semibold text-sm">Salons</h3>
              <p className="text-xs text-gray-300 mt-1">Available now</p>
            </div>

            {/* Upcoming Categories */}
            {[
              {
                name: 'Clinics',
                iconPath: '/icons/categories/clinic.png',
                coming: true,
              },
              {
                name: 'Fitness',
                iconPath: '/icons/categories/fitness.png',
                coming: true,
              },
              {
                name: 'Consultants',
                iconPath: '/icons/categories/consultant.png',
                coming: true,
              },
              {
                name: 'Home Services',
                iconPath: '/icons/categories/home-services.png',
                coming: true,
              },
            ].map((category) => (
              <div
                key={category.name}
                className="bg-gray-50 text-gray-400 rounded-xl p-6 text-center border-2 border-dashed border-gray-200 cursor-not-allowed"
              >
                <div className="flex justify-center mb-3">
                  <Image
                    src={category.iconPath}
                    alt={category.name}
                    width={48}
                    height={48}
                    className="object-contain opacity-40 grayscale"
                  />
                </div>
                <h3 className="font-semibold text-sm text-gray-500">{category.name}</h3>
                <p className="text-xs text-gray-400 mt-1">Coming soon</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-24 sm:py-32 bg-gray-50">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center mb-16">
            <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
              Everything you need to manage bookings
            </h2>
            <p className="mt-4 text-lg text-gray-600">
              Platform features designed for reliability and ease of use
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {[
              {
                title: 'Online Slot Booking',
                description:
                  'Customers can view and book available time slots in real-time, reducing phone calls and manual scheduling.',
                icon: <BookingsIcon className="h-6 w-6" aria-hidden="true" />,
              },
              {
                title: 'WhatsApp Confirmations',
                description:
                  'Automated booking confirmations and reminders sent directly to customers via WhatsApp for instant communication.',
                icon: (
                  <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                    />
                  </svg>
                ),
              },
              {
                title: 'QR Code Booking Links',
                description:
                  'Generate unique QR codes for your business that customers can scan to access your booking page instantly.',
                icon: (
                  <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z"
                    />
                  </svg>
                ),
              },
              {
                title: 'Owner Dashboards',
                description:
                  'Comprehensive dashboard to view all bookings, manage availability, and track your business performance.',
                icon: <DashboardIcon className="h-6 w-6" aria-hidden="true" />,
              },
              {
                title: 'Admin Oversight',
                description:
                  'Platform administrators can monitor system health, support businesses, and ensure smooth operations.',
                icon: (
                  <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                    />
                  </svg>
                ),
              },
              {
                title: 'Secure Access Control',
                description:
                  'Role-based authentication ensures that business owners, customers, and admins have appropriate access levels.',
                icon: (
                  <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                    />
                  </svg>
                ),
              },
            ].map((feature, index) => (
              <div
                key={index}
                className="bg-white rounded-xl p-6 border border-gray-200 hover:shadow-md transition-shadow"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100 text-black mb-4">
                  {feature.icon}
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">{feature.title}</h3>
                <p className="text-gray-600 text-sm">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-24 sm:py-32 bg-white">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center mb-16">
            <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl mb-4">
              How it works
            </h2>
            <p className="text-lg text-gray-600">Simple steps for businesses and customers</p>
          </div>
          <div className="grid md:grid-cols-4 gap-6 max-w-6xl mx-auto">
            {[
              {
                step: '1',
                title: 'Business creates page',
                description:
                  'Set up your business profile, define your services, and configure your availability in minutes.',
              },
              {
                step: '2',
                title: 'Customers book slots',
                description:
                  'Customers browse available time slots and book appointments instantly, without creating accounts.',
              },
              {
                step: '3',
                title: 'Owners confirm',
                description:
                  'Business owners review and confirm bookings through their dashboard, with full control over availability.',
              },
              {
                step: '4',
                title: 'Platform handles communication',
                description:
                  'Automated confirmations, reminders, and updates are sent to customers via their preferred channel.',
              },
            ].map((item, index) => (
              <div key={index} className="relative">
                <div className="flex flex-col h-full">
                  {/* Step Number */}
                  <div className="flex items-center mb-6">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-black text-white text-base font-bold flex-shrink-0">
                      {item.step}
                    </div>
                    {index < 3 && (
                      <div className="hidden md:flex flex-1 items-center ml-4 mr-4">
                        <div className="flex-1 h-px bg-gray-300"></div>
                        <ChevronRightIcon
                          className="w-4 h-4 text-gray-400 mx-2"
                          aria-hidden="true"
                        />
                        <div className="flex-1 h-px bg-gray-300"></div>
                      </div>
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900 mb-3 leading-tight">
                      {item.title}
                    </h3>
                    <p className="text-gray-600 text-sm leading-relaxed">{item.description}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Trust & Reliability Section */}
      <section className="py-24 sm:py-32 bg-gray-50">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center mb-16">
            <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl mb-4">
              Built for reliability and scale
            </h2>
            <p className="text-lg text-gray-600">
              Enterprise-grade infrastructure with a focus on security and performance
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
            {[
              {
                title: 'Secure Authentication',
                description:
                  'Industry-standard authentication with role-based access control to protect your business data.',
                icon: (
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                    />
                  </svg>
                ),
              },
              {
                title: 'Reliable Notifications',
                description:
                  'Automated messaging system ensures customers receive confirmations and reminders on time.',
                icon: (
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                    />
                  </svg>
                ),
              },
              {
                title: 'Designed for Scale',
                description:
                  'Platform architecture built to handle growth, from small businesses to large operations.',
                icon: (
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
                    />
                  </svg>
                ),
              },
              {
                title: 'Built for Real Businesses',
                description:
                  'Created with input from service businesses to solve real-world booking challenges.',
                icon: <BusinessesIcon className="w-6 h-6" aria-hidden="true" />,
              },
            ].map((item, index) => (
              <div
                key={index}
                className="bg-white rounded-lg p-6 border border-gray-200 hover:border-gray-300 transition-colors"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-gray-100 text-black mb-4">
                  {item.icon}
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">{item.title}</h3>
                <p className="text-gray-600 text-sm leading-relaxed">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA Section */}
      <section className="py-24 sm:py-32 bg-gradient-to-br from-gray-900 via-black to-gray-900 text-white relative overflow-hidden">
        {/* Decorative background elements */}
        <div className="absolute inset-0 opacity-5">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-white rounded-full blur-3xl"></div>
          <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-white rounded-full blur-3xl"></div>
        </div>

        <div className="w-full px-6 sm:px-10 lg:px-20 xl:px-32 2xl:px-40 relative z-10">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-4xl sm:text-5xl font-bold tracking-tight mb-6 bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
              Ready to get started?
            </h2>
            <p className="text-xl text-gray-200 mb-10 leading-relaxed">
              Join service businesses using CusOwn to manage their appointments.
              <br />
              <span className="text-gray-400">
                Free to start, simple to use, works on any device.
              </span>
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-10">
              <button
                onClick={() => router.push(ROUTES.SELECT_ROLE('owner'))}
                className="bg-white text-black hover:bg-gray-100 px-8 py-4 text-base font-semibold rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105 w-full sm:w-auto flex items-center justify-center gap-2"
              >
                <CreateBusinessIcon className="w-5 h-5" aria-hidden="true" />
                Start Your Business Page
              </button>
              <button
                onClick={() => router.push(ROUTES.SELECT_ROLE('customer'))}
                className="border-2 border-white text-white hover:bg-white hover:text-black px-8 py-4 text-base font-semibold rounded-lg transition-all duration-200 transform hover:scale-105 w-full sm:w-auto flex items-center justify-center gap-2 bg-transparent"
              >
                <BookingsIcon className="w-5 h-5" aria-hidden="true" />
                Book an Appointment
              </button>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-gray-400">
              <div className="flex items-center gap-2">
                <CheckIcon className="w-5 h-5 text-green-400" aria-hidden="true" />
                <span>No credit card required</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckIcon className="w-5 h-5 text-green-400" aria-hidden="true" />
                <span>Set up in minutes</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckIcon className="w-5 h-5 text-green-400" aria-hidden="true" />
                <span>Works on mobile and desktop</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 py-12">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="text-center">
            <p className="text-gray-600 text-sm">
              &copy; {new Date().getFullYear()} CusOwn. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
