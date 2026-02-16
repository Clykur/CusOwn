'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import Pagination from '@/components/ui/pagination';
import { Salon } from '@/types';
import { logError } from '@/lib/utils/error-handler';
import SalonCard from '@/components/salon/salon-card';
import Breadcrumb from '@/components/ui/breadcrumb';
import { SalonCardSkeleton } from '@/components/ui/skeleton';
import { ROUTES } from '@/lib/utils/navigation';

const ITEMS_PER_PAGE = 12;

export default function SalonListPage() {
  const [allSalons, setAllSalons] = useState<Salon[]>([]);
  const [locations, setLocations] = useState<string[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [locationsLoading, setLocationsLoading] = useState(true);

  const fetchLocations = useCallback(async () => {
    setLocationsLoading(true);
    try {
      const response = await fetch('/api/salons/locations');
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Locations API error:', response.status, errorText);
        setLocations([]);
        return;
      }
      const result = await response.json();
      if (result.success && Array.isArray(result.data)) {
        setLocations(result.data);
      } else {
        console.warn('Locations API returned invalid format:', {
          success: result.success,
          hasData: !!result.data,
          dataType: typeof result.data,
          error: result.error,
        });
        setLocations([]);
      }
    } catch (error) {
      logError(error, 'Locations Fetch');
      setLocations([]);
    } finally {
      setLocationsLoading(false);
    }
  }, []);

  const fetchSalons = useCallback(async () => {
    setLoading(true);
    try {
      const url = selectedLocation
        ? `/api/salons/list?location=${encodeURIComponent(selectedLocation)}`
        : '/api/salons/list';
      const response = await fetch(url);
      const result = await response.json();
      if (result.success && result.data) {
        const fetchedSalons = (result.data || []).filter((salon: Salon) => !salon.suspended);
        setAllSalons(fetchedSalons);
      } else {
        setAllSalons([]);
        if (result.error) {
          logError(result.error, 'Salons Fetch Error');
        }
      }
    } catch (error) {
      logError(error, 'Salons Fetch');
      setAllSalons([]);
    } finally {
      setLoading(false);
    }
  }, [selectedLocation]);

  const filteredSalons = useMemo(() => {
    let filtered = allSalons;

    if (searchTerm) {
      const term = searchTerm.toLowerCase().trim();
      filtered = filtered.filter(
        (salon: Salon) =>
          salon.salon_name?.toLowerCase().includes(term) ||
          salon.location?.toLowerCase().includes(term) ||
          salon.address?.toLowerCase().includes(term)
      );
    }

    return filtered;
  }, [allSalons, searchTerm]);

  const paginatedSalons = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    return filteredSalons.slice(startIndex, endIndex);
  }, [filteredSalons, currentPage]);

  const totalPages = Math.ceil(filteredSalons.length / ITEMS_PER_PAGE);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedLocation]);

  useEffect(() => {
    fetchLocations();
    fetchSalons();
  }, [fetchLocations, fetchSalons]);

  useEffect(() => {
    fetchSalons();
  }, [selectedLocation, fetchSalons]);

  return (
    <div className="min-h-screen bg-white flex">
      <div className="flex-1 lg:ml-64">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="mb-8">
            <h1 className="text-4xl font-bold text-gray-900 mb-3">Find Your Perfect Salon</h1>
            <p className="text-lg text-gray-600">Browse and book appointments at salons near you</p>
          </div>

          <div className="mb-8 bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex flex-col gap-4 sm:flex-row">
              <div className="flex-1 relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg
                    className="h-5 w-5 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                    />
                  </svg>
                </div>
                <Input
                  type="text"
                  placeholder="Search by salon name, location, or address..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <div className="sm:w-64 relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg
                    className="h-5 w-5 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                  </svg>
                </div>
                <select
                  value={selectedLocation}
                  onChange={(e) => setSelectedLocation(e.target.value)}
                  disabled={locationsLoading}
                  className="flex h-10 w-full rounded-lg border border-gray-300 bg-white pl-10 pr-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black disabled:opacity-50 disabled:cursor-not-allowed appearance-none"
                >
                  <option value="">All Locations</option>
                  {locations.length > 0 ? (
                    locations.map((location) => (
                      <option key={`location-${location}`} value={location}>
                        {location}
                      </option>
                    ))
                  ) : !locationsLoading ? (
                    <option value="" disabled>
                      No locations available
                    </option>
                  ) : null}
                </select>
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                  <svg
                    className="h-4 w-4 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </div>
              </div>
            </div>

            <div className="mt-4 flex items-center gap-2 flex-wrap">
              <span className="text-sm text-gray-600">
                {filteredSalons.length} {filteredSalons.length === 1 ? 'salon' : 'salons'} found
                {searchTerm && ` matching "${searchTerm}"`}
                {selectedLocation && ` in ${selectedLocation}`}
              </span>
              {(searchTerm || selectedLocation) && (
                <button
                  onClick={() => {
                    setSearchTerm('');
                    setSelectedLocation('');
                  }}
                  className="text-sm text-black hover:text-gray-700 font-medium underline"
                >
                  Clear filters
                </button>
              )}
            </div>
          </div>

          {loading ? (
            <div
              className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
              aria-busy="true"
            >
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <SalonCardSkeleton key={i} />
              ))}
            </div>
          ) : filteredSalons.length === 0 ? (
            <div className="bg-white rounded-2xl shadow-xl border-2 border-gray-200 p-16 text-center">
              <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <svg
                  className="h-12 w-12 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-3">No Salons Found</h3>
              <p className="text-gray-600 mb-8 max-w-md mx-auto">
                {searchTerm || selectedLocation
                  ? `We couldn't find any salons matching your search. Try adjusting your filters or browse all salons.`
                  : 'No salons are available at the moment. Check back later or explore other categories.'}
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                {(searchTerm || selectedLocation) && (
                  <Button
                    onClick={() => {
                      setSearchTerm('');
                      setSelectedLocation('');
                    }}
                    className="bg-black text-white hover:bg-gray-900"
                  >
                    Clear All Filters
                  </Button>
                )}
                <Link
                  href={ROUTES.CATEGORIES}
                  className="inline-flex items-center justify-center px-6 py-3 bg-gray-100 text-gray-800 font-semibold rounded-xl hover:bg-gray-200 transition-all"
                >
                  Browse Categories
                </Link>
              </div>
            </div>
          ) : (
            <>
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {paginatedSalons.map((salon, index) => (
                  <SalonCard key={salon.booking_link || `salon-${index}`} salon={salon} />
                ))}
              </div>

              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setCurrentPage}
                totalItems={filteredSalons.length}
                itemsPerPage={ITEMS_PER_PAGE}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
