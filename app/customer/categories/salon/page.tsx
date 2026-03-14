'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import Pagination from '@/components/ui/pagination';
import { Salon } from '@/types';
import { logError } from '@/lib/utils/error-handler';
import SalonCard from '@/components/salon/salon-card';
import { SalonCardSkeleton } from '@/components/ui/skeleton';
import { ROUTES } from '@/lib/utils/navigation';
import { UI_CUSTOMER } from '@/config/constants';
import ExploreIcon from '@/src/icons/explore.svg';
import MapPinIcon from '@/src/icons/map-pin.svg';
import ChevronDownIcon from '@/src/icons/chevron-down.svg';

const ITEMS_PER_PAGE = 12;

export default function CustomerSalonListPage() {
  const [allSalons, setAllSalons] = useState<Salon[]>([]);
  const [locations, setLocations] = useState<string[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [locationsLoading, setLocationsLoading] = useState(true);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);

  const handleUseMyLocation = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser');
      return;
    }

    setLoading(true);

    // Fallback function for IP-based geolocation
    const fallbackToIp = async () => {
      try {
        const res = await fetch('/api/geo/ip');
        if (!res.ok) throw new Error('IP lookup failed');
        const result = await res.json();

        if (result.success && result.data) {
          const { latitude, longitude, city } = result.data;

          // If we have coordinates, use them
          if (
            typeof latitude === 'number' &&
            typeof longitude === 'number' &&
            (latitude !== 0 || longitude !== 0)
          ) {
            setUserLocation({ lat: latitude, lng: longitude });

            // Persist location (approximate from IP)
            await fetch('/api/user/location', {
              method: 'POST',
              body: JSON.stringify({
                latitude,
                longitude,
                city: city,
                country: result.data.countryName,
              }),
            });
            return;
          }

          // If no coordinates but we have a city, search by city
          if (city) {
            setSelectedLocation(city);
            setLoading(false);
            return;
          }
        }

        throw new Error('Could not pinpoint location from IP');
      } catch (e) {
        console.error('IP fallback failed:', e);
        setLoading(false);
        // Don't show blocking alert, just let them use manual search
      }
    };

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        setUserLocation({ lat: latitude, lng: longitude });
        setLoading(false);

        // Persist location in background (non-blocking)
        try {
          await fetch('/api/user/location', {
            method: 'POST',
            body: JSON.stringify({ latitude, longitude }),
          });
        } catch (e) {
          console.warn('Failed to persist user location:', e);
        }
      },
      async (err) => {
        console.warn('Geolocation error:', err);

        // Code 3 is timeout, Code 2 is position unavailable
        if (err.code === 3 || err.code === 2) {
          await fallbackToIp();
        } else {
          setLoading(false);
          // Handle specific geolocation error codes
          switch (err.code) {
            case 1: // PERMISSION_DENIED
              alert(
                'Geolocation permission denied. Please enable location access in your browser settings to use this feature.'
              );
              break;
            default:
              alert('Could not get your location. Please try again or enter it manually.');
          }
        }
      },
      {
        timeout: 6000, // Reduced timeout to 6s for better UX with fallback
        maximumAge: 300000, // Cache location for 5 minutes
        enableHighAccuracy: false, // Don't force GPS if not needed, faster for desktop
      }
    );
  };

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

  // Reset pagination when search or location changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedLocation]);

  // Single initialization effect: fetch locations and initial salons
  useEffect(() => {
    let isMounted = true;

    const loadData = async () => {
      try {
        // Fetch locations and salons in parallel
        const [locationsRes, salonsRes] = await Promise.all([
          fetch('/api/salons/locations'),
          fetch(
            selectedLocation
              ? `/api/salons/list?location=${encodeURIComponent(selectedLocation)}`
              : '/api/salons/list'
          ),
        ]);

        if (!isMounted) return;

        // Process locations response
        if (locationsRes.ok) {
          const locationsResult = await locationsRes.json();
          if (locationsResult.success && Array.isArray(locationsResult.data)) {
            setLocations(locationsResult.data);
          } else {
            console.warn('Locations API returned invalid format:', {
              success: locationsResult.success,
              hasData: !!locationsResult.data,
              dataType: typeof locationsResult.data,
              error: locationsResult.error,
            });
            setLocations([]);
          }
        } else {
          const errorText = await locationsRes.text();
          console.error('Locations API error:', locationsRes.status, errorText);
          setLocations([]);
        }

        setLocationsLoading(false);

        // Process salons response
        if (salonsRes.ok) {
          const salonsResult = await salonsRes.json();
          if (salonsResult.success && salonsResult.data) {
            const fetchedSalons = (salonsResult.data || []).filter(
              (salon: Salon) => !salon.suspended
            );
            setAllSalons(fetchedSalons);
          } else {
            setAllSalons([]);
            if (salonsResult.error) {
              logError(salonsResult.error, 'Salons Fetch Error');
            }
          }
        } else {
          setAllSalons([]);
          console.error('Salons API error:', salonsRes.status);
        }

        setLoading(false);
      } catch (error) {
        if (isMounted) {
          logError(error, 'Data Fetch');
          setLocations([]);
          setAllSalons([]);
          setLocationsLoading(false);
          setLoading(false);
        }
      }
    };

    loadData();

    return () => {
      isMounted = false;
    };
  }, [selectedLocation]);

  // Handle user location changes separately
  useEffect(() => {
    if (!userLocation) return;

    let isMounted = true;

    const loadNearby = async () => {
      setLoading(true);
      try {
        const response = await fetch(
          `/api/business/nearby?lat=${userLocation.lat}&lng=${userLocation.lng}&radius=20`
        );

        if (!isMounted) return;

        if (response.ok) {
          const result = await response.json();
          if (result.success && result.data) {
            const fetchedSalons = (result.data || []).filter((salon: Salon) => !salon.suspended);
            setAllSalons(fetchedSalons);
          } else {
            setAllSalons([]);
          }
        } else {
          setAllSalons([]);
          console.error('Nearby API error:', response.status);
        }
      } catch (error) {
        if (isMounted) {
          logError(error, 'Nearby Salons Fetch');
          setAllSalons([]);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadNearby();

    return () => {
      isMounted = false;
    };
  }, [userLocation]);

  return (
    <div className="space-y-8 pb-20 md:pb-12">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
        <div className="flex flex-col gap-4 sm:flex-row">
          <div className="flex-1 relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <ExploreIcon className="h-5 w-5 text-slate-400" aria-hidden="true" />
            </div>
            <Input
              type="text"
              placeholder={UI_CUSTOMER.SEARCH_PLACEHOLDER}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="sm:w-64 relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <MapPinIcon className="h-5 w-5 text-slate-400" aria-hidden="true" />
            </div>
            <select
              value={selectedLocation}
              onChange={(e) => setSelectedLocation(e.target.value)}
              disabled={locationsLoading}
              className="flex h-10 w-full rounded-lg border border-slate-300 bg-white pl-10 pr-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 disabled:opacity-50 disabled:cursor-not-allowed appearance-none"
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
              <ChevronDownIcon className="h-4 w-4 text-slate-400" aria-hidden="true" />
            </div>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-600">
              {filteredSalons.length}{' '}
              {filteredSalons.length === 1 ? UI_CUSTOMER.RESULT_COUNT : UI_CUSTOMER.RESULTS_COUNT}
              {searchTerm && ` matching "${searchTerm}"`}
              {selectedLocation && ` in ${selectedLocation}`}
              {userLocation && ` near you`}
            </span>
            {(searchTerm || selectedLocation || userLocation) && (
              <button
                onClick={() => {
                  setSearchTerm('');
                  setSelectedLocation('');
                  setUserLocation(null);
                }}
                className="text-sm text-slate-900 hover:text-slate-700 font-medium underline ml-2"
              >
                {UI_CUSTOMER.CTA_ADJUST_FILTERS}
              </button>
            )}
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={handleUseMyLocation}
            disabled={loading}
            className="text-blue-600 hover:text-blue-800 flex items-center gap-1.5 px-2"
          >
            <MapPinIcon className="w-4 h-4" />
            Use My Location
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3" aria-busy="true">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <SalonCardSkeleton key={i} />
          ))}
        </div>
      ) : filteredSalons.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-16 text-center">
          <div className="w-24 h-24 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <ExploreIcon className="h-12 w-12 text-slate-400" aria-hidden="true" />
          </div>
          <h3 className="text-xl font-semibold text-slate-900 mb-2">
            {UI_CUSTOMER.EMPTY_NO_MATCH}
          </h3>
          <p className="text-slate-600 mb-8 max-w-md mx-auto text-sm">
            {UI_CUSTOMER.EMPTY_TRY_FILTERS}
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            {(searchTerm || selectedLocation) && (
              <Button
                onClick={() => {
                  setSearchTerm('');
                  setSelectedLocation('');
                }}
                className="bg-slate-900 text-white hover:bg-slate-800 rounded-xl"
              >
                {UI_CUSTOMER.CTA_ADJUST_FILTERS}
              </Button>
            )}
            <Link
              href={ROUTES.CUSTOMER_CATEGORIES}
              className="inline-flex items-center justify-center px-6 py-3 bg-slate-100 text-slate-800 font-medium rounded-xl hover:bg-slate-200 transition-all"
            >
              {UI_CUSTOMER.CTA_EXPLORE_SERVICES}
            </Link>
          </div>
        </div>
      ) : (
        <>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3">
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
  );
}
