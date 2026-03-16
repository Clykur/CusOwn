'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { API_ROUTES, ERROR_MESSAGES, VALIDATION } from '@/config/constants';
import { MediaListItem, Slot } from '@/types';
import { useSlotUpdates } from '@/lib/realtime/use-slot-updates';
import { useVisibilityRefresh } from '@/lib/hooks/use-visibility-refresh';
import { logError } from '@/lib/utils/error-handler';
import { getCSRFToken } from '@/lib/utils/csrf-client';
import { supabaseAuth } from '@/lib/supabase/auth';
import { batchFetchSignedUrls } from '@/lib/utils/batch-requests';
import { getCachedReviews } from '@/lib/cache/reviews-cache';
import { Toast } from '@/components/ui/toast';
import DateFilter from '@/components/owner/date-filter';
import { type EditBusinessFormData } from '@/components/owner/edit-business-modal';
import { useOwnerBusinessStore, useUIStore, MODAL_IDS } from '@/lib/store';
import Breadcrumb from '@/components/ui/breadcrumb';

const ReviewSummary = dynamic(() => import('@/components/owner/review-summary'), { ssr: false });
const QRCodeSection = dynamic(() => import('@/components/owner/qr-code-section'));
const BusinessDetailsCard = dynamic(() => import('@/components/owner/business-details-card'));
const EditBusinessModal = dynamic(() => import('@/components/owner/edit-business-modal'), {
  ssr: false,
});
const ShopPhotosSection = dynamic(() => import('@/components/owner/shop-photos-section'), {
  ssr: false,
});
const SlotsKanbanBoard = dynamic(() => import('@/components/owner/slots-kanban-board'));
const DowntimeManagement = dynamic(() => import('@/components/owner/downtime-management'));

type UploadStatus = 'pending' | 'uploading' | 'success' | 'error';
interface UploadQueueItem {
  file: File;
  status: UploadStatus;
}

