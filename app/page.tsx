'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function Home() {
  const router = useRouter();
  const [bookingLink, setBookingLink] = useState('');
  const [error, setError] = useState('');

  const handleBookingSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!bookingLink.trim()) {
      setError('Please enter a booking link');
      return;
    }

    let cleanLink = bookingLink.trim();

    // Remove protocol and domain if present
    cleanLink = cleanLink.replace(/^https?:\/\//, '');
    cleanLink = cleanLink.replace(/^[^\/]+\//, ''); // Remove domain part
    
    // Remove /b/ prefix if present
    cleanLink = cleanLink.replace(/^\/?b\//, '');
    cleanLink = cleanLink.replace(/^\/b\//, '');
    
    // Remove trailing slash
    cleanLink = cleanLink.replace(/\/$/, '');
    
    // Extract just the slug (last part after /)
    const parts = cleanLink.split('/');
    cleanLink = parts[parts.length - 1];

    if (!cleanLink) {
      setError('Invalid booking link format');
      return;
    }

    router.push(`/b/${cleanLink}`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      {/* Navigation */}
      <nav className="border-b border-gray-200 bg-white/80 backdrop-blur-sm">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center">
              <h1 className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                Cusown
              </h1>
            </div>
            <div className="flex items-center gap-4">
              <Link href="/setup">
                <Button variant="ghost" size="sm">
                  For Business
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl pt-20 pb-16 text-center">
          <h2 className="text-5xl font-bold tracking-tight text-gray-900 sm:text-6xl">
            Book Your Slot,
            <br />
            <span className="bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
              Anytime, Anywhere
            </span>
          </h2>
          <p className="mt-6 text-lg leading-8 text-gray-600">
            A simple, elegant solution for booking slots across various services.
            <br />
            <span className="font-medium text-indigo-600">
              Currently available for salon bookings.
            </span>
          </p>

          {/* CTA Buttons */}
          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link href="/categories">
              <Button size="lg" className="w-full sm:w-auto">
                Browse Categories
              </Button>
            </Link>
            <div className="text-sm text-gray-500">or</div>
            <Link href="/setup">
              <Button size="lg" variant="outline" className="w-full sm:w-auto">
                Create Your Booking Page
              </Button>
            </Link>
          </div>
        </div>

        {/* Features Section */}
        <div className="mx-auto mt-32 max-w-5xl">
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            <div className="rounded-xl bg-white p-6 shadow-sm">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-indigo-100">
                <svg
                  className="h-6 w-6 text-indigo-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900">Instant Booking</h3>
              <p className="mt-2 text-sm text-gray-600">
                Book your slot in seconds. No calls, no waiting, just click and book.
              </p>
            </div>

            <div className="rounded-xl bg-white p-6 shadow-sm">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-purple-100">
                <svg
                  className="h-6 w-6 text-purple-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900">Real-time Availability</h3>
              <p className="mt-2 text-sm text-gray-600">
                See available slots in real-time. No double bookings, no confusion.
              </p>
            </div>

            <div className="rounded-xl bg-white p-6 shadow-sm">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-pink-100">
                <svg
                  className="h-6 w-6 text-pink-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
                  />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900">WhatsApp Integration</h3>
              <p className="mt-2 text-sm text-gray-600">
                Get instant confirmations via WhatsApp. Simple, fast, and reliable.
              </p>
            </div>
          </div>
        </div>

        {/* How It Works */}
        <div className="mx-auto mt-32 max-w-4xl">
          <div className="text-center">
            <h2 className="text-3xl font-bold text-gray-900">How It Works</h2>
            <p className="mt-4 text-lg text-gray-600">
              Simple steps to get started with slot booking
            </p>
          </div>

          <div className="mt-12 grid gap-8 sm:grid-cols-3">
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-indigo-100 text-2xl font-bold text-indigo-600">
                1
              </div>
              <h3 className="text-lg font-semibold text-gray-900">For Business Owners</h3>
              <p className="mt-2 text-sm text-gray-600">
                Create your booking page in minutes. Set your hours, slot duration, and get a
                unique booking link.
              </p>
            </div>

            <div className="text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-purple-100 text-2xl font-bold text-purple-600">
                2
              </div>
              <h3 className="text-lg font-semibold text-gray-900">Share Your Link</h3>
              <p className="mt-2 text-sm text-gray-600">
                Share your booking link on WhatsApp, Instagram, or print a QR code. Your customers
                can book instantly.
              </p>
            </div>

            <div className="text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-pink-100 text-2xl font-bold text-pink-600">
                3
              </div>
              <h3 className="text-lg font-semibold text-gray-900">Manage Bookings</h3>
              <p className="mt-2 text-sm text-gray-600">
                Receive booking requests on WhatsApp. Accept or reject with one click. Send
                confirmations automatically.
              </p>
            </div>
          </div>
        </div>

        {/* CTA Section */}
        <div className="mx-auto mt-32 max-w-2xl rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 p-8 text-center text-white">
          <h2 className="text-3xl font-bold">Ready to Get Started?</h2>
          <p className="mt-4 text-lg text-indigo-100">
            Create your booking page today and start accepting bookings in minutes.
          </p>
          <div className="mt-8">
            <Link href="/setup">
              <Button size="lg" variant="outline" className="bg-white text-indigo-600 hover:bg-gray-100">
                Create Your Booking Page
              </Button>
            </Link>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="mt-32 border-t border-gray-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="text-center">
            <h3 className="text-xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
              Cusown
            </h3>
            <p className="mt-2 text-sm text-gray-600">
              Simple slot booking for modern businesses
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
