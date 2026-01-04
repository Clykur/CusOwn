'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function CategoriesPage() {
  return (
    <div className="min-h-screen bg-white">
      <nav className="border-b border-gray-200 bg-white/80 backdrop-blur-sm">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <Link href="/" className="flex items-center">
              <h1 className="text-2xl font-bold text-black">
                Cusown
              </h1>
            </Link>
          </div>
        </div>
      </nav>

      <main className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold text-gray-900 mb-4">Choose a Category</h2>
          <p className="text-lg text-gray-600">Select the type of service you&apos;re looking for</p>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 max-w-4xl mx-auto">
          <Link href="/categories/salon">
            <div className="group relative overflow-hidden rounded-xl bg-white p-8 shadow-sm transition-all hover:shadow-lg cursor-pointer border-2 border-transparent hover:border-black">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-lg bg-gray-100 group-hover:bg-gray-200 transition-colors">
                <svg
                  className="h-8 w-8 text-black"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"
                  />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Salon</h3>
              <p className="text-sm text-gray-600">
                Book appointments at salons near you. Haircuts, styling, and more.
              </p>
            </div>
          </Link>
        </div>
      </main>
    </div>
  );
}

