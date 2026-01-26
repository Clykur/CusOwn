'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabaseAuth, getUserProfile, isAdmin } from '@/lib/supabase/auth';
import SuccessMetricsDashboard from '@/components/admin/SuccessMetricsDashboard';
import AdminSidebar from '@/components/admin/AdminSidebar';
import { ROUTES } from '@/lib/utils/navigation';
import { getCSRFToken, clearCSRFToken } from '@/lib/utils/csrf-client';
import { Line, Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend
);

interface PlatformMetrics {
  totalBusinesses: number;
  activeBusinesses: number;
  suspendedBusinesses: number;
  totalOwners: number;
  totalCustomers: number;
  totalBookings: number;
  confirmedBookings: number;
  rejectedBookings: number;
  pendingBookings: number;
  cancelledBookings: number;
  bookingsToday: number;
  bookingsThisWeek: number;
  bookingsThisMonth: number;
  growthRate: {
    businesses: number;
    bookings: number;
    owners: number;
  };
}

interface BookingTrend {
  date: string;
  total: number;
  confirmed: number;
  rejected: number;
}

function AdminDashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<PlatformMetrics | null>(null);
  const [trends, setTrends] = useState<BookingTrend[]>([]);
  const [activeTab, setActiveTab] = useState<'overview' | 'businesses' | 'users' | 'bookings' | 'audit' | 'success-metrics'>('overview');

  useEffect(() => {
    const tab = searchParams?.get('tab') as typeof activeTab;
    if (tab && ['overview', 'businesses', 'users', 'bookings', 'audit', 'success-metrics'].includes(tab)) {
      setActiveTab(tab);
    } else if (!tab) {
      setActiveTab('overview');
    }
  }, [searchParams]);

  useEffect(() => {
    const checkAuth = async () => {
      if (!supabaseAuth) {
        setError('Supabase is not configured');
        setLoading(false);
        return;
      }

      if (!supabaseAuth) {
        setError('Supabase is not configured');
        setLoading(false);
        return;
      }
      const { data: { session } } = await supabaseAuth.auth.getSession();
      
      if (!session?.user) {
        router.push(ROUTES.AUTH_LOGIN(ROUTES.ADMIN_DASHBOARD));
        return;
      }

      setUser(session.user);

      // Debug: Log session info
      console.log('[Admin Dashboard] Session info:', {
        hasUser: !!session.user,
        hasToken: !!session.access_token,
        tokenLength: session.access_token?.length,
        userEmail: session.user?.email,
      });

      // Check admin status with detailed info
      const statusRes = await fetch('/api/admin/check-status', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });
      
      console.log('[Admin Dashboard] Check-status response:', {
        status: statusRes.status,
        ok: statusRes.ok,
      });
      
      const statusData = await statusRes.json();
      
      console.log('[Admin Dashboard] Check-status data:', statusData);
      
      if (!statusData.success) {
        const errorMsg = statusData.error || 'Failed to check admin status';
        console.error('[Admin Dashboard] Check-status failed:', errorMsg);
        setError(errorMsg);
        setLoading(false);
        return;
      }

      const { is_admin, user_type, profile_exists } = statusData.data;

      if (!is_admin) {
        // Show helpful error message
        if (!profile_exists) {
          setError(`Your profile doesn't exist yet. User type: ${user_type || 'none'}. Please contact support or use the migration query to set admin status.`);
        } else {
          setError(`You don't have admin access. Current user type: ${user_type}. Please run the migration query to set your account as admin.`);
        }
        setLoading(false);
        return;
      }

      await loadDashboardData();
      setLoading(false);
    };

    checkAuth();
  }, [router]);

  const loadDashboardData = async () => {
    try {
      // Get session token for API calls
      if (!supabaseAuth) {
        setError('Supabase not configured');
        return;
      }
      const { data: { session } } = await supabaseAuth.auth.getSession();
      if (!session) {
        setError('Session expired. Please log in again.');
        return;
      }

      const authHeaders = {
        'Authorization': `Bearer ${session.access_token}`,
      };

      const [metricsRes, trendsRes] = await Promise.all([
        fetch('/api/admin/metrics', { headers: authHeaders }),
        fetch('/api/admin/trends?days=30', { headers: authHeaders }),
      ]);

      if (!metricsRes.ok || !trendsRes.ok) {
        throw new Error('Failed to load dashboard data');
      }

      const metricsData = await metricsRes.json();
      const trendsData = await trendsRes.json();

      if (metricsData.success) {
        setMetrics(metricsData.data);
      }
      if (trendsData.success) {
        setTrends(trendsData.data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading admin dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Access Denied</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          
          {error.includes('migration') && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4 text-left">
              <p className="text-sm text-yellow-800 mb-2">
                <strong>To fix this:</strong>
              </p>
              <ol className="text-sm text-yellow-700 list-decimal list-inside space-y-1">
                <li>Go to Supabase Dashboard → SQL Editor</li>
                <li>Run the migration query from <code className="bg-yellow-100 px-1 rounded">database/migration_set_admin_quick.sql</code></li>
                <li>Refresh this page</li>
              </ol>
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={() => router.push(ROUTES.HOME)}
              className="flex-1 px-6 py-3 bg-black text-white font-semibold rounded-lg hover:bg-gray-900 transition-colors"
            >
              Go to Home
            </button>
            {user?.email === 'chinnuk0521@gmail.com' && (
              <button
                onClick={async () => {
                  try {
                    if (!supabaseAuth) {
                      alert('Supabase not configured');
                      return;
                    }
                    const { data: { session } } = await supabaseAuth.auth.getSession();
                    if (!session) {
                      alert('Session expired. Please log in again.');
                      return;
                    }
                    const csrfToken = await getCSRFToken();
                    const headers: Record<string, string> = {
                      'Content-Type': 'application/json',
                      'Authorization': `Bearer ${session.access_token}`,
                    };
                    if (csrfToken) {
                      headers['x-csrf-token'] = csrfToken;
                    }
                    const res = await fetch('/api/admin/check-status', {
                      method: 'POST',
                      headers,
                      credentials: 'include',
                      body: JSON.stringify({ email: user.email }),
                    });
                    const data = await res.json();
                    if (data.success) {
                      alert('Admin status set! Please refresh the page.');
                      window.location.reload();
                    } else {
                      alert('Failed to set admin status: ' + (data.error || 'Unknown error'));
                    }
                  } catch (err) {
                    alert('Error: ' + (err instanceof Error ? err.message : 'Unknown error'));
                  }
                }}
                className="flex-1 px-6 py-3 bg-gray-200 text-gray-800 font-semibold rounded-lg hover:bg-gray-300 transition-colors"
              >
                Try Set Admin
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Bar chart for Booking Trends (30 Days) - using different shades of black/gray
  const bookingTrendsChart = {
    labels: trends.map(t => {
      const date = new Date(t.date);
      return `${date.getMonth() + 1}/${date.getDate()}`;
    }),
    datasets: [
      {
        label: 'Total Bookings',
        data: trends.map(t => t.total),
        backgroundColor: 'rgb(0, 0, 0)', // Pure black
        borderColor: 'rgb(0, 0, 0)',
        borderWidth: 2,
      },
      {
        label: 'Confirmed',
        data: trends.map(t => t.confirmed),
        backgroundColor: 'rgb(64, 64, 64)', // Dark gray
        borderColor: 'rgb(64, 64, 64)',
        borderWidth: 2,
      },
      {
        label: 'Rejected',
        data: trends.map(t => t.rejected),
        backgroundColor: 'rgb(128, 128, 128)', // Medium gray
        borderColor: 'rgb(128, 128, 128)',
        borderWidth: 2,
      },
    ],
  };

  // Bar chart for Booking Status Distribution - using different shades
  const bookingStatusChart = metrics ? {
    labels: ['Confirmed', 'Pending', 'Rejected', 'Cancelled'],
    datasets: [
      {
        label: 'Number of Bookings',
        data: [
          metrics.confirmedBookings,
          metrics.pendingBookings,
          metrics.rejectedBookings,
          metrics.cancelledBookings,
        ],
        backgroundColor: [
          'rgb(0, 0, 0)',        // Pure black - Confirmed
          'rgb(64, 64, 64)',     // Dark gray - Pending
          'rgb(128, 128, 128)',  // Medium gray - Rejected
          'rgb(192, 192, 192)',  // Light gray - Cancelled
        ],
        borderColor: 'rgb(0, 0, 0)',
        borderWidth: 2,
      },
    ],
  } : null;

  // Line chart for Growth Trends - single line with different point colors
  const growthChart = metrics ? {
    labels: ['Businesses', 'Bookings', 'Owners'],
    datasets: [
      {
        label: 'Growth Rate (%)',
        data: [
          metrics.growthRate.businesses,
          metrics.growthRate.bookings,
          metrics.growthRate.owners,
        ],
        borderColor: 'rgb(0, 0, 0)', // Pure black line
        backgroundColor: 'rgba(0, 0, 0, 0.1)',
        borderWidth: 3,
        tension: 0.4,
        fill: true,
        pointRadius: 8,
        pointBackgroundColor: [
          'rgb(0, 0, 0)',        // Pure black for Businesses
          'rgb(64, 64, 64)',     // Dark gray for Bookings
          'rgb(128, 128, 128)',  // Medium gray for Owners
        ],
        pointBorderColor: 'rgb(0, 0, 0)',
        pointBorderWidth: 2,
      },
    ],
  } : null;

  return (
    <div className="min-h-screen bg-white flex">
      <AdminSidebar />
      <div className="flex-1 lg:ml-64">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Admin Dashboard</h1>
            <p className="text-gray-600">Platform-wide metrics and management</p>
          </div>

        {activeTab === 'overview' && metrics && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <div className="text-sm text-gray-600 mb-1">Total Businesses</div>
                <div className="text-3xl font-bold text-gray-900">{metrics.totalBusinesses}</div>
                <div className="text-xs text-gray-500 mt-2">
                  {metrics.growthRate.businesses > 0 ? '+' : ''}
                  {metrics.growthRate.businesses.toFixed(1)}% growth
                </div>
              </div>

              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <div className="text-sm text-gray-600 mb-1">Active Businesses</div>
                <div className="text-3xl font-bold text-gray-900">{metrics.activeBusinesses}</div>
                <div className="text-xs text-gray-500 mt-2">
                  {metrics.suspendedBusinesses} suspended
                </div>
              </div>

              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <div className="text-sm text-gray-600 mb-1">Total Bookings</div>
                <div className="text-3xl font-bold text-gray-900">{metrics.totalBookings}</div>
                <div className="text-xs text-gray-500 mt-2">
                  {metrics.growthRate.bookings > 0 ? '+' : ''}
                  {metrics.growthRate.bookings.toFixed(1)}% growth
                </div>
              </div>

              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <div className="text-sm text-gray-600 mb-1">Total Owners</div>
                <div className="text-3xl font-bold text-gray-900">{metrics.totalOwners}</div>
                <div className="text-xs text-gray-500 mt-2">
                  {metrics.growthRate.owners > 0 ? '+' : ''}
                  {metrics.growthRate.owners.toFixed(1)}% growth
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <div className="text-sm text-gray-600 mb-1">Bookings Today</div>
                <div className="text-3xl font-bold text-gray-900">{metrics.bookingsToday}</div>
              </div>

              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <div className="text-sm text-gray-600 mb-1">This Week</div>
                <div className="text-3xl font-bold text-gray-900">{metrics.bookingsThisWeek}</div>
              </div>

              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <div className="text-sm text-gray-600 mb-1">This Month</div>
                <div className="text-3xl font-bold text-gray-900">{metrics.bookingsThisMonth}</div>
              </div>

              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <div className="text-sm text-gray-600 mb-1">Total Customers</div>
                <div className="text-3xl font-bold text-gray-900">{metrics.totalCustomers}</div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Booking Trends (30 Days)</h3>
                {trends.length > 0 ? (
                  <Bar
                    data={bookingTrendsChart}
                    options={{
                      responsive: true,
                      plugins: {
                        legend: {
                          position: 'top' as const,
                        },
                        title: {
                          display: false,
                        },
                      },
                      scales: {
                        y: {
                          beginAtZero: true,
                        },
                      },
                    }}
                  />
                ) : (
                  <p className="text-gray-500 text-center py-8">No data available</p>
                )}
              </div>

              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Booking Status Distribution</h3>
                {bookingStatusChart ? (
                  <Bar
                    data={bookingStatusChart}
                    options={{
                      responsive: true,
                      plugins: {
                        legend: {
                          position: 'top' as const,
                        },
                      },
                      scales: {
                        y: {
                          beginAtZero: true,
                        },
                      },
                    }}
                  />
                ) : (
                  <p className="text-gray-500 text-center py-8">No data available</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-6">
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Growth Trends</h3>
                {growthChart ? (
                  <Line
                    data={growthChart}
                    options={{
                      responsive: true,
                      plugins: {
                        legend: {
                          position: 'top' as const,
                        },
                        title: {
                          display: false,
                        },
                      },
                      scales: {
                        y: {
                          beginAtZero: true,
                        },
                      },
                    }}
                  />
                ) : (
                  <p className="text-gray-500 text-center py-8">No data available</p>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'businesses' && (
          <BusinessesTab />
        )}

        {activeTab === 'users' && (
          <UsersTab />
        )}

        {activeTab === 'bookings' && (
          <BookingsTab />
        )}

        {activeTab === 'audit' && (
          <AuditLogsTab />
        )}

        {activeTab === 'success-metrics' && (
          <SuccessMetricsDashboard />
        )}
        </div>
      </div>
    </div>
  );
}

export default function AdminDashboardPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    }>
      <AdminDashboardContent />
    </Suspense>
  );
}

function BusinessesTab() {
  const router = useRouter();
  const [businesses, setBusinesses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadBusinesses();
  }, []);

  const loadBusinesses = async () => {
    try {
      if (!supabaseAuth) {
        console.error('Supabase not configured');
        setLoading(false);
        return;
      }
      const { data: { session } } = await supabaseAuth.auth.getSession();
      if (!session) {
        console.error('No session found');
        setLoading(false);
        return;
      }

      const res = await fetch('/api/admin/businesses', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });
      const data = await res.json();
      if (data.success) {
        setBusinesses(data.data);
      } else {
        console.error('Failed to load businesses:', data.error);
      }
    } catch (err) {
      console.error('Failed to load businesses:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="text-center py-8 text-gray-600">Loading businesses...</div>;
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Business Name
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Owner
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Location
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Bookings
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {businesses.map((business) => (
              <tr key={business.id}>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-gray-900">{business.salon_name || business.name || 'N/A'}</div>
                  <div className="text-sm text-gray-500">{business.booking_link}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900">{business.owner?.full_name || business.owner_name}</div>
                  <div className="text-sm text-gray-500">{business.owner?.email || 'N/A'}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {business.location || 'N/A'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {business.bookingCount || 0}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                    business.suspended
                      ? 'bg-red-100 text-red-800'
                      : 'bg-green-100 text-green-800'
                  }`}>
                    {business.suspended ? 'Suspended' : 'Active'}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  <button
                    onClick={() => router.push(ROUTES.ADMIN_BUSINESS(business.id))}
                    className="text-black hover:text-gray-700 mr-4"
                  >
                    Edit
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function UsersTab() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      if (!supabaseAuth) {
        console.error('Supabase not configured');
        setLoading(false);
        return;
      }
      const { data: { session } } = await supabaseAuth.auth.getSession();
      if (!session) {
        console.error('No session found');
        setLoading(false);
        return;
      }

      const res = await fetch('/api/admin/users', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });
      const data = await res.json();
      if (data.success) {
        setUsers(data.data);
      } else {
        console.error('Failed to load users:', data.error);
      }
    } catch (err) {
      console.error('Failed to load users:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="text-center py-8 text-gray-600">Loading users...</div>;
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Name
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Email
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Type
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Businesses
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Bookings
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {users.map((user) => (
              <tr key={user.id}>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  {user.full_name || 'N/A'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {user.email}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-800">
                    {user.user_type}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {user.businesses?.length || 0}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {user.bookingCount || 0}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function BookingsTab() {
  const router = useRouter();
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadBookings();
  }, []);

  const loadBookings = async () => {
    try {
      if (!supabaseAuth) {
        console.error('Supabase not configured');
        setLoading(false);
        return;
      }
      const { data: { session } } = await supabaseAuth.auth.getSession();
      if (!session) {
        console.error('No session found');
        setLoading(false);
        return;
      }

      const res = await fetch('/api/admin/bookings?limit=50', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });
      const data = await res.json();
      if (data.success) {
        setBookings(data.data);
      } else {
        console.error('Failed to load bookings:', data.error);
      }
    } catch (err) {
      console.error('Failed to load bookings:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="text-center py-8 text-gray-600">Loading bookings...</div>;
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Customer
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
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {bookings.map((booking) => (
              <tr key={booking.id}>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-gray-900">{booking.customer_name}</div>
                  <div className="text-sm text-gray-500">{booking.customer_phone}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {booking.business?.salon_name || booking.business?.name || 'N/A'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {booking.slot ? (
                    <>
                      {new Date(booking.slot.date).toLocaleDateString()}
                      <br />
                      {booking.slot.start_time} - {booking.slot.end_time}
                    </>
                  ) : (
                    'N/A'
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                    booking.status === 'confirmed' ? 'bg-green-100 text-green-800' :
                    booking.status === 'rejected' ? 'bg-red-100 text-red-800' :
                    booking.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {booking.status}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  <button
                    onClick={() => router.push(ROUTES.ADMIN_BOOKING(booking.id))}
                    className="text-black hover:text-gray-700"
                  >
                    Manage
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AuditLogsTab() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLog, setSelectedLog] = useState<any>(null);
  const isDev = process.env.NODE_ENV === 'development';

  useEffect(() => {
    loadLogs();
  }, []);

  const loadLogs = async () => {
    try {
      if (!supabaseAuth) {
        console.error('Supabase not configured');
        setLoading(false);
        return;
      }
      const { data: { session } } = await supabaseAuth.auth.getSession();
      if (!session) {
        console.error('No session found');
        setLoading(false);
        return;
      }

      const res = await fetch('/api/admin/audit-logs?limit=100', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });
      const data = await res.json();
      if (data.success) {
        setLogs(data.data);
      } else {
        console.error('Failed to load audit logs:', data.error);
      }
    } catch (err) {
      console.error('Failed to load audit logs:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatAuditDescription = (log: any): string => {
    // If there's a custom description, use it
    if (log.description && !log.description.includes('→')) {
      return log.description;
    }

    // Format based on action type
    const actionType = log.action_type || '';
    const oldData = log.old_data || {};
    const newData = log.new_data || {};

    // Business actions
    if (actionType === 'business_updated' || actionType === 'business_suspended') {
      const changes: string[] = [];
      
      // Check for suspended status change
      if (oldData.suspended !== undefined && newData.suspended !== undefined && oldData.suspended !== newData.suspended) {
        changes.push(newData.suspended ? 'Business was suspended' : 'Business suspension was removed');
        if (newData.suspended && newData.suspended_reason) {
          changes.push(`Reason: ${newData.suspended_reason}`);
        }
      }
      
      // Check for other field changes
      const fields: Record<string, string> = {
        salon_name: 'Business Name',
        owner_name: 'Owner Name',
        whatsapp_number: 'WhatsApp Number',
        opening_time: 'Opening Time',
        closing_time: 'Closing Time',
        slot_duration: 'Slot Duration',
        address: 'Address',
        location: 'Location',
      };

      for (const [key, label] of Object.entries(fields)) {
        if (oldData[key] !== undefined && newData[key] !== undefined && oldData[key] !== newData[key]) {
          const oldVal = oldData[key] === null ? 'Not set' : String(oldData[key]);
          const newVal = newData[key] === null ? 'Not set' : String(newData[key]);
          changes.push(`${label} changed from "${oldVal}" to "${newVal}"`);
        }
      }

      return changes.length > 0 ? changes.join('. ') : 'Business details were updated';
    }

    if (actionType === 'business_created') {
      return `New business "${newData.salon_name || 'Unknown'}" was created`;
    }

    if (actionType === 'business_deleted') {
      return `Business "${oldData.salon_name || 'Unknown'}" was deleted`;
    }

    // User actions
    if (actionType === 'user_updated') {
      const changes: string[] = [];
      if (oldData.user_type !== newData.user_type) {
        changes.push(`User type changed from ${oldData.user_type} to ${newData.user_type}`);
      }
      if (oldData.full_name !== newData.full_name) {
        changes.push(`Name changed from "${oldData.full_name || 'Not set'}" to "${newData.full_name || 'Not set'}"`);
      }
      return changes.length > 0 ? changes.join('. ') : 'User details were updated';
    }

    if (actionType === 'user_created') {
      return `New user "${newData.full_name || newData.email || 'Unknown'}" was created`;
    }

    if (actionType === 'user_deleted') {
      return `User "${oldData.full_name || oldData.email || 'Unknown'}" was deleted`;
    }

    // Booking actions
    if (actionType === 'booking_updated') {
      if (oldData.status !== newData.status) {
        return `Booking status changed from ${oldData.status} to ${newData.status}`;
      }
      return 'Booking details were updated';
    }

    if (actionType === 'booking_cancelled') {
      return 'Booking was cancelled';
    }

    // Default: return the description or a generic message
    if (log.description) {
      // Try to format the technical description
      return log.description
        .replace(/→/g, ' to ')
        .replace(/:/g, ': ')
        .replace(/,/g, ', ');
    }

    return `${actionType.replace(/_/g, ' ')} performed`;
  };

  if (loading) {
    return <div className="text-center py-8 text-gray-600">Loading audit logs...</div>;
  }

  return (
    <div className="space-y-4">
      {isDev && selectedLog && (
        <div className="bg-yellow-50 border-2 border-yellow-200 rounded-lg p-6">
          <div className="flex justify-between items-start mb-4">
            <h3 className="text-lg font-semibold text-yellow-900">Debug Information (Dev Only)</h3>
            <button
              onClick={() => setSelectedLog(null)}
              className="text-yellow-700 hover:text-yellow-900"
            >
              ✕ Close
            </button>
          </div>
          <div className="space-y-4">
            <div>
              <h4 className="font-semibold text-yellow-900 mb-2">Raw Data:</h4>
              <pre className="bg-white p-4 rounded border overflow-auto text-xs">
                {JSON.stringify(selectedLog, null, 2)}
              </pre>
            </div>
            <div>
              <h4 className="font-semibold text-yellow-900 mb-2">Old Data:</h4>
              <pre className="bg-white p-4 rounded border overflow-auto text-xs">
                {JSON.stringify(selectedLog.old_data, null, 2)}
              </pre>
            </div>
            <div>
              <h4 className="font-semibold text-yellow-900 mb-2">New Data:</h4>
              <pre className="bg-white p-4 rounded border overflow-auto text-xs">
                {JSON.stringify(selectedLog.new_data, null, 2)}
              </pre>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Timestamp
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Action
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Entity
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Description
                </th>
                {isDev && (
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Debug
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {logs.map((log) => (
                <tr key={log.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(log.created_at).toLocaleString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-800">
                      {log.action_type?.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {log.entity_type} {log.entity_id ? `(${log.entity_id.substring(0, 8)}...)` : ''}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-700">
                    {formatAuditDescription(log)}
                  </td>
                  {isDev && (
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <button
                        onClick={() => setSelectedLog(selectedLog?.id === log.id ? null : log)}
                        className="px-3 py-1 bg-yellow-100 text-yellow-800 rounded hover:bg-yellow-200 text-xs font-medium"
                      >
                        {selectedLog?.id === log.id ? 'Hide' : 'View'}
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

