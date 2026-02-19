'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
//import { supabaseAuth } from '@/lib/supabase/auth';
import { supabase } from '@/lib/supabase/client';
import {
  ROUTES,
  getOwnerDashboardUrl,
  getSecureOwnerDashboardUrlClient,
} from '@/lib/utils/navigation';
import { formatDate } from '@/lib/utils/string';
import { getCSRFToken } from '@/lib/utils/csrf-client';
import { ProfileSkeleton } from '@/components/ui/skeleton';

interface ProfileData {
  id: string;
  email: string;
  email_confirmed: boolean;
  created_at: string;
  last_sign_in: string | null;
  profile: {
    id: string;
    user_type: 'owner' | 'customer' | 'both' | 'admin';
    full_name: string | null;
    phone_number: string | null;
    created_at: string;
    updated_at: string;
  } | null;
  statistics: {
    businessCount: number;
    bookingCount: number;
  };
  businesses: Array<{
    id: string;
    salon_name: string;
    booking_link: string;
    location: string | null;
    created_at: string;
  }>;
  recentBookings: Array<{
    id: string;
    booking_id: string;
    status: string;
    business_name: string;
    slot_date: string | null;
    slot_time: string | null;
    created_at: string;
  }>;
}

export default function ProfilePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profileData, setProfileData] = useState<ProfileData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [formData, setFormData] = useState({
    full_name: '',
    phone_number: '',
  });
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [secureBusinessUrls, setSecureBusinessUrls] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    const fetchProfile = async () => {
      if (!supabase) {
        router.push(ROUTES.AUTH_LOGIN(ROUTES.PROFILE));
        return;
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.user) {
        router.push(ROUTES.AUTH_LOGIN(ROUTES.PROFILE));
        return;
      }

      try {
        const response = await fetch('/api/user/profile', {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
          console.error('[PROFILE] API error:', response.status, errorData);
          if (response.status === 401) {
            router.push(ROUTES.AUTH_LOGIN(ROUTES.PROFILE));
            return;
          }
          setError(errorData.error || `Failed to fetch profile (${response.status})`);
          setLoading(false);
          return;
        }

        const result = await response.json();
        console.log('[PROFILE] API response:', { success: result.success, hasData: !!result.data });

        if (result.success && result.data) {
          setProfileData(result.data);
          setFormData({
            full_name: result.data.profile?.full_name || '',
            phone_number: result.data.profile?.phone_number || '',
          });

          // Generate secure URLs for businesses
          if (result.data.businesses && result.data.businesses.length > 0) {
            const urlMap = new Map<string, string>();
            for (const business of result.data.businesses) {
              try {
                const secureUrl = await getSecureOwnerDashboardUrlClient(business.booking_link);
                urlMap.set(business.booking_link, secureUrl);
              } catch (err) {
                console.warn('[PROFILE] Failed to generate secure URL for business:', err);
                urlMap.set(business.booking_link, getOwnerDashboardUrl(business.booking_link));
              }
            }
            setSecureBusinessUrls(urlMap);
          }
        } else {
          console.error('[PROFILE] API returned unsuccessful:', result);
          setError(result.error || 'Failed to load profile');
        }
      } catch (err) {
        console.error('[PROFILE] Fetch error:', err);
        setError(err instanceof Error ? err.message : 'Failed to load profile');
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [router]);

  const handleSave = async () => {
    if (!supabase) return;

    setSaving(true);
    setSaveMessage(null);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('Session expired');
      }

      const csrfToken = await getCSRFToken();
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      };
      if (csrfToken) {
        headers['x-csrf-token'] = csrfToken;
      }

      const response = await fetch('/api/user/profile', {
        method: 'PATCH',
        headers,
        credentials: 'include',
        body: JSON.stringify(formData),
      });

      const result = await response.json();

      if (result.success) {
        setSaveMessage('Profile updated successfully');
        setEditMode(false);
        // Refresh profile data
        const refreshResponse = await fetch('/api/user/profile', {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        });
        const refreshResult = await refreshResponse.json();
        if (refreshResult.success && refreshResult.data) {
          setProfileData(refreshResult.data);
        }
        setTimeout(() => setSaveMessage(null), 3000);
      } else {
        setError(result.error || 'Failed to update profile');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const getUserTypeLabel = (type: string) => {
    switch (type) {
      case 'owner':
        return 'Business Owner';
      case 'customer':
        return 'Customer';
      case 'both':
        return 'Owner & Customer';
      case 'admin':
        return 'Administrator';
      default:
        return 'Unknown';
    }
  };

  const getUserTypeColor = (type: string) => {
    switch (type) {
      case 'owner':
        return 'bg-slate-100 text-slate-800';
      case 'customer':
        return 'bg-slate-100 text-slate-800';
      case 'both':
        return 'bg-slate-200 text-slate-900';
      case 'admin':
        return 'bg-slate-900 text-white';
      default:
        return 'bg-slate-100 text-slate-800';
    }
  };

  if (loading) {
    return <ProfileSkeleton />;
  }

  if (error && !profileData) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-4">
        <div className="max-w-md w-full rounded-2xl border border-slate-200 bg-white p-8 shadow-sm text-center">
          <h2 className="text-xl font-semibold text-slate-900 mb-2">Error</h2>
          <p className="text-sm text-slate-500 mb-6">{error}</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={() => window.location.reload()}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-slate-800 transition-colors"
            >
              Retry
            </button>
            <button
              onClick={() => router.push(ROUTES.HOME)}
              className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 transition-colors"
            >
              Go to Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!profileData) {
    return <ProfileSkeleton />;
  }

  return (
    <div className="min-h-screen bg-white flex overflow-x-hidden">
      <div className="flex-1 w-full">
        <div className="w-full max-w-full lg:max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="mb-8 hidden md:block">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">My Profile</h1>
            <p className="text-gray-600">Manage your account information and preferences</p>
          </div>

          <div className="space-y-8">
            {/* Account Information */}
            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between gap-3 mb-6 flex-wrap">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">Account information</h3>
                  <p className="text-sm text-slate-500 mt-0.5">Your profile and sign-in details</p>
                </div>
                {!editMode && (
                  <button
                    onClick={() => setEditMode(true)}
                    className="shrink-0 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 transition-colors"
                  >
                    Edit profile
                  </button>
                )}
              </div>

              {saveMessage && (
                <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                  {saveMessage}
                </div>
              )}

              {error && (
                <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {error}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-medium uppercase tracking-wider text-slate-500 mb-2">
                    Full name
                  </label>
                  {editMode ? (
                    <input
                      type="text"
                      value={formData.full_name}
                      onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-slate-900 focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                      placeholder="Enter your full name"
                    />
                  ) : (
                    <p className="text-slate-900">{profileData.profile?.full_name || 'Not set'}</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-medium uppercase tracking-wider text-slate-500 mb-2">
                    Email
                  </label>
                  <p className="text-slate-900">{profileData.email || 'N/A'}</p>
                  {profileData.email && profileData.email_confirmed ? (
                    <span className="text-xs text-slate-500 mt-1">Verified</span>
                  ) : profileData.email ? (
                    <span className="text-xs text-amber-600 mt-1">Not verified</span>
                  ) : null}
                </div>

                <div>
                  <label className="block text-xs font-medium uppercase tracking-wider text-slate-500 mb-2">
                    Phone
                  </label>
                  {editMode ? (
                    <input
                      type="tel"
                      value={formData.phone_number}
                      onChange={(e) => setFormData({ ...formData, phone_number: e.target.value })}
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-slate-900 focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                      placeholder="+1234567890"
                    />
                  ) : (
                    <p className="text-slate-900">
                      {profileData.profile?.phone_number || 'Not set'}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-medium uppercase tracking-wider text-slate-500 mb-2">
                    Account type
                  </label>
                  {profileData.profile ? (
                    <span
                      className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${getUserTypeColor(profileData.profile.user_type)}`}
                    >
                      {getUserTypeLabel(profileData.profile.user_type)}
                    </span>
                  ) : (
                    <p className="text-slate-500">No profile created yet</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-medium uppercase tracking-wider text-slate-500 mb-2">
                    Account created
                  </label>
                  <p className="text-slate-900">
                    {profileData.created_at ? formatDate(profileData.created_at) : 'N/A'}
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-medium uppercase tracking-wider text-slate-500 mb-2">
                    Last sign-in
                  </label>
                  <p className="text-slate-900">
                    {profileData.last_sign_in ? formatDate(profileData.last_sign_in) : 'Never'}
                  </p>
                </div>
              </div>

              {editMode && (
                <div className="mt-6 flex gap-3">
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-slate-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {saving ? 'Saving...' : 'Save changes'}
                  </button>
                  <button
                    onClick={() => {
                      setEditMode(false);
                      setFormData({
                        full_name: profileData.profile?.full_name || '',
                        phone_number: profileData.profile?.phone_number || '',
                      });
                      setError(null);
                    }}
                    disabled={saving}
                    className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </section>

            {/* Statistics */}
            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-slate-900 mb-1">Overview</h3>
              <p className="text-sm text-slate-500 mt-0.5 mb-6">Your businesses and bookings</p>
              <div className="grid grid-cols-2 md:grid-cols-2 gap-4">
                <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-5">
                  <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
                    Total businesses
                  </p>
                  <p className="mt-2 text-2xl font-bold tracking-tight text-slate-900">
                    {profileData.statistics.businessCount}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-5">
                  <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
                    Total bookings
                  </p>
                  <p className="mt-2 text-2xl font-bold tracking-tight text-slate-900">
                    {profileData.statistics.bookingCount}
                  </p>
                </div>
              </div>
            </section>

            {/* Businesses (if owner) */}
            {profileData.businesses.length > 0 && (
              <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex items-center justify-between gap-3 mb-6 flex-wrap">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900">My businesses</h3>
                    <p className="text-sm text-slate-500 mt-0.5">Manage and view your businesses</p>
                  </div>
                  <Link
                    href={ROUTES.SETUP}
                    className="shrink-0 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-slate-800 transition-colors"
                  >
                    + Add business
                  </Link>
                </div>
                <div className="rounded-xl border border-slate-200">
                  <div className="overflow-x-auto">
                    <table className="min-w-[700px] w-full divide-y divide-slate-200">
                      <thead className="bg-slate-50">
                        <tr>
                          <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">
                            Business name
                          </th>
                          <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">
                            Location
                          </th>
                          <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">
                            Created
                          </th>
                          <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {profileData.businesses.map((business) => (
                          <tr key={business.id} className="hover:bg-slate-50/80 transition-colors">
                            <td className="px-5 py-4">
                              <div className="text-sm font-medium text-slate-900">
                                {business.salon_name}
                              </div>
                              <div className="text-xs text-slate-500">{business.booking_link}</div>
                            </td>
                            <td className="px-5 py-4 text-sm text-slate-600">
                              {business.location || 'N/A'}
                            </td>
                            <td className="px-5 py-4 text-sm text-slate-600">
                              {formatDate(business.created_at)}
                            </td>
                            <td className="px-5 py-4 text-sm font-medium">
                              <Link
                                href={
                                  secureBusinessUrls.get(business.booking_link) ||
                                  getOwnerDashboardUrl(business.booking_link)
                                }
                                className="text-slate-900 hover:text-slate-700"
                              >
                                Manage →
                              </Link>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </section>
            )}

            {/* Quick Actions */}
            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-slate-900 mb-1">Quick actions</h3>
              <p className="text-sm text-slate-500 mt-0.5 mb-6">
                Shortcuts to dashboards and booking
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {(profileData.profile?.user_type === 'owner' ||
                  profileData.profile?.user_type === 'both') && (
                  <Link
                    href={ROUTES.OWNER_DASHBOARD_BASE}
                    className="rounded-xl border border-slate-200 bg-slate-50/50 p-5 hover:bg-slate-50 hover:border-slate-300 transition-colors"
                  >
                    <div className="font-semibold text-slate-900">Owner dashboard</div>
                    <div className="text-sm text-slate-500 mt-0.5">Manage your businesses</div>
                  </Link>
                )}
                {(profileData.profile?.user_type === 'customer' ||
                  profileData.profile?.user_type === 'both') && (
                  <Link
                    href={ROUTES.CUSTOMER_DASHBOARD}
                    className="rounded-xl border border-slate-200 bg-slate-50/50 p-5 hover:bg-slate-50 hover:border-slate-300 transition-colors"
                  >
                    <div className="font-semibold text-slate-900">Customer dashboard</div>
                    <div className="text-sm text-slate-500 mt-0.5">View your bookings</div>
                  </Link>
                )}
                {(profileData.profile?.user_type === 'owner' ||
                  profileData.profile?.user_type === 'both') && (
                  <Link
                    href={ROUTES.SETUP}
                    className="rounded-xl border border-slate-200 bg-slate-50/50 p-5 hover:bg-slate-50 hover:border-slate-300 transition-colors"
                  >
                    <div className="font-semibold text-slate-900">Create business</div>
                    <div className="text-sm text-slate-500 mt-0.5">Add a new business</div>
                  </Link>
                )}
                {profileData.profile?.user_type === 'admin' && (
                  <Link
                    href={ROUTES.ADMIN_DASHBOARD}
                    className="rounded-xl border border-slate-200 bg-slate-50/50 p-5 hover:bg-slate-50 hover:border-slate-300 transition-colors"
                  >
                    <div className="font-semibold text-slate-900">Admin dashboard</div>
                    <div className="text-sm text-slate-500 mt-0.5">Platform management</div>
                  </Link>
                )}
                <Link
                  href={ROUTES.CATEGORIES}
                  className="rounded-xl border border-slate-200 bg-slate-50/50 p-5 hover:bg-slate-50 hover:border-slate-300 transition-colors"
                >
                  <div className="font-semibold text-slate-900">Book a service</div>
                  <div className="text-sm text-slate-500 mt-0.5">Find and book services</div>
                </Link>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
