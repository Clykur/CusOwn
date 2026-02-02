'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { supabaseAuth, isAdmin } from '@/lib/supabase/auth';
import AdminSidebar from '@/components/admin/admin-sidebar';
import { AdminDashboardSkeleton } from '@/components/ui/skeleton';
import { ROUTES, getAdminDashboardUrl } from '@/lib/utils/navigation';

export default function EditBusinessPage() {
  const router = useRouter();
  const params = useParams();
  const businessId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [business, setBusiness] = useState<any>(null);
  const [formData, setFormData] = useState({
    salon_name: '',
    owner_name: '',
    whatsapp_number: '',
    opening_time: '',
    closing_time: '',
    slot_duration: '30',
    address: '',
    location: '',
    suspended: false,
    suspended_reason: '',
  });

  useEffect(() => {
    checkAuthAndLoad();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId]);

  const checkAuthAndLoad = async () => {
    if (!supabaseAuth) {
      setError('Supabase not configured');
      setLoading(false);
      return;
    }

    const { data: { session } } = await supabaseAuth!.auth.getSession();
    if (!session?.user) {
      router.push(ROUTES.AUTH_LOGIN(ROUTES.ADMIN_DASHBOARD));
      return;
    }

    const adminCheck = await isAdmin(session.user.id);
    if (!adminCheck) {
      setError('Admin access required');
      setLoading(false);
      return;
    }

    await loadBusiness();
  };

  const loadBusiness = async () => {
    try {
      if (!supabaseAuth) {
        throw new Error('Supabase not configured');
      }
      const { data: { session } } = await supabaseAuth!.auth.getSession();
      if (!session) {
        throw new Error('Session expired. Please log in again.');
      }

      const res = await fetch(`/api/admin/businesses/${businessId}`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });
      const data = await res.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to load business');
      }

      const biz = data.data;
      setBusiness(biz);
      setFormData({
        salon_name: biz.salon_name || '',
        owner_name: biz.owner_name || '',
        whatsapp_number: biz.whatsapp_number || '',
        opening_time: biz.opening_time?.substring(0, 5) || '',
        closing_time: biz.closing_time?.substring(0, 5) || '',
        slot_duration: String(biz.slot_duration) || '30',
        address: biz.address || '',
        location: biz.location || '',
        suspended: biz.suspended || false,
        suspended_reason: biz.suspended_reason || '',
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load business');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const updateData: any = {
        salon_name: formData.salon_name,
        owner_name: formData.owner_name,
        whatsapp_number: formData.whatsapp_number,
        opening_time: `${formData.opening_time}:00`,
        closing_time: `${formData.closing_time}:00`,
        slot_duration: parseInt(formData.slot_duration),
        address: formData.address,
        location: formData.location,
        suspended: formData.suspended,
        suspended_reason: formData.suspended ? formData.suspended_reason : null,
      };

      if (!supabaseAuth) {
        throw new Error('Supabase not configured');
      }
      const { data: { session } } = await supabaseAuth!.auth.getSession();
      if (!session) {
        throw new Error('Session expired. Please log in again.');
      }

      const res = await fetch(`/api/admin/businesses/${businessId}`, {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(updateData),
      });

      const data = await res.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to update business');
      }

      alert('Business updated successfully! Notification sent to owner.');
        router.push(ROUTES.ADMIN_DASHBOARD);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update business');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this business? This action cannot be undone.')) {
      return;
    }

    try {
      if (!supabaseAuth) {
        throw new Error('Supabase not configured');
      }
      const { data: { session } } = await supabaseAuth!.auth.getSession();
      if (!session) {
        throw new Error('Session expired. Please log in again.');
      }

      const res = await fetch(`/api/admin/businesses/${businessId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      const data = await res.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to delete business');
      }

      alert('Business deleted successfully!');
      router.push(ROUTES.ADMIN_DASHBOARD);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete business');
    }
  };

  if (loading) {
    return <AdminDashboardSkeleton />;
  }

  if (error && !business) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Error</h2>
          <p className="text-gray-600 mb-8">{error}</p>
          <button
            onClick={() => router.push('/admin/dashboard')}
            className="px-6 py-3 bg-black text-white font-semibold rounded-lg hover:bg-gray-900 transition-colors"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white flex">
      <AdminSidebar />
      <div className="flex-1 lg:ml-64">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="mb-8">
            <button
              onClick={() => router.push(getAdminDashboardUrl('businesses'))}
              className="text-gray-600 hover:text-gray-900 mb-4"
            >
              ← Back to Dashboard
            </button>
            <h1 className="text-3xl font-bold text-gray-900">Edit Business</h1>
            <p className="text-gray-600 mt-2">{business?.salon_name}</p>
          </div>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-lg p-8 space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Business Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.salon_name}
              onChange={(e) => setFormData({ ...formData, salon_name: e.target.value })}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Owner Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.owner_name}
              onChange={(e) => setFormData({ ...formData, owner_name: e.target.value })}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              WhatsApp Number <span className="text-red-500">*</span>
            </label>
            <input
              type="tel"
              value={formData.whatsapp_number}
              onChange={(e) => setFormData({ ...formData, whatsapp_number: e.target.value })}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Opening Time <span className="text-red-500">*</span>
              </label>
              <input
                type="time"
                value={formData.opening_time}
                onChange={(e) => setFormData({ ...formData, opening_time: e.target.value })}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Closing Time <span className="text-red-500">*</span>
              </label>
              <input
                type="time"
                value={formData.closing_time}
                onChange={(e) => setFormData({ ...formData, closing_time: e.target.value })}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Slot Duration (minutes) <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.slot_duration}
              onChange={(e) => setFormData({ ...formData, slot_duration: e.target.value })}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent"
            >
              <option value="15">15 minutes</option>
              <option value="30">30 minutes</option>
              <option value="45">45 minutes</option>
              <option value="60">60 minutes</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Address <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Location
            </label>
            <input
              type="text"
              value={formData.location}
              onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent"
            />
          </div>

          <div className="border-t pt-6">
            <div className="flex items-center mb-4">
              <input
                type="checkbox"
                id="suspended"
                checked={formData.suspended}
                onChange={(e) => setFormData({ ...formData, suspended: e.target.checked })}
                className="h-4 w-4 text-black focus:ring-black border-gray-300 rounded"
              />
              <label htmlFor="suspended" className="ml-2 text-sm font-medium text-gray-700">
                Suspend this business
              </label>
            </div>

            {formData.suspended && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Suspension Reason
                </label>
                <textarea
                  value={formData.suspended_reason}
                  onChange={(e) => setFormData({ ...formData, suspended_reason: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent"
                  placeholder="Reason for suspension..."
                />
              </div>
            )}
          </div>

          <div className="flex gap-4 pt-6 border-t">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 bg-black text-white font-semibold py-3 px-6 rounded-lg hover:bg-gray-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
            <button
              type="button"
              onClick={handleDelete}
              className="px-6 py-3 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 transition-colors"
            >
              Delete
            </button>
          </div>
        </form>
        </div>
      </div>
    </div>
  );
}