export default function OwnerBusinessPage() {
  const params = useParams();
  const router = useRouter();
  const bookingLink = typeof params?.bookingLink === 'string' ? params.bookingLink : '';

  const salon = useOwnerBusinessStore((state) => state.salon);
  const setSalon = useOwnerBusinessStore((state) => state.setSalon);
  const updateSalon = useOwnerBusinessStore((state) => state.updateSalon);
  const slots = useOwnerBusinessStore((state) => state.slots);
  const setSlots = useOwnerBusinessStore((state) => state.setSlots);
  const selectedDate = useOwnerBusinessStore((state) => state.selectedDate);
  const setSelectedDate = useOwnerBusinessStore((state) => state.setSelectedDate);
  const activeTab = useOwnerBusinessStore((state) => state.activeTab);
  const setActiveTab = useOwnerBusinessStore((state) => state.setActiveTab);
  const isLoading = useOwnerBusinessStore((state) => state.isLoading);
  const setIsLoading = useOwnerBusinessStore((state) => state.setIsLoading);
  const error = useOwnerBusinessStore((state) => state.error);
  const setError = useOwnerBusinessStore((state) => state.setError);
  const holidays = useOwnerBusinessStore((state) => state.holidays);
  const setHolidays = useOwnerBusinessStore((state) => state.setHolidays);
  const addHoliday = useOwnerBusinessStore((state) => state.addHoliday);
  const closures = useOwnerBusinessStore((state) => state.closures);
  const setClosures = useOwnerBusinessStore((state) => state.setClosures);
  const addClosure = useOwnerBusinessStore((state) => state.addClosure);
  const shopPhotos = useOwnerBusinessStore((state) => state.shopPhotos);
  const setShopPhotos = useOwnerBusinessStore((state) => state.setShopPhotos);
  const removeShopPhoto = useOwnerBusinessStore((state) => state.removeShopPhoto);
  const photosLoading = useOwnerBusinessStore((state) => state.photosLoading);
  const setPhotosLoading = useOwnerBusinessStore((state) => state.setPhotosLoading);
  const uploadingPhotos = useOwnerBusinessStore((state) => state.uploadingPhotos);
  const setUploadingPhotos = useOwnerBusinessStore((state) => state.setUploadingPhotos);
  const deletingPhotoIds = useOwnerBusinessStore((state) => state.deletingPhotoIds);
  const addDeletingPhotoId = useOwnerBusinessStore((state) => state.addDeletingPhotoId);
  const removeDeletingPhotoId = useOwnerBusinessStore((state) => state.removeDeletingPhotoId);
  const reviewData = useOwnerBusinessStore((state) => state.reviewData);
  const setReviewData = useOwnerBusinessStore((state) => state.setReviewData);
  const reset = useOwnerBusinessStore((state) => state.reset);

  const showToast = useUIStore((state) => state.showToast);
  const toasts = useUIStore((state) => state.toasts);
  const dismissToast = useUIStore((state) => state.dismissToast);
  const openModal = useUIStore((state) => state.openModal);
  const closeModal = useUIStore((state) => state.closeModal);
  const isModalOpen = useUIStore((state) => state.isModalOpen);

  const [newHolidayDate, setNewHolidayDate] = useState('');
  const [newHolidayName, setNewHolidayName] = useState('');
  const [newClosureStart, setNewClosureStart] = useState('');
  const [newClosureEnd, setNewClosureEnd] = useState('');
  const [newClosureReason, setNewClosureReason] = useState('');

  const [editForm, setEditForm] = useState<EditBusinessFormData>({
    salon_name: '',
    owner_name: '',
    whatsapp_number: '',
    opening_time: '',
    closing_time: '',
    slot_duration: 30,
    address: '',
    location: '',
  });
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [deleteSaving, setDeleteSaving] = useState(false);

  const [photoError, setPhotoError] = useState<string | null>(null);
  const [uploadQueue, setUploadQueue] = useState<UploadQueueItem[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);

  useEffect(() => {
    getCSRFToken().catch(console.error);
    return () => {
      reset();
    };
  }, [reset]);

  const handleVisibilityRefresh = useCallback(async () => {
    if (!salon) return;
    const date = selectedDate || new Date().toISOString().split('T')[0];
    setSelectedDate(date);
  }, [salon, selectedDate, setSelectedDate]);

  useVisibilityRefresh({
    onRefresh: handleVisibilityRefresh,
    enabled: !!salon,
    throttleMs: 5000,
    staleThresholdMs: 30000,
    refreshOnFocus: true,
  });

  useEffect(() => {
    if (!bookingLink) return;
    let cancelled = false;

    const fetchAllData = async () => {
      try {
        const urlParams = new URLSearchParams(window.location.search);
        const token = urlParams.get('token');
        let url = `${API_ROUTES.SALONS}/${bookingLink}`;
        if (token) url += `?token=${encodeURIComponent(token)}`;

        const headers: HeadersInit = {};
        if (supabaseAuth) {
          const {
            data: { session },
          } = await supabaseAuth.auth.getSession();
          if (session?.access_token) headers['Authorization'] = `Bearer ${session.access_token}`;
        }

        const response = await fetch(url, { headers, credentials: 'include' });
        const result = await response.json();

        if (!response.ok) {
          if (response.status === 401) {
            window.location.href = '/auth/login';
            return;
          }
          if (response.status === 403) {
            window.location.href = '/owner/dashboard';
            return;
          }
          if (
            response.status === 403 &&
            !token &&
            /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(bookingLink)
          ) {
            try {
              const { getSecureOwnerDashboardUrlClient } = await import('@/lib/utils/navigation');
              const secureUrl = await getSecureOwnerDashboardUrlClient(bookingLink);
              window.location.href = secureUrl;
              return;
            } catch (urlError) {
              console.error('Failed to generate secure URL:', urlError);
            }
          }
          throw new Error(result.error || 'Salon not found');
        }

        if (!result.success || !result.data || cancelled) return;

        const salonData = result.data;
        setSalon(salonData);

        const parallelFetches: Promise<void>[] = [];

        if (!salonData.qr_code) {
          parallelFetches.push(
            fetch(`${API_ROUTES.SALONS}/${bookingLink}/qr`)
              .then((res) => res.json())
              .then((qrResult) => {
                if (!cancelled && qrResult.success && qrResult.data?.qr_code) {
                  updateSalon({ qr_code: qrResult.data.qr_code });
                }
              })
              .catch((err) => logError(err, 'QR Code Fetch'))
          );
        }

        parallelFetches.push(
          getCachedReviews(salonData.id).then((reviewResult) => {
            if (cancelled || !reviewResult) return;
            const reviews = reviewResult.reviews || [];
            const rating_counts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
            reviews.forEach((review) => {
              const rating = Number(review.rating);
              if (rating_counts[rating] !== undefined) rating_counts[rating]++;
            });
            setReviewData({
              rating_avg: reviewResult.rating_avg || 0,
              review_count: reviewResult.review_count || 0,
              rating_counts,
            });
          })
        );

        const date = selectedDate || new Date().toISOString().split('T')[0];
        parallelFetches.push(
          fetch(`${API_ROUTES.SLOTS}?salon_id=${salonData.id}&date=${date}`, {
            headers,
            credentials: 'include',
          })
            .then((res) => res.json())
            .then((slotsResult) => {
              if (cancelled) return;
              if (slotsResult.success) {
                const normalizedSlots = Array.isArray(slotsResult.data)
                  ? slotsResult.data
                  : Array.isArray(slotsResult.data?.slots)
                    ? slotsResult.data.slots
                    : [];
                setSlots(normalizedSlots);
              }
            })
            .catch((err) => logError(err, 'Slots Fetch'))
        );

        parallelFetches.push(
          Promise.all([
            fetch(`/api/businesses/${salonData.id}/downtime/holidays`, { credentials: 'include' }),
            fetch(`/api/businesses/${salonData.id}/downtime/closures`, { credentials: 'include' }),
          ])
            .then(async ([holidaysRes, closuresRes]) => {
              if (cancelled) return;
              const [holidaysData, closuresData] = await Promise.all([
                holidaysRes.json(),
                closuresRes.json(),
              ]);
              if (holidaysData.success) setHolidays(holidaysData.data || []);
              if (closuresData.success) setClosures(closuresData.data || []);
            })
            .catch((err) => console.error('Failed to fetch downtime:', err))
        );

        parallelFetches.push(
          fetch(API_ROUTES.MEDIA_BUSINESS(salonData.id), { credentials: 'include' })
            .then((res) => res.json())
            .then(async (mediaResult) => {
              if (cancelled) return;
              if (!mediaResult?.success) {
                setShopPhotos([]);
                return;
              }
              const items: MediaListItem[] = Array.isArray(mediaResult?.data?.items)
                ? mediaResult.data.items
                : [];
              if (items.length === 0) {
                setShopPhotos([]);
                return;
              }
              const mediaIds = items.map((item) => item.id);
              const urlMap = await batchFetchSignedUrls(mediaIds);
              if (cancelled) return;
              const withUrls = items
                .map((item) => {
                  const url = urlMap.get(item.id);
                  return url ? { id: item.id, url } : null;
                })
                .filter((p): p is { id: string; url: string } => Boolean(p));
              setShopPhotos(withUrls);
            })
            .catch((err) => {
              logError(err, 'Photos Fetch');
              setShopPhotos([]);
            })
            .finally(() => {
              if (!cancelled) setPhotosLoading(false);
            })
        );

        await Promise.allSettled(parallelFetches);
      } catch (err) {
        if (!cancelled) {
          logError(err, 'Salon Fetch');
          setError(err instanceof Error ? err.message : ERROR_MESSAGES.LOADING_ERROR);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    fetchAllData();

    return () => {
      cancelled = true;
    };
  }, [
    bookingLink,
    selectedDate,
    setSalon,
    updateSalon,
    setError,
    setIsLoading,
    setSlots,
    setHolidays,
    setClosures,
    setShopPhotos,
    setPhotosLoading,
    setReviewData,
  ]);

  const initialDateRef = useRef<string | null>(null);

  const fetchSlots = useCallback(async () => {
    if (!salon) return;
    if (typeof document !== 'undefined' && document.hidden) return;
    try {
      const date = selectedDate || new Date().toISOString().split('T')[0];
      const headers: HeadersInit = {};
      if (supabaseAuth) {
        const {
          data: { session },
        } = await supabaseAuth.auth.getSession();
        if (session?.access_token) headers['Authorization'] = `Bearer ${session.access_token}`;
      }
      const response = await fetch(`${API_ROUTES.SLOTS}?salon_id=${salon.id}&date=${date}`, {
        headers,
        credentials: 'include',
      });
      const result = await response.json();
      if (result.success) {
        const normalizedSlots = Array.isArray(result.data)
          ? result.data
          : Array.isArray(result.data?.slots)
            ? result.data.slots
            : [];
        setSlots(normalizedSlots);
      }
    } catch (err) {
      logError(err, 'Slots Fetch');
    }
  }, [salon, selectedDate, setSlots]);

  useEffect(() => {
    if (!salon) return;
    const currentDate = selectedDate || new Date().toISOString().split('T')[0];
    if (initialDateRef.current === null) {
      initialDateRef.current = currentDate;
      return;
    }
    if (initialDateRef.current !== currentDate) {
      initialDateRef.current = currentDate;
      fetchSlots();
    }
  }, [salon, selectedDate, fetchSlots]);

  const slotsDate = selectedDate || new Date().toISOString().split('T')[0];
  const slotsRef = useRef<Slot[]>(slots);
  slotsRef.current = slots;

  const handleRealtimeSlotsUpdate = useCallback(
    (nextSlots: Slot[]) => {
      const currentSlots = slotsRef.current;
      const currentById = new Map(currentSlots.map((s) => [s.id, s]));
      let hasChanges = false;

      for (const slot of nextSlots) {
        const existing = currentById.get(slot.id);
        if (
          !existing ||
          existing.status !== slot.status ||
          existing.updated_at !== slot.updated_at
        ) {
          hasChanges = true;
          break;
        }
      }

      if (!hasChanges && nextSlots.length === currentSlots.length) return;

      setSlots(nextSlots);
    },
    [setSlots]
  );

  useSlotUpdates({
    businessId: salon?.id ?? null,
    date: salon ? slotsDate : null,
    slots,
    onSlotsUpdate: handleRealtimeSlotsUpdate,
    enabled: !!salon && activeTab === 'slots',
    skipInitialRefetch: slots.length > 0,
  });

  const memoizedSlots = useMemo(() => slots, [slots]);

  const fetchDowntime = useCallback(async () => {
    if (!salon) return;
    if (typeof document !== 'undefined' && document.hidden) return;

    try {
      const [holidaysRes, closuresRes] = await Promise.all([
        fetch(`/api/businesses/${salon.id}/downtime/holidays`, { credentials: 'include' }),
        fetch(`/api/businesses/${salon.id}/downtime/closures`, { credentials: 'include' }),
      ]);
      if (typeof document !== 'undefined' && document.hidden) return;

      const holidaysData = await holidaysRes.json();
      const closuresData = await closuresRes.json();
      if (holidaysData.success) setHolidays(holidaysData.data || []);
      if (closuresData.success) setClosures(closuresData.data || []);
    } catch (err) {
      if (typeof document !== 'undefined' && !document.hidden) {
        console.error('Failed to fetch downtime:', err);
      }
    }
  }, [salon, setHolidays, setClosures]);

  const loadBusinessPhotos = useCallback(
    async (businessId: string) => {
      setPhotosLoading(true);
      setPhotoError(null);
      try {
        const res = await fetch(API_ROUTES.MEDIA_BUSINESS(businessId), { credentials: 'include' });
        const result = await res.json();
        if (!res.ok || !result?.success)
          throw new Error(result?.error || ERROR_MESSAGES.LOADING_ERROR);
        const items: MediaListItem[] = Array.isArray(result?.data?.items) ? result.data.items : [];
        if (items.length === 0) {
          setShopPhotos([]);
          return;
        }
        const mediaIds = items.map((item) => item.id);
        const urlMap = await batchFetchSignedUrls(mediaIds);
        const withUrls = items
          .map((item) => {
            const url = urlMap.get(item.id);
            return url ? { id: item.id, url } : null;
          })
          .filter((p): p is { id: string; url: string } => Boolean(p));
        setShopPhotos(withUrls);
      } catch (err) {
        setPhotoError(err instanceof Error ? err.message : ERROR_MESSAGES.LOADING_ERROR);
        setShopPhotos([]);
      } finally {
        setPhotosLoading(false);
      }
    },
    [setPhotosLoading, setShopPhotos]
  );

  const handleFileSelect = (files: File[]) => {
    setSelectedFiles(files);
    setUploadQueue(files.map((file) => ({ file, status: 'pending' })));
  };

  const handleRemoveSelectedFile = (idx: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleUploadPhotos = async () => {
    if (!salon?.id || uploadingPhotos || selectedFiles.length === 0) return;
    const MAX_SIZE = 5 * 1024 * 1024;
    const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp']);
    for (const file of selectedFiles) {
      if (!ALLOWED.has(file.type)) {
        setPhotoError('Only JPG, PNG, and WEBP images are allowed.');
        return;
      }
      if (file.size > MAX_SIZE) {
        setPhotoError('Each image must be 5 MB or smaller.');
        return;
      }
    }
    setUploadingPhotos(true);
    setPhotoError(null);
    try {
      const csrfToken = await getCSRFToken();
      const authHeaders: Record<string, string> = {};
      if (csrfToken) authHeaders['x-csrf-token'] = csrfToken;
      if (supabaseAuth) {
        const {
          data: { session },
        } = await supabaseAuth.auth.getSession();
        if (session?.access_token) authHeaders['Authorization'] = `Bearer ${session.access_token}`;
      }
      for (const file of selectedFiles) {
        const formData = new FormData();
        formData.append('file', file);
        const uploadRes = await fetch(API_ROUTES.MEDIA_BUSINESS(salon.id), {
          method: 'POST',
          credentials: 'include',
          headers: authHeaders,
          body: formData,
        });
        const uploadResult = await uploadRes.json();
        if (!uploadRes.ok || !uploadResult?.success) {
          throw new Error(
            uploadResult?.error || uploadResult?.message || ERROR_MESSAGES.MEDIA_UPLOAD_FAILED
          );
        }
      }
      setSelectedFiles([]);
      const fileInput = document.getElementById('shop-photo-input') as HTMLInputElement | null;
      if (fileInput) fileInput.value = '';
      await loadBusinessPhotos(salon.id);
      showToast('Photos uploaded successfully', 'success');
    } catch (err) {
      setPhotoError(err instanceof Error ? err.message : ERROR_MESSAGES.MEDIA_UPLOAD_FAILED);
    } finally {
      setUploadingPhotos(false);
    }
  };

  const handleDeletePhoto = async (photoId: string) => {
    if (!salon?.id) return;
    if (!window.confirm('Delete this photo?')) return;
    const previousPhotos = shopPhotos;
    addDeletingPhotoId(photoId);
    setPhotoError(null);
    removeShopPhoto(photoId);
    try {
      const csrfToken = await getCSRFToken();
      const headers: Record<string, string> = {};
      if (csrfToken) headers['x-csrf-token'] = csrfToken;
      if (supabaseAuth) {
        const {
          data: { session },
        } = await supabaseAuth.auth.getSession();
        if (session?.access_token) headers['Authorization'] = `Bearer ${session.access_token}`;
      }
      const deleteRes = await fetch(`/api/media/${encodeURIComponent(photoId)}`, {
        method: 'DELETE',
        credentials: 'include',
        headers,
      });
      const deleteResult = await deleteRes.json();
      if (!deleteRes.ok || !deleteResult?.success) {
        throw new Error(
          deleteResult?.error || deleteResult?.message || ERROR_MESSAGES.UNEXPECTED_ERROR
        );
      }
    } catch (err) {
      setShopPhotos(previousPhotos);
      setPhotoError(err instanceof Error ? err.message : ERROR_MESSAGES.UNEXPECTED_ERROR);
    } finally {
      removeDeletingPhotoId(photoId);
    }
  };

  const handleAddHoliday = async () => {
    if (!newHolidayDate || !salon) return;
    try {
      const csrfToken = await getCSRFToken();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (csrfToken) headers['x-csrf-token'] = csrfToken;
      const response = await fetch(`/api/businesses/${salon.id}/downtime/holidays`, {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({ holiday_date: newHolidayDate, holiday_name: newHolidayName }),
      });
      if (response.ok) {
        const result = await response.json();
        setNewHolidayDate('');
        setNewHolidayName('');
        const newItem = result.data || {
          id: crypto.randomUUID(),
          holiday_date: newHolidayDate,
          holiday_name: newHolidayName,
          created_at: new Date().toISOString(),
        };
        addHoliday(newItem);
      }
    } catch {
      alert('Failed to add holiday');
    }
  };

  const handleAddClosure = async () => {
    if (!newClosureStart || !newClosureEnd || !salon) return;
    try {
      const csrfToken = await getCSRFToken();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (csrfToken) headers['x-csrf-token'] = csrfToken;
      const response = await fetch(`/api/businesses/${salon.id}/downtime/closures`, {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({
          start_date: newClosureStart,
          end_date: newClosureEnd,
          reason: newClosureReason,
        }),
      });
      if (response.ok) {
        const result = await response.json();
        const savedStart = newClosureStart;
        const savedEnd = newClosureEnd;
        const savedReason = newClosureReason;
        setNewClosureStart('');
        setNewClosureEnd('');
        setNewClosureReason('');
        const newItem = result.data || {
          id: crypto.randomUUID(),
          start_date: savedStart,
          end_date: savedEnd,
          reason: savedReason,
          created_at: new Date().toISOString(),
        };
        addClosure(newItem);
      }
    } catch {
      alert('Failed to add closure');
    }
  };

  const openEditModal = () => {
    if (!salon) return;
    setEditForm({
      salon_name: salon.salon_name,
      owner_name: salon.owner_name,
      whatsapp_number: salon.whatsapp_number
        .replace(/\D/g, '')
        .slice(0, VALIDATION.WHATSAPP_NUMBER_MAX_LENGTH),
      opening_time: salon.opening_time?.substring(0, 5) ?? '10:00',
      closing_time: salon.closing_time?.substring(0, 5) ?? '21:00',
      slot_duration: salon.slot_duration ?? 30,
      address: salon.address ?? '',
      location: salon.location ?? '',
    });
    setEditError(null);
    openModal(MODAL_IDS.EDIT_BUSINESS);
  };

  const handleEditSave = async () => {
    if (!salon || !bookingLink) return;
    setEditSaving(true);
    setEditError(null);
    try {
      const csrfToken = await getCSRFToken();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (csrfToken) headers['x-csrf-token'] = csrfToken;
      const res = await fetch(`/api/owner/businesses/${encodeURIComponent(bookingLink)}`, {
        method: 'PATCH',
        headers,
        credentials: 'include',
        body: JSON.stringify({
          salon_name: editForm.salon_name.trim(),
          owner_name: editForm.owner_name.trim(),
          whatsapp_number: editForm.whatsapp_number,
          opening_time:
            editForm.opening_time.length === 5
              ? `${editForm.opening_time}:00`
              : editForm.opening_time,
          closing_time:
            editForm.closing_time.length === 5
              ? `${editForm.closing_time}:00`
              : editForm.closing_time,
          slot_duration: editForm.slot_duration,
          address: editForm.address.trim(),
          location: editForm.location.trim(),
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setEditError(json.error || ERROR_MESSAGES.UNEXPECTED_ERROR);
        return;
      }
      if (json.success && json.data) {
        setSalon(json.data);
        closeModal(MODAL_IDS.EDIT_BUSINESS);
        showToast('Business updated successfully', 'success');
      }
    } catch (err) {
      setEditError(err instanceof Error ? err.message : ERROR_MESSAGES.UNEXPECTED_ERROR);
    } finally {
      setEditSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!salon || !bookingLink) return;
    if (!window.confirm('Are you sure you want to delete this business? This cannot be undone.'))
      return;
    setDeleteSaving(true);
    try {
      const csrfToken = await getCSRFToken();
      const headers: Record<string, string> = {};
      if (csrfToken) headers['x-csrf-token'] = csrfToken;
      const res = await fetch(`/api/owner/businesses/${encodeURIComponent(bookingLink)}`, {
        method: 'DELETE',
        headers,
        credentials: 'include',
      });
      const json = await res.json();
      if (res.ok && json.success) {
        router.push('/owner/businesses?deleted=1');
        return;
      }
      setError(json.error || 'Failed to delete business');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete business');
    } finally {
      setDeleteSaving(false);
    }
  };

  const breadcrumbItems = useMemo(
    () => [
      { label: 'Businesses', href: '/owner/businesses' },
      { label: salon?.salon_name || 'Business Details', href: `/owner/${bookingLink}` },
    ],
    [bookingLink, salon?.salon_name]
  );

  if (isLoading) {
    return (
      <div className="w-full pb-24 flex flex-col gap-6">
        <Breadcrumb
          items={[
            { label: 'Businesses', href: '/owner/businesses' },
            { label: 'Loading...', href: `/owner/${bookingLink}` },
          ]}
        />
        <div className="h-8 bg-slate-200 rounded w-64 mb-2 animate-pulse" />
        <div className="h-4 bg-slate-200 rounded w-48 animate-pulse" />
        <div className="bg-white border border-slate-200 rounded-lg p-6 animate-pulse">
          <div className="h-48 bg-slate-200 rounded mb-4" />
          <div className="h-6 bg-slate-200 rounded w-3/4 mb-2" />
          <div className="h-4 bg-slate-200 rounded w-1/2" />
        </div>
      </div>
    );
  }

  if (error || !salon) {
    return (
      <div className="w-full pb-24 flex flex-col gap-6">
        <Breadcrumb
          items={[
            { label: 'Businesses', href: '/owner/businesses' },
            { label: 'Business Details', href: `/owner/${bookingLink}` },
          ]}
        />
        <div className="bg-white border border-slate-200 rounded-lg p-8 text-center">
          <h2 className="text-2xl font-bold text-slate-900 mb-4">Access Denied</h2>
          <p className="text-slate-600 mb-8">Invalid booking link or salon not found.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full pb-24 flex flex-col gap-6">
      {toasts.map((toast) => (
        <Toast
          key={toast.id}
          message={toast.message}
          variant={toast.variant}
          onDismiss={() => dismissToast(toast.id)}
          duration={toast.duration}
        />
      ))}

      <Breadcrumb items={breadcrumbItems} />

      <div className="space-y-2">
        <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-slate-900 truncate leading-tight">
          {salon.salon_name}
        </h1>
      </div>

      <QRCodeSection qrCode={salon.qr_code} bookingLink={salon.booking_link} />

      <BusinessDetailsCard
        salon={salon}
        onEdit={openEditModal}
        onDelete={handleDelete}
        deleteSaving={deleteSaving}
      />

      <EditBusinessModal
        isOpen={isModalOpen(MODAL_IDS.EDIT_BUSINESS)}
        editForm={editForm}
        editError={editError}
        editSaving={editSaving}
        onFormChange={setEditForm}
        onSave={handleEditSave}
        onClose={() => closeModal(MODAL_IDS.EDIT_BUSINESS)}
      />

      <ShopPhotosSection
        photos={shopPhotos}
        selectedFiles={selectedFiles}
        photosLoading={photosLoading}
        uploadingPhotos={uploadingPhotos}
        photoError={photoError}
        deletingPhotoIds={deletingPhotoIds}
        uploadQueue={uploadQueue}
        onFileSelect={handleFileSelect}
        onRemoveSelectedFile={handleRemoveSelectedFile}
        onUpload={handleUploadPhotos}
        onDeletePhoto={handleDeletePhoto}
      />

      <div className="bg-white border border-slate-200 rounded-lg">
        <div className="flex gap-1 bg-slate-100 p-1 border-b border-slate-200 overflow-x-auto">
          <button
            onClick={() => setActiveTab('slots')}
            className={`flex-shrink-0 px-4 py-3 font-semibold rounded-md transition-all duration-200 whitespace-nowrap ${
              activeTab === 'slots'
                ? 'bg-white text-black shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Slots
          </button>
          <button
            onClick={() => setActiveTab('downtime')}
            className={`flex-shrink-0 px-4 py-3 font-semibold rounded-md transition-all duration-200 whitespace-nowrap ${
              activeTab === 'downtime'
                ? 'bg-white text-black shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Downtime
          </button>
        </div>

        <div className="p-4 lg:p-6">
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">Select Date</label>
            <div className="w-full sm:w-64 lg:w-72">
              <DateFilter value={selectedDate} onChange={setSelectedDate} />
            </div>
          </div>

          {activeTab === 'slots' ? (
            <SlotsKanbanBoard slots={memoizedSlots} />
          ) : activeTab === 'downtime' ? (
            <DowntimeManagement
              holidays={holidays}
              closures={closures}
              newHolidayDate={newHolidayDate}
              newHolidayName={newHolidayName}
              newClosureStart={newClosureStart}
              newClosureEnd={newClosureEnd}
              newClosureReason={newClosureReason}
              onHolidayDateChange={setNewHolidayDate}
              onHolidayNameChange={setNewHolidayName}
              onClosureStartChange={setNewClosureStart}
              onClosureEndChange={setNewClosureEnd}
              onClosureReasonChange={setNewClosureReason}
              onAddHoliday={handleAddHoliday}
              onAddClosure={handleAddClosure}
            />
          ) : (
            <div className="w-full">
              <p className="text-sm text-gray-600">
                Analytics has moved to the Owner Dashboard (Analytics tab).
              </p>
            </div>
          )}
        </div>
      </div>

      <ReviewSummary reviewData={reviewData} />
    </div>
  );
}
