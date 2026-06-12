'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { AdminDashboardSkeleton } from '@/components/ui/skeleton';
import { ROUTES, getAdminDashboardUrl } from '@cusown/shared';
import { getCSRFToken } from '@cusown/shared';

export default function EditBusinessPage() {
  const router = useRouter();
  const params = useParams();
  const businessId = typeof params?.id === 'string' ? params.id : '';

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
    try {
      const sessionRes = await fetch('/api/auth/session', {
        credentials: 'include',
      });
      const sessionJson = await sessionRes.json();
      const data = sessionJson?.data;
      if (!sessionRes.ok || !data?.user) {
        router.push(ROUTES.AUTH_LOGIN(ROUTES.ADMIN_DASHBOARD));
        return;
      }
      const profile = data.profile as { user_type?: string } | undefined;
      if (profile?.user_type !== 'admin') {
        setError('Admin access required');
        setLoading(false);
        return;
      }
      await loadBusiness();
    } catch {
      setLoading(false);
    }
  };

  const loadBusiness = async () => {
    try {
      const res = await fetch(`/api/admin/businesses/${businessId}`, {
        credentials: 'include',
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

      const csrfToken = await getCSRFToken();
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (csrfToken) headers['x-csrf-token'] = csrfToken;

      const res = await fetch(`/api/admin/businesses/${businessId}`, {
        method: 'PATCH',
        headers,
        credentials: 'include',
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
      const csrfToken = await getCSRFToken();
      const headers: Record<string, string> = {};
      if (csrfToken) headers['x-csrf-token'] = csrfToken;

      const res = await fetch(`/api/admin/businesses/${businessId}`, {
        method: 'DELETE',
        headers,
        credentials: 'include',
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
      <div className="w-full flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-surface-card rounded-xl border border-border-primary p-8 text-center shadow-lg">
          <h2 className="text-xl font-bold text-text-primary mb-4 font-display">Error</h2>
          <p className="text-text-secondary text-sm mb-8 font-mono">{error}</p>
          <button
            type="button"
            onClick={() => router.push('/admin/dashboard')}
            className="px-6 py-3 bg-background-tertiary border border-border-primary hover:border-[#00E676]/40 hover:bg-background-secondary text-text-primary font-bold rounded-xl transition-all cursor-pointer"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="mb-6">
        <button
          onClick={() => router.push(getAdminDashboardUrl('businesses'))}
          className="text-text-secondary hover:text-[#00E676] mb-4 text-xs font-mono font-bold tracking-wider flex items-center gap-1.5 transition-colors cursor-pointer"
        >
          &larr; Back to Dashboard
        </button>
        <h2 className="text-lg font-bold text-text-primary tracking-tight font-display">
          Edit Business
        </h2>
        <p className="text-xs text-text-secondary mt-1">{business?.salon_name}</p>
      </div>

      {error && (
        <div className="bg-red-950/10 border border-red-500/20 text-state-error px-4 py-3 rounded-xl mb-6 font-mono text-sm">
          {error}
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="bg-surface-card rounded-xl border border-border-primary p-6 md:p-8 space-y-6 shadow-sm"
      >
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide text-text-secondary font-mono mb-2">
            Business Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={formData.salon_name}
            onChange={(e) => setFormData({ ...formData, salon_name: e.target.value })}
            required
            className="w-full h-11 px-4 border border-border-primary bg-surface-input rounded-xl text-sm text-text-primary placeholder-text-tertiary focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary/50 transition-all duration-150"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide text-text-secondary font-mono mb-2">
            Owner Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={formData.owner_name}
            onChange={(e) => setFormData({ ...formData, owner_name: e.target.value })}
            required
            className="w-full h-11 px-4 border border-border-primary bg-surface-input rounded-xl text-sm text-text-primary placeholder-text-tertiary focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary/50 transition-all duration-150"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide text-text-secondary font-mono mb-2">
            WhatsApp Number <span className="text-red-500">*</span>
          </label>
          <input
            type="tel"
            value={formData.whatsapp_number}
            onChange={(e) => setFormData({ ...formData, whatsapp_number: e.target.value })}
            required
            className="w-full h-11 px-4 border border-border-primary bg-surface-input rounded-xl text-sm text-text-primary placeholder-text-tertiary focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary/50 transition-all duration-150"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-text-secondary font-mono mb-2">
              Opening Time <span className="text-red-500">*</span>
            </label>
            <input
              type="time"
              value={formData.opening_time}
              onChange={(e) => setFormData({ ...formData, opening_time: e.target.value })}
              required
              className="w-full h-11 px-4 border border-border-primary bg-surface-input rounded-xl text-sm text-text-primary focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary/50 transition-all duration-150"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-text-secondary font-mono mb-2">
              Closing Time <span className="text-red-500">*</span>
            </label>
            <input
              type="time"
              value={formData.closing_time}
              onChange={(e) => setFormData({ ...formData, closing_time: e.target.value })}
              required
              className="w-full h-11 px-4 border border-border-primary bg-surface-input rounded-xl text-sm text-text-primary focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary/50 transition-all duration-150"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide text-text-secondary font-mono mb-2">
            Slot Duration (minutes) <span className="text-red-500">*</span>
          </label>
          <select
            value={formData.slot_duration}
            onChange={(e) => setFormData({ ...formData, slot_duration: e.target.value })}
            required
            className="w-full h-11 px-4 border border-border-primary bg-surface-input rounded-xl text-sm text-text-primary focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary/50 transition-all duration-150"
          >
            <option value="15">15 minutes</option>
            <option value="30">30 minutes</option>
            <option value="45">45 minutes</option>
            <option value="60">60 minutes</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide text-text-secondary font-mono mb-2">
            Address <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={formData.address}
            onChange={(e) => setFormData({ ...formData, address: e.target.value })}
            required
            className="w-full h-11 px-4 border border-border-primary bg-surface-input rounded-xl text-sm text-text-primary placeholder-text-tertiary focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary/50 transition-all duration-150"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide text-text-secondary font-mono mb-2">
            Location
          </label>
          <input
            type="text"
            value={formData.location}
            onChange={(e) => setFormData({ ...formData, location: e.target.value })}
            className="w-full h-11 px-4 border border-border-primary bg-surface-input rounded-xl text-sm text-text-primary placeholder-text-tertiary focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary/50 transition-all duration-150"
          />
        </div>

        <div className="border-t border-border-primary/45 pt-6">
          <div className="flex items-center mb-4">
            <input
              type="checkbox"
              id="suspended"
              checked={formData.suspended}
              onChange={(e) => setFormData({ ...formData, suspended: e.target.checked })}
              className="h-4 w-4 border-border-primary bg-surface-input text-brand-primary focus:ring-2 focus:ring-brand-primary rounded"
            />
            <label
              htmlFor="suspended"
              className="ml-2 text-xs font-semibold uppercase tracking-wide text-text-secondary font-mono"
            >
              Suspend this business
            </label>
          </div>

          {formData.suspended && (
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-text-secondary font-mono mb-2">
                Suspension Reason
              </label>
              <textarea
                value={formData.suspended_reason}
                onChange={(e) => setFormData({ ...formData, suspended_reason: e.target.value })}
                rows={3}
                className="w-full px-4 py-2 border border-border-primary bg-surface-input rounded-xl text-sm text-text-primary placeholder-text-tertiary focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary/50 transition-all duration-150"
                placeholder="Reason for suspension..."
              />
            </div>
          )}
        </div>

        <div className="flex gap-4 pt-6 border-t border-border-primary/45">
          <button
            type="submit"
            disabled={saving}
            className="flex-grow bg-brand-primary text-background-primary font-bold py-3 px-6 rounded-xl hover:bg-brand-primaryHover active:bg-brand-primaryPressed transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer text-sm"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
          <button
            type="button"
            onClick={handleDelete}
            className="px-6 py-3 bg-red-950/20 border border-red-500/30 hover:border-red-500/50 hover:bg-red-950/40 text-red-400 font-bold rounded-xl transition-colors cursor-pointer text-sm"
          >
            Delete
          </button>
        </div>
      </form>
    </div>
  );
}
