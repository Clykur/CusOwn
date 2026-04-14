'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { ListFilter, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import Pagination from '@/components/ui/pagination';
import FilterDropdown from '@/components/analytics/FilterDropdown';
import { Salon } from '@/types';
import { logError } from '@/lib/utils/error-handler';
import SalonCard from '@/components/salon/salon-card';
import { SalonCardSkeleton } from '@/components/ui/skeleton';
import { ROUTES } from '@/lib/utils/navigation';
import {
  CUSTOMER_EXPLORE_SALONS_PER_PAGE,
  CUSTOMER_SCREEN_TITLE_CLASSNAME,
  UI_CUSTOMER,
} from '@/config/constants';
import ExploreIcon from '@/src/icons/explore.svg';
import MapPinIcon from '@/src/icons/map-pin.svg';
import Breadcrumb from '@/components/ui/breadcrumb';
import { useMounted } from '@/lib/hooks/use-mounted';
import { cn } from '@/lib/utils/cn';

export default function CustomerSalonListPage() {
  const mounted = useMounted();
  const [allSalons, setAllSalons] = useState<Salon[]>([]);
  const [locations, setLocations] = useState<string[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [locationsLoading, setLocationsLoading] = useState(true);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [mobileSearchExpanded, setMobileSearchExpanded] = useState(false);
  const [mobileFilterSheetOpen, setMobileFilterSheetOpen] = useState(false);

  const locationFilterOptions = useMemo(
    () => [
      {
        value: '',
        label: UI_CUSTOMER.EXPLORE_ALL_LOCATIONS,
        checked: selectedLocation === '',
      },
      ...locations.map((location) => ({
        value: location,
        label: location,
        checked: selectedLocation === location,
      })),
    ],
    [locations, selectedLocation]
  );

  const handleLocationToggle = useCallback((value: string, checked: boolean) => {
    if (checked) setSelectedLocation(value);
  }, []);

  const hasActiveFilters = Boolean(searchTerm.trim() || selectedLocation || userLocation !== null);

  const clearFilters = useCallback(() => {
    setSearchTerm('');
    setSelectedLocation('');
    setUserLocation(null);
  }, []);

  useEffect(() => {
    if (!mobileFilterSheetOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileFilterSheetOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [mobileFilterSheetOpen]);

  const handleUseMyLocation = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser');
      return;
    }

    setLoading(true);

    const fallbackToIp = async () => {
      try {
        const res = await fetch('/api/geo/ip');
        if (!res.ok) throw new Error('IP lookup failed');
        const result = await res.json();

        if (result.success && result.data) {
          const { latitude, longitude, city } = result.data;

          if (
            typeof latitude === 'number' &&
            typeof longitude === 'number' &&
            (latitude !== 0 || longitude !== 0)
          ) {
            setUserLocation({ lat: latitude, lng: longitude });

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
      }
    };

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        setUserLocation({ lat: latitude, lng: longitude });
        setLoading(false);

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

        if (err.code === 3 || err.code === 2) {
          await fallbackToIp();
        } else {
          setLoading(false);
          switch (err.code) {
            case 1:
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
        timeout: 6000,
        maximumAge: 300000,
        enableHighAccuracy: false,
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
    const startIndex = (currentPage - 1) * CUSTOMER_EXPLORE_SALONS_PER_PAGE;
    const endIndex = startIndex + CUSTOMER_EXPLORE_SALONS_PER_PAGE;
    return filteredSalons.slice(startIndex, endIndex);
  }, [filteredSalons, currentPage]);

  const totalPages = Math.ceil(filteredSalons.length / CUSTOMER_EXPLORE_SALONS_PER_PAGE);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedLocation]);

  useEffect(() => {
    let isMounted = true;

    const loadData = async () => {
      try {
        const [locationsRes, salonsRes] = await Promise.all([
          fetch('/api/salons/locations'),
          fetch(
            selectedLocation
              ? `/api/salons/list?location=${encodeURIComponent(selectedLocation)}`
              : '/api/salons/list'
          ),
        ]);

        if (!isMounted) return;

        if (locationsRes.ok) {
          const locationsResult = await locationsRes.json();
          if (locationsResult.success && Array.isArray(locationsResult.data)) {
            setLocations(locationsResult.data);
          } else {
            setLocations([]);
          }
        } else {
          setLocations([]);
        }

        setLocationsLoading(false);

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
    <div className="flex flex-col gap-3 pb-[calc(5rem+env(safe-area-inset-bottom,0px))] md:gap-6 md:pb-12">
      <div className="hidden md:block">
        <Breadcrumb
          items={[
            { label: UI_CUSTOMER.NAV_MY_ACTIVITY, href: '/customer/dashboard' },
            { label: 'Explore', href: '/customer/categories' },
            { label: 'Salons', href: '/customer/categories/salon' },
          ]}
        />
      </div>

      {/* Desktop: search + FilterDropdown + actions (unchanged pattern, native select replaced) */}
      <div className="hidden md:block">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
            <div className="relative min-w-0 flex-1">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
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
            <div className="w-full shrink-0 lg:max-w-xs">
              <FilterDropdown
                label={UI_CUSTOMER.EXPLORE_FILTER_LOCATION_LABEL}
                options={locationFilterOptions}
                onToggle={handleLocationToggle}
                multi={false}
                className={locationsLoading ? 'pointer-events-none opacity-60' : ''}
              />
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-end gap-3">
            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="mr-auto text-sm font-medium text-slate-900 underline hover:text-slate-700"
              >
                {UI_CUSTOMER.CTA_ADJUST_FILTERS}
              </button>
            )}
            <Button
              variant="ghost"
              size="sm"
              type="button"
              onClick={handleUseMyLocation}
              disabled={loading}
              className="flex shrink-0 items-center gap-1.5 px-2 text-blue-600 hover:text-blue-800"
            >
              <MapPinIcon className="h-4 w-4" aria-hidden="true" />
              {UI_CUSTOMER.EXPLORE_USE_MY_LOCATION}
            </Button>
          </div>
        </div>
      </div>

      {/* Mobile: Explore Services title + search/filter (layout header hidden on this route) */}
      <div className="md:hidden">
        <div className="flex min-w-0 items-center justify-between gap-3">
          <h1 className={cn(CUSTOMER_SCREEN_TITLE_CLASSNAME, 'min-w-0 truncate')}>
            {UI_CUSTOMER.NAV_EXPLORE_SERVICES}
          </h1>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => setMobileSearchExpanded((o) => !o)}
              className={cn(
                'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-slate-800 transition-colors hover:bg-slate-100',
                mobileSearchExpanded && 'bg-slate-100 text-slate-900'
              )}
              aria-expanded={mobileSearchExpanded}
              aria-label={UI_CUSTOMER.EXPLORE_MOBILE_OPEN_SEARCH}
            >
              <Search className="h-5 w-5 shrink-0" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => setMobileFilterSheetOpen(true)}
              className={cn(
                'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-slate-800 transition-colors hover:bg-slate-100',
                hasActiveFilters && 'bg-slate-100'
              )}
              aria-label={UI_CUSTOMER.EXPLORE_MOBILE_OPEN_FILTERS}
            >
              <ListFilter className="h-5 w-5 shrink-0" aria-hidden="true" />
            </button>
          </div>
        </div>

        {mobileSearchExpanded ? (
          <div className="relative mt-3">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              <ExploreIcon className="h-5 w-5 text-slate-400" aria-hidden="true" />
            </div>
            <Input
              type="search"
              placeholder={UI_CUSTOMER.SEARCH_PLACEHOLDER}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
              autoComplete="off"
            />
          </div>
        ) : null}

        {hasActiveFilters ? (
          <div className="mt-2">
            <button
              type="button"
              onClick={clearFilters}
              className="text-sm font-medium text-slate-900 underline"
            >
              {UI_CUSTOMER.CTA_ADJUST_FILTERS}
            </button>
          </div>
        ) : null}
      </div>

      {mounted &&
        mobileFilterSheetOpen &&
        createPortal(
          <div
            className="fixed inset-0 z-[90] md:hidden"
            role="dialog"
            aria-modal="true"
            aria-labelledby="customer-explore-filters-title"
          >
            <button
              type="button"
              className="absolute inset-0 bg-black/40"
              aria-label={UI_CUSTOMER.EXPLORE_MOBILE_CLOSE_SHEET}
              onClick={() => setMobileFilterSheetOpen(false)}
            />
            <div className="absolute bottom-0 left-0 right-0 z-10 max-h-[88vh] overflow-y-auto rounded-t-2xl bg-white px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-4 shadow-xl">
              <div className="mb-3 flex items-center justify-between gap-2">
                <h2 id="customer-explore-filters-title" className={CUSTOMER_SCREEN_TITLE_CLASSNAME}>
                  {UI_CUSTOMER.EXPLORE_FILTERS_SHEET_TITLE}
                </h2>
                <button
                  type="button"
                  onClick={() => setMobileFilterSheetOpen(false)}
                  className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100"
                  aria-label={UI_CUSTOMER.EXPLORE_MOBILE_CLOSE_SHEET}
                >
                  <X className="h-5 w-5" aria-hidden="true" />
                </button>
              </div>
              <p className="mb-4 text-sm leading-relaxed text-slate-500">
                {UI_CUSTOMER.EXPLORE_FILTERS_SHEET_HINT}
              </p>

              <div className={locationsLoading ? 'pointer-events-none opacity-60' : ''}>
                <FilterDropdown
                  label={UI_CUSTOMER.EXPLORE_FILTER_LOCATION_LABEL}
                  options={locationFilterOptions}
                  onToggle={handleLocationToggle}
                  multi={false}
                  layout="inline"
                  className="mb-4"
                />
              </div>

              <Button
                variant="outline"
                type="button"
                className="mb-3 flex h-11 w-full items-center justify-center gap-2 rounded-xl border-slate-200 font-medium"
                onClick={() => {
                  handleUseMyLocation();
                }}
                disabled={loading}
              >
                <MapPinIcon className="h-4 w-4" aria-hidden="true" />
                {UI_CUSTOMER.EXPLORE_USE_MY_LOCATION}
              </Button>

              {hasActiveFilters ? (
                <button
                  type="button"
                  onClick={() => {
                    clearFilters();
                  }}
                  className="mb-4 flex h-11 w-full items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-sm font-medium text-slate-800 transition hover:bg-slate-100"
                >
                  {UI_CUSTOMER.CTA_ADJUST_FILTERS}
                </button>
              ) : null}

              <button
                type="button"
                onClick={() => setMobileFilterSheetOpen(false)}
                className="flex h-11 w-full items-center justify-center rounded-xl bg-slate-900 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                {UI_CUSTOMER.EXPLORE_FILTERS_DONE}
              </button>
            </div>
          </div>,
          document.body
        )}

      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <SalonCardSkeleton key={i} />
          ))}
        </div>
      ) : filteredSalons.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-sm sm:p-16">
          <div className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-slate-100">
            <ExploreIcon className="h-12 w-12 text-slate-400" aria-hidden="true" />
          </div>
          <h3 className="mb-2 text-xl font-semibold text-slate-900">
            {UI_CUSTOMER.EMPTY_NO_MATCH}
          </h3>
          <p className="mx-auto mb-8 max-w-md text-sm text-slate-600">
            {UI_CUSTOMER.EMPTY_TRY_FILTERS}
          </p>
          <div className="flex flex-col justify-center gap-3 sm:flex-row">
            {(searchTerm || selectedLocation) && (
              <Button
                type="button"
                onClick={() => {
                  setSearchTerm('');
                  setSelectedLocation('');
                }}
                className="rounded-xl bg-slate-900 text-white hover:bg-slate-800"
              >
                {UI_CUSTOMER.CTA_ADJUST_FILTERS}
              </Button>
            )}
            <Link
              href={ROUTES.CUSTOMER_CATEGORIES}
              className="inline-flex items-center justify-center rounded-xl bg-slate-100 px-6 py-3 font-medium text-slate-800 transition hover:bg-slate-200"
            >
              {UI_CUSTOMER.CTA_EXPLORE_SERVICES}
            </Link>
          </div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {paginatedSalons.map((salon, index) => (
              <SalonCard key={salon.booking_link || `salon-${index}`} salon={salon} />
            ))}
          </div>

          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
            totalItems={filteredSalons.length}
            itemsPerPage={CUSTOMER_EXPLORE_SALONS_PER_PAGE}
            className="border-slate-200"
          />
        </>
      )}
    </div>
  );
}
