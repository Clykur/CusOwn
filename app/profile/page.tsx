'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabaseAuth } from '@/lib/supabase/auth';
import { ROUTES, getOwnerDashboardUrl, getSecureOwnerDashboardUrlClient } from '@/lib/utils/navigation';
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
      if (!supabaseAuth) {
        router.push(ROUTES.AUTH_LOGIN(ROUTES.PROFILE));
        return;
      }

      const { data: { session } } = await supabaseAuth.auth.getSession();
      if (!session?.user) {
        router.push(ROUTES.AUTH_LOGIN(ROUTES.PROFILE));
        return;
      }

      try {
        const response = await fetch('/api/user/profile', {
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
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
    if (!supabaseAuth) return;

    setSaving(true);
    setSaveMessage(null);

    try {
      const { data: { session } } = await supabaseAuth.auth.getSession();
      if (!session?.access_token) {
        throw new Error('Session expired');
      }

      const csrfToken = await getCSRFToken();
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
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
            'Authorization': `Bearer ${session.access_token}`,
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
      case 'owner': return 'Business Owner';
      case 'customer': return 'Customer';
      case 'both': return 'Owner & Customer';
      case 'admin': return 'Administrator';
      default: return 'Unknown';
    }
  };

  const getUserTypeColor = (type: string) => {
    switch (type) {
      case 'owner': return 'bg-gray-100 text-gray-800';
      case 'customer': return 'bg-gray-100 text-gray-800';
      case 'both': return 'bg-gray-200 text-gray-900';
      case 'admin': return 'bg-black text-white';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return <ProfileSkeleton />;
  }

  if (error && !profileData) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white border border-gray-200 rounded-lg p-8 text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Error</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <div className="space-y-3">
            <button
              onClick={() => window.location.reload()}
              className="w-full px-6 py-3 bg-black text-white font-semibold rounded-lg hover:bg-gray-900 transition-colors"
            >
              Retry
            </button>
            <button
              onClick={() => router.push(ROUTES.HOME)}
              className="w-full px-6 py-3 bg-gray-200 text-gray-800 font-semibold rounded-lg hover:bg-gray-300 transition-colors"
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
    <div className="min-h-screen bg-white flex">
      <div className="flex-1 lg:ml-64">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">My Profile</h1>
          <p className="text-gray-600">Manage your account information and preferences</p>
        </div>

        {/* Account Information */}
        <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
          <div className="flex justify-between items-start mb-6">
            <h2 className="text-xl font-bold text-gray-900">Account Information</h2>
            {!editMode && (
              <button
                onClick={() => setEditMode(true)}
                className="px-4 py-2 bg-gray-200 text-gray-800 font-semibold rounded-lg hover:bg-gray-300 transition-colors"
              >
                Edit Profile
              </button>
            )}
          </div>

          {saveMessage && (
            <div className="mb-4 p-3 bg-gray-50 border border-gray-200 text-gray-800 rounded text-sm">
              {saveMessage}
            </div>
          )}

          {error && (
            <div className="mb-4 p-3 bg-gray-100 border border-gray-300 text-gray-900 rounded text-sm">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Full Name</label>
              {editMode ? (
                <input
                  type="text"
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent"
                  placeholder="Enter your full name"
                />
              ) : (
                <p className="text-gray-900">{profileData.profile?.full_name || 'Not set'}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
              <p className="text-gray-900">{profileData.email || 'N/A'}</p>
              {profileData.email && profileData.email_confirmed ? (
                <span className="text-xs text-gray-500 mt-1">✓ Verified</span>
              ) : profileData.email ? (
                <span className="text-xs text-gray-500 mt-1">⚠ Not verified</span>
              ) : null}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Phone Number</label>
              {editMode ? (
                <input
                  type="tel"
                  value={formData.phone_number}
                  onChange={(e) => setFormData({ ...formData, phone_number: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent"
                  placeholder="+1234567890"
                />
              ) : (
                <p className="text-gray-900">{profileData.profile?.phone_number || 'Not set'}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Account Type</label>
              {profileData.profile ? (
                <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${getUserTypeColor(profileData.profile.user_type)}`}>
                  {getUserTypeLabel(profileData.profile.user_type)}
                </span>
              ) : (
                <p className="text-gray-500">No profile created yet</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Account Created</label>
              <p className="text-gray-900">{profileData.created_at ? formatDate(profileData.created_at) : 'N/A'}</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Last Sign In</label>
              <p className="text-gray-900">
                {profileData.last_sign_in ? formatDate(profileData.last_sign_in) : 'Never'}
              </p>
            </div>
          </div>

          {editMode && (
            <div className="mt-6 flex gap-3">
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-6 py-2 bg-black text-white font-semibold rounded-lg hover:bg-gray-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? 'Saving...' : 'Save Changes'}
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
                className="px-6 py-2 bg-gray-200 text-gray-800 font-semibold rounded-lg hover:bg-gray-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
            </div>
          )}
        </div>

        {/* Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          {profileData.statistics.businessCount > 0 && (
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <div className="text-sm text-gray-600 mb-1">Total Businesses</div>
              <div className="text-3xl font-bold text-gray-900">{profileData.statistics.businessCount}</div>
            </div>
          )}
          {profileData.statistics.bookingCount > 0 && (
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <div className="text-sm text-gray-600 mb-1">Total Bookings</div>
              <div className="text-3xl font-bold text-gray-900">{profileData.statistics.bookingCount}</div>
            </div>
          )}
        </div>

        {/* Businesses Section (if owner) */}
        {profileData.businesses.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-gray-900">My Businesses</h2>
              <Link
                href={ROUTES.SETUP}
                className="px-4 py-2 bg-black text-white font-semibold rounded-lg hover:bg-gray-900 transition-colors text-sm"
              >
                + Add Business
              </Link>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Business Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Location
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Created
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {profileData.businesses.map((business) => (
                    <tr key={business.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{business.salon_name}</div>
                        <div className="text-sm text-gray-500">{business.booking_link}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {business.location || 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatDate(business.created_at)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <Link
                          href={secureBusinessUrls.get(business.booking_link) || getOwnerDashboardUrl(business.booking_link)}
                          className="text-black hover:text-gray-700"
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
        )}

        {/* Recent Bookings (if customer) */}
        {profileData.recentBookings.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-gray-900">Recent Bookings</h2>
              <Link
                href={ROUTES.CUSTOMER_DASHBOARD}
                className="text-sm text-gray-600 hover:text-gray-900"
              >
                View All →
              </Link>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Booking ID
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Business
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date & Time
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {profileData.recentBookings.map((booking) => (
                    <tr key={booking.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm font-mono text-gray-900">{booking.booking_id}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {booking.business_name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {booking.slot_date ? (
                          <div>
                            <div>{formatDate(booking.slot_date)}</div>
                            {booking.slot_time && <div className="text-xs">{booking.slot_time}</div>}
                          </div>
                        ) : (
                          'N/A'
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          booking.status === 'confirmed' ? 'bg-black text-white' :
                          booking.status === 'pending' ? 'bg-gray-200 text-black' :
                          booking.status === 'rejected' ? 'bg-gray-300 text-black' :
                          'bg-gray-100 text-black'
                        }`}>
                          {booking.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Quick Actions */}
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Quick Actions</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {profileData.profile?.user_type === 'owner' || profileData.profile?.user_type === 'both' ? (
              <Link
                href={ROUTES.OWNER_DASHBOARD_BASE}
                className="p-4 border border-gray-200 rounded-lg hover:border-black transition-colors"
              >
                <div className="font-semibold text-gray-900 mb-1">Owner Dashboard</div>
                <div className="text-sm text-gray-600">Manage your businesses</div>
              </Link>
            ) : null}
            {profileData.profile?.user_type === 'customer' || profileData.profile?.user_type === 'both' ? (
              <Link
                href={ROUTES.CUSTOMER_DASHBOARD}
                className="p-4 border border-gray-200 rounded-lg hover:border-black transition-colors"
              >
                <div className="font-semibold text-gray-900 mb-1">Customer Dashboard</div>
                <div className="text-sm text-gray-600">View your bookings</div>
              </Link>
            ) : null}
            {profileData.profile?.user_type === 'owner' || profileData.profile?.user_type === 'both' ? (
              <Link
                href={ROUTES.SETUP}
                className="p-4 border border-gray-200 rounded-lg hover:border-black transition-colors"
              >
                <div className="font-semibold text-gray-900 mb-1">Create Business</div>
                <div className="text-sm text-gray-600">Add a new business</div>
              </Link>
            ) : null}
            {profileData.profile?.user_type === 'admin' && (
              <Link
                href={ROUTES.ADMIN_DASHBOARD}
                className="p-4 border border-gray-200 rounded-lg hover:border-black transition-colors"
              >
                <div className="font-semibold text-gray-900 mb-1">Admin Dashboard</div>
                <div className="text-sm text-gray-600">Platform management</div>
              </Link>
            )}
            <Link
              href={ROUTES.CATEGORIES}
              className="p-4 border border-gray-200 rounded-lg hover:border-black transition-colors"
            >
              <div className="font-semibold text-gray-900 mb-1">Book a Service</div>
              <div className="text-sm text-gray-600">Find and book services</div>
            </Link>
          </div>
        </div>
        </div>
      </div>
    </div>
  );
}
