'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import AddIcon from '@/src/icons/create-business.svg';

type Service = {
  id: string;
  name: string;
  duration_minutes: number;
  price_cents: number;
};

export default function OwnerServicesPage() {
  const params = useSearchParams();

  const [businessId, setBusinessId] = useState<string | null>(null);
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

  // ✅ GET BUSINESS ID (FIXED)
  useEffect(() => {
    const idFromUrl = params?.get('businessId');

    if (idFromUrl) {
      setBusinessId(idFromUrl);
      return;
    }

    // fallback → fetch first business
    fetch('/api/owner/businesses', { credentials: 'include' })
      .then((res) => res.json())
      .then((data) => {
        if (data?.data?.length > 0) {
          setBusinessId(data.data[0].id);
        } else {
          setLoading(false);
        }
      })
      .catch(() => setLoading(false));
  }, [params]);

  // ✅ FETCH SERVICES (FIXED)

  const fetchServices = useCallback(async () => {
    if (!businessId) return;

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

  // ✅ MODAL OPEN
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

  // ✅ SAVE (FIXED API CONTRACT)
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

  // ✅ DELETE (FIXED API)
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
    <div className="w-full pb-24 flex flex-col gap-6 px-6">
      {/* Toast */}
      {toast && (
        <div className="fixed bottom-20 sm:bottom-24 left-1/2 -translate-x-1/2 z-50 px-4 w-full flex justify-center pointer-events-none">
          <div
            className={`pointer-events-auto w-full max-w-xs sm:max-w-sm md:max-w-md 
      px-4 sm:px-5 py-2.5 rounded-lg text-sm md:text-base font-medium shadow-lg 
      text-center transition-all
      ${
        toast.type === 'success'
          ? 'bg-green-600 text-white'
          : toast.type === 'error'
            ? 'bg-red-600 text-white'
            : 'bg-yellow-400 text-black'
      }`}
          >
            {toast.message}
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">Services</h1>

        <button
          onClick={openAdd}
          className="bg-black text-white 
  px-4 sm:px-5 md:px-6 
  py-2 sm:py-2 md:py-2.5 
  text-sm md:text-base 
  rounded-lg font-medium 
  hover:bg-gray-800 transition 
  w-auto 
  flex items-center gap-2"
        >
          <AddIcon className="w-4 h-4 md:w-5 md:h-5" />
          <span>Add Service</span>
        </button>
      </div>

      {/* Content */}
      {loading ? (
        <p className="text-gray-500">Loading...</p>
      ) : services.length === 0 ? (
        <div className="text-gray-500 text-sm">No services yet. Add your first service.</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-5">
          {services.map((s) => (
            <div
              key={s.id}
              className="bg-white border border-gray-200 rounded-xl p-4 hover:shadow-sm transition"
            >
              <div className="flex items-center justify-between">
                {/* LEFT */}
                <div className="flex flex-col">
                  <h2 className="text-base font-semibold text-gray-900">{s.name}</h2>

                  <span className="text-xs text-gray-500 mt-1">{s.duration_minutes} mins</span>
                </div>

                {/* RIGHT (PRICE) */}
                <div className="text-right">
                  <p className="text-base font-semibold text-gray-900">₹{s.price_cents / 100}</p>
                </div>
              </div>

              {/* ACTIONS */}
              <div className="flex items-center justify-end gap-5 mt-3 border-t pt-3">
                <button
                  onClick={() => openEdit(s)}
                  className="text-sm font-medium text-blue-600 hover:text-blue-800 transition"
                >
                  Edit
                </button>

                <button
                  onClick={() => handleDelete(s.id)}
                  className="text-sm font-medium text-red-600 hover:text-red-800 transition"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* MODAL */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center px-4">
          <div className="bg-white p-6 rounded-xl w-full max-w-md space-y-4">
            <h2 className="text-lg font-semibold">{editing ? 'Edit Service' : 'Add Service'}</h2>

            {/* NAME */}
            <input
              placeholder="Service Name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full border px-3 py-2 rounded"
            />

            {/* DURATION + PRICE */}
            <div className="flex gap-3">
              <input
                placeholder="Duration (mins)"
                value={form.duration}
                onChange={(e) => setForm({ ...form, duration: e.target.value })}
                className="w-full min-w-0 border px-3 py-2 rounded"
              />

              <input
                placeholder="Price ₹"
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
                className="w-full min-w-0 border px-3 py-2 rounded"
              />
            </div>

            {/* BUTTONS */}
            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                onClick={handleSave}
                className="w-full sm:flex-1 
  bg-black text-white 
  px-4 sm:px-5 md:px-6 
  py-2 sm:py-2 md:py-2.5 
  text-sm md:text-base 
  rounded-lg font-medium 
  hover:bg-gray-800 transition"
              >
                Save
              </button>

              <button
                onClick={() => setShowModal(false)}
                className="w-full sm:flex-1 
  bg-gray-100 text-gray-700 
  px-4 sm:px-5 md:px-6 
  py-2 sm:py-2 md:py-2.5 
  text-sm md:text-base 
  rounded-lg font-medium 
  hover:bg-gray-200 transition"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
