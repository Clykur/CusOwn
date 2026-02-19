'use client';

import { useState, useEffect, useCallback } from 'react';
import { formatDate } from '@/lib/utils/string';
import { supabaseAuth } from '@/lib/supabase/auth';
import AnalyticsDashboardSkeleton from '@/components/analytics/analytics-dashboard.skeleton';

interface AnalyticsData {
  totalBookings: number;
  confirmedBookings: number;
  rejectedBookings: number;
  cancelledBookings: number;
  noShowCount: number;
  conversionRate: number;
  cancellationRate: number;
  noShowRate: number;
}

interface DailyData {
  date: string;
  totalBookings: number;
  confirmedBookings: number;
  rejectedBookings: number;
  cancelledBookings: number;
  noShowCount: number;
}

interface PeakHoursData {
  hour: number;
  bookingCount: number;
}

export default function AnalyticsDashboard({ businessId }: { businessId: string }) {
  const [loading, setLoading] = useState(true);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [dailyData, setDailyData] = useState<DailyData[]>([]);
  const [peakHours, setPeakHours] = useState<PeakHoursData[]>([]);
  const [startDate, setStartDate] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() - 30);
    return date.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [exporting, setExporting] = useState(false);

  const fetchAnalytics = useCallback(async () => {
    setLoading(true);
    try {
      // Get session for authentication
      if (!supabaseAuth) {
        throw new Error('Authentication not available');
      }

      const {
        data: { session },
        error: sessionError,
      } = await supabaseAuth.auth.getSession();

      if (sessionError || !session?.access_token) {
        throw new Error('Authentication required');
      }

      const headers = {
        Authorization: `Bearer ${session.access_token}`,
      };

      const [overviewRes, dailyRes, peakRes] = await Promise.all([
        fetch(
          `/api/owner/analytics?business_id=${businessId}&type=overview&start_date=${startDate}&end_date=${endDate}`,
          {
            headers,
            credentials: 'include',
          }
        ),
        fetch(
          `/api/owner/analytics?business_id=${businessId}&type=daily&start_date=${startDate}&end_date=${endDate}`,
          {
            headers,
            credentials: 'include',
          }
        ),
        fetch(
          `/api/owner/analytics?business_id=${businessId}&type=peak-hours&start_date=${startDate}&end_date=${endDate}`,
          {
            headers,
            credentials: 'include',
          }
        ),
      ]);

      if (overviewRes.ok) {
        const overview = await overviewRes.json();
        if (overview.success) setAnalytics(overview.data);
      }
      if (dailyRes.ok) {
        const daily = await dailyRes.json();
        if (daily.success) setDailyData(daily.data);
      }
      if (peakRes.ok) {
        const peak = await peakRes.json();
        if (peak.success) setPeakHours(peak.data);
      }
    } catch (error) {
      console.error('Failed to fetch analytics:', error);
    } finally {
      setLoading(false);
    }
  }, [businessId, startDate, endDate]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  const handleExport = async () => {
    setExporting(true);
    try {
      const response = await fetch(
        `/api/owner/analytics/export?business_id=${businessId}&start_date=${startDate}&end_date=${endDate}`
      );
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `analytics-${businessId}-${startDate}-${endDate}.csv`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }
    } catch (error) {
      console.error('Failed to export:', error);
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return <AnalyticsDashboardSkeleton />;
  }

  return (
    <div className="w-full space-y-6 lg:max-w-6xl lg:mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h2 className="text-lg sm:text-xl font-bold">Analytics</h2>

        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full sm:w-auto border rounded px-3 py-2 text-sm"
          />

          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-full sm:w-auto border rounded px-3 py-2 text-sm"
          />

          <button
            onClick={handleExport}
            disabled={exporting}
            className="w-full sm:w-auto px-4 py-2 bg-black text-white rounded hover:bg-gray-900 disabled:opacity-50 text-sm"
          >
            {exporting ? 'Exporting...' : 'Export CSV'}
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      {analytics && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-lg border">
            <p className="text-sm text-gray-600">Total Bookings</p>
            <p className="text-2xl font-bold">{analytics.totalBookings}</p>
          </div>

          <div className="bg-white p-4 rounded-lg border">
            <p className="text-sm text-gray-600">Confirmed</p>
            <p className="text-2xl font-bold text-green-600">{analytics.confirmedBookings}</p>
          </div>

          <div className="bg-white p-4 rounded-lg border">
            <p className="text-sm text-gray-600">Conversion Rate</p>
            <p className="text-2xl font-bold">{analytics.conversionRate}%</p>
          </div>

          <div className="bg-white p-4 rounded-lg border">
            <p className="text-sm text-gray-600">No Shows</p>
            <p className="text-2xl font-bold text-red-600">{analytics.noShowCount}</p>
          </div>
        </div>
      )}

      {/* Peak Hours */}
      {peakHours.length > 0 && (
        <div className="bg-white p-4 sm:p-6 rounded-lg border">
          <h3 className="text-lg font-semibold mb-4">Peak Hours</h3>

          <div className="space-y-3">
            {peakHours.map((item) => (
              <div key={item.hour} className="flex items-center gap-3">
                <span className="w-16 text-sm">{item.hour}:00</span>

                <div className="flex-1 bg-gray-200 rounded-full h-4">
                  <div
                    className="bg-black h-4 rounded-full"
                    style={{
                      width: `${
                        (item.bookingCount / Math.max(...peakHours.map((p) => p.bookingCount))) *
                        100
                      }%`,
                    }}
                  />
                </div>

                <span className="text-sm font-medium w-10 text-right">{item.bookingCount}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Daily Table */}
      {dailyData.length > 0 && (
        <div className="bg-white p-4 sm:p-6 rounded-lg border">
          <h3 className="text-lg font-semibold mb-4">Daily Breakdown</h3>

          <div className="overflow-x-auto">
            <table className="min-w-[650px] w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2">Date</th>
                  <th className="text-right p-2">Total</th>
                  <th className="text-right p-2">Confirmed</th>
                  <th className="text-right p-2">Rejected</th>
                  <th className="text-right p-2">Cancelled</th>
                  <th className="text-right p-2">No Shows</th>
                </tr>
              </thead>
              <tbody>
                {dailyData.map((day) => (
                  <tr key={day.date} className="border-b">
                    <td className="p-2">{formatDate(day.date)}</td>
                    <td className="text-right p-2">{day.totalBookings}</td>
                    <td className="text-right p-2 text-green-600">{day.confirmedBookings}</td>
                    <td className="text-right p-2 text-gray-600">{day.rejectedBookings}</td>
                    <td className="text-right p-2 text-orange-600">{day.cancelledBookings}</td>
                    <td className="text-right p-2 text-red-600">{day.noShowCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
