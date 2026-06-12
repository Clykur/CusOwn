'use client';

import { useEffect, useState, useCallback } from 'react';
import { OWNER_SCREEN_TITLE_CLASSNAME } from '@cusown/config';
import AddIcon from '@cusown/shared/icons/create-business.svg';
import ActionButton from '@/components/ui/action-button';

export type Service = {
  id: string;
  name: string;
  duration_minutes: number;
  price_cents: number;
};

type ServicesProps = {
  businessId: string;
  className?: string;
};

const ServicesSection = ({ businessId, className = '' }: ServicesProps) => {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Service | null>(null);
  const [form, setForm] = useState({
    name: '',
    duration: '',
    price: '',
  });
  const [toast, setToast] = useState<{
    message: string;
    type: 'success' | 'error' | 'warning';
  } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' | 'warning') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 2000);
  };

  const fetchServices = useCallback(async () => {
    try {
      const res = await fetch(`/api/owner/services?businessId=${businessId}`, {
        credentials: 'include',
      });

      if (!res.ok) {
        console.error('Failed to fetch services');
        setServices([]);
        return;
      }

      const data = await res.json();
      setServices(data.data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [businessId]);

  useEffect(() => {
    fetchServices();
  }, [fetchServices]);

  const openAdd = () => {
    setEditing(null);
    setForm({ name: '', duration: '', price: '' });
    setShowModal(true);
  };

  const openEdit = (s: Service) => {
    setEditing(s);
    setForm({
      name: s.name,
      duration: String(s.duration_minutes),
      price: String(s.price_cents / 100),
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.name || !form.duration || !form.price) return;

    const payload = {
      businessId,
      name: form.name,
      duration_minutes: Number(form.duration),
      price_cents: Number(form.price) * 100,
    };

    try {
      if (editing) {
        await fetch(`/api/owner/services`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            serviceId: editing.id,
            ...payload,
          }),
        });
        showToast('Service updated', 'warning');
      } else {
        await fetch(`/api/owner/services`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(payload),
        });
        showToast('Service added', 'success');
      }

      setShowModal(false);
      fetchServices();
    } catch (e) {
      console.error(e);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this service?')) return;

    await fetch(`/api/owner/services?serviceId=${id}`, {
      method: 'DELETE',
      credentials: 'include',
    });

    setServices((prev) => prev.filter((s) => s.id !== id));
    showToast('Deleted', 'error');
  };

  return (
    <div className="rounded-2xl border border-border-primary bg-surface-card p-4 shadow-[0_1px_3px_rgba(15,23,42,0.06)] ring-1 ring-border-focus/[0.04] sm:p-5 md:rounded-lg md:shadow-none md:ring-0 lg:p-6">
      <div className={`w-full ${className}`}>
        {toast && (
          <div className="fixed bottom-20 sm:bottom-24 left-1/2 -translate-x-1/2 z-50 px-4 w-full flex justify-center pointer-events-none">
            <div
              className={`pointer-events-auto w-full max-w-xs sm:max-w-sm md:max-w-md 
 px-4 sm:px-5 py-2.5 rounded-lg text-sm md:text-base font-medium shadow-lg 
 text-center transition-all
 ${
   toast.type === 'success'
     ? 'bg-green-600 text-text-inverse'
     : toast.type === 'error'
       ? 'bg-state-error opacity-90 hover:opacity-100 text-text-inverse'
       : 'bg-yellow-400 text-text-primary'
 }`}
            >
              {toast.message}
            </div>
          </div>
        )}

        <div className="mb-6 flex items-center justify-between gap-3">
          <h2 className={OWNER_SCREEN_TITLE_CLASSNAME}>Services</h2>
          <button
            onClick={openAdd}
            className="bg-brand-primary text-text-inverse 
 px-4 sm:px-5 md:px-6 
 py-2 sm:py-2 md:py-2.5 
 text-sm md:text-base 
 rounded-lg font-medium 
 hover:bg-brand-primaryHover transition 
 w-auto 
 flex items-center gap-2"
          >
            <AddIcon className="w-4 h-4 md:w-5 md:h-5" />
            <span>Add Service</span>
          </button>
        </div>

        {loading ? (
          <p className="text-text-secondary">Loading...</p>
        ) : services.length === 0 ? (
          <div className="text-text-secondary text-sm">
            No services yet. Add your first service.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-5">
            {services.map((s) => (
              <div
                key={s.id}
                className="bg-surface-card border border-border-primary rounded-xl p-4 hover:shadow-sm transition"
              >
                <div className="flex items-center justify-between">
                  <div className="flex flex-col">
                    <h3 className="text-base font-semibold text-text-primary">{s.name}</h3>
                    <span className="text-xs text-text-secondary mt-1">
                      {s.duration_minutes} mins
                    </span>
                  </div>
                  <div className="text-right">
                    <p className="text-base font-semibold text-text-primary">
                      ₹{s.price_cents / 100}
                    </p>
                  </div>
                </div>
                <div className="flex items-center justify-end gap-2 mt-3 border-t border-border-secondary pt-3">
                  <ActionButton
                    action="delete"
                    onClick={() => handleDelete(s.id)}
                    tooltip="Delete Service"
                  />
                  <ActionButton action="edit" onClick={() => openEdit(s)} tooltip="Edit Service" />
                </div>
              </div>
            ))}
          </div>
        )}

        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-background-primary/80 backdrop-blur-md px-4">
            <div className="w-full max-w-md rounded-2xl border border-border-primary bg-surface-modal shadow-xl">
              <div className="border-b border-border-primary px-6 py-4">
                <h3 className="text-lg font-semibold text-text-primary">
                  {editing ? 'Edit Service' : 'Add Service'}
                </h3>
              </div>

              <div className="space-y-4 p-6">
                <input
                  placeholder="Service Name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="
                    w-full
                    rounded-xl
                    border
                    border-border-primary
                    bg-surface-input
                    px-4
                    py-3
                    text-text-primary
                    placeholder:text-text-tertiary
                    focus:border-brand-primary
                    focus:outline-none
                    focus:ring-2
                    focus:ring-brand-primary/20
                "
                />

                <div className="flex gap-3">
                  <input
                    placeholder="Duration (mins)"
                    value={form.duration}
                    onChange={(e) => setForm({ ...form, duration: e.target.value })}
                    className="
                        w-full
                        min-w-0
                        rounded-xl
                        border
                        border-border-primary
                        bg-surface-input
                        px-4
                        py-3
                        text-text-primary
                        placeholder:text-text-tertiary
                        focus:border-brand-primary
                        focus:outline-none
                        focus:ring-2
                        focus:ring-brand-primary/20
                    "
                  />

                  <input
                    placeholder="Price ₹"
                    value={form.price}
                    onChange={(e) => setForm({ ...form, price: e.target.value })}
                    className="
                        w-full
                        min-w-0
                        rounded-xl
                        border
                        border-border-primary
                        bg-surface-input
                        px-4
                        py-3
                        text-text-primary
                        placeholder:text-text-tertiary
                        focus:border-brand-primary
                        focus:outline-none
                        focus:ring-2
                        focus:ring-brand-primary/20
                    "
                  />
                </div>
              </div>

              <div className="flex gap-3 border-t border-border-primary p-6">
                <button
                  onClick={() => setShowModal(false)}
                  className="
                    flex-1
                    rounded-xl
                    border
                    border-border-primary
                    bg-surface-elevated
                    px-4
                    py-3
                    font-medium
                    text-text-primary
                    transition-colors
                    hover:bg-surface-input
                "
                >
                  Cancel
                </button>

                <button
                  onClick={handleSave}
                  className="
                    flex-1
                    rounded-xl
                    bg-brand-primary
                    px-4
                    py-3
                    font-medium
                    text-text-inverse
                    transition-colors
                    hover:bg-brand-primaryHover
                "
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ServicesSection;
