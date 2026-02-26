'use client';

import Link from 'next/link';
import { ROUTES } from '@/lib/utils/navigation';
import BusinessesIcon from '@/src/icons/businesses.svg';
import ChevronRightIcon from '@/src/icons/chevron-right.svg';
import CreateBusinessIcon from '@/src/icons/create-business.svg';

export default function CategoriesPage() {
  return (
    <div className="min-h-screen bg-white flex">
      <div className="flex-1 lg:ml-64">
        <div className="max-w-7xl mx-auto px-4 pt-4 sm:pt-4 lg:pt-32 pb-20 sm:pb-32 lg:pb-12 sm:px-6 lg:px-8">
          <div className="hidden md:block text-center mb-12">
            <h1 className="text-4xl lg:text-5xl font-bold text-gray-900 mb-4">Choose a Category</h1>
            <p className="text-lg lg:text-xl text-gray-600 max-w-2xl mx-auto">
              Select the type of service you&apos;re looking for
            </p>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 max-w-5xl mx-auto">
            <Link href={ROUTES.SALON_LIST}>
              <div className="group relative overflow-hidden rounded-2xl bg-white p-8 shadow-lg transition-all hover:shadow-2xl cursor-pointer border-2 border-gray-200 hover:border-black transform hover:-translate-y-1">
                <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-gray-100 to-gray-200 group-hover:from-black group-hover:to-gray-800 transition-all">
                  <BusinessesIcon
                    className="h-10 w-10 text-gray-700 group-hover:text-white transition-colors"
                    aria-hidden="true"
                  />
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-3 group-hover:text-black">
                  Salon
                </h3>
                <p className="text-gray-600 leading-relaxed">
                  Book appointments at salons near you. Haircuts, styling, grooming, and more beauty
                  services.
                </p>
                <div className="mt-6 flex items-center text-black font-semibold group-hover:translate-x-2 transition-transform">
                  <span>Explore Salons</span>
                  <ChevronRightIcon className="w-5 h-5 ml-2" aria-hidden="true" />
                </div>
              </div>
            </Link>

            {/* Placeholder for future categories */}
            <div className="group relative overflow-hidden rounded-2xl bg-gray-100 p-8 border-2 border-dashed border-gray-300 opacity-60">
              <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-gray-200">
                <CreateBusinessIcon className="h-10 w-10 text-gray-400" aria-hidden="true" />
              </div>
              <h3 className="text-2xl font-bold text-gray-400 mb-3">More Categories</h3>
              <p className="text-gray-500 leading-relaxed">
                Additional service categories coming soon...
              </p>
            </div>

            <div className="group relative overflow-hidden rounded-2xl bg-gray-100 p-8 border-2 border-dashed border-gray-300 opacity-60">
              <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-gray-200">
                <CreateBusinessIcon className="h-10 w-10 text-gray-400" aria-hidden="true" />
              </div>
              <h3 className="text-2xl font-bold text-gray-400 mb-3">More Categories</h3>
              <p className="text-gray-500 leading-relaxed">
                Additional service categories coming soon...
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
