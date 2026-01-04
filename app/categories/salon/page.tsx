'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Salon } from '@/types';
import { logError } from '@/lib/utils/error-handler';

export default function SalonListPage() {
  const [salons, setSalons] = useState<Salon[]>([]);
  const [locations, setLocations] = useState<string[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [locationsLoading, setLocationsLoading] = useState(true);

  const fetchLocations = useCallback(async () => {
    setLocationsLoading(true);
    try {
      const response = await fetch('/api/salons/locations');
      const result = await response.json();
      if (result.success && result.data && Array.isArray(result.data)) {
        setLocations(result.data);
      } else {
        logError('Invalid locations data', 'Locations Fetch');
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
        let filteredSalons = result.data;
        if (searchTerm) {
          filteredSalons = filteredSalons.filter((salon: Salon) =>
            salon.salon_name.toLowerCase().includes(searchTerm.toLowerCase())
          );
        }
        setSalons(filteredSalons);
      }
    } catch (error) {
      logError(error, 'Salons Fetch');
    } finally {
      setLoading(false);
    }
  }, [selectedLocation, searchTerm]);

  useEffect(() => {
    fetchLocations();
    fetchSalons();
  }, [fetchLocations, fetchSalons]);

  useEffect(() => {
    fetchSalons();
  }, [selectedLocation, fetchSalons]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchTerm !== undefined) {
        fetchSalons();
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchTerm, fetchSalons]);

  return (
    <div className="min-h-screen bg-white">
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-2">Salons</h2>
          <p className="text-gray-600">Find and book appointments at salons near you</p>
        </div>

        {/* Filters */}
        <div className="mb-8 flex flex-col gap-4 sm:flex-row">
          <div className="flex-1">
            <Input
              type="text"
              placeholder="Search salons..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="sm:w-64">
            <select
              value={selectedLocation}
              onChange={(e) => setSelectedLocation(e.target.value)}
              disabled={locationsLoading}
              className="flex h-10 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <option value="">All Locations</option>
              {locations.length > 0 ? (
                locations.map((location) => (
                  <option key={location} value={location}>
                    {location}
                  </option>
                ))
              ) : !locationsLoading ? (
                <option value="" disabled>No locations available</option>
              ) : null}
            </select>
          </div>
        </div>

        {/* Salon List */}
        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-black border-r-transparent"></div>
            <p className="mt-4 text-gray-600">Loading salons...</p>
          </div>
        ) : salons.length === 0 ? (
          <div className="rounded-xl bg-white p-12 text-center shadow-sm">
            <p className="text-gray-600">No salons found. Try adjusting your filters.</p>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {salons.map((salon) => (
              <Link key={salon.id} href={`/salon/${salon.id}`}>
                <div className="group rounded-xl bg-white p-6 shadow-sm transition-all hover:shadow-lg cursor-pointer border-2 border-transparent hover:border-black">
                  <h3 className="text-xl font-semibold text-gray-900 mb-2 group-hover:text-black transition-colors">
                    {salon.salon_name}
                  </h3>
                  {salon.location && (
                    <p className="text-sm text-gray-500 mb-2 flex items-center gap-1">
                      <svg
                        className="h-4 w-4"
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
                      {salon.location}
                    </p>
                  )}
                  {salon.address && (
                    <p className="text-sm text-gray-600 mb-4 line-clamp-2">{salon.address}</p>
                  )}
                  <div className="flex items-center justify-between text-sm text-gray-500">
                    <span>
                      {salon.opening_time.substring(0, 5)} - {salon.closing_time.substring(0, 5)}
                    </span>
                    <span className="text-black font-medium">View Slots →</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

