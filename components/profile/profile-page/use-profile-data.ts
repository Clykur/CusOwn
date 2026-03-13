import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { PHONE_DIGITS } from '@/config/constants';
import {
  ROUTES,
  getOwnerDashboardUrl,
  getSecureOwnerDashboardUrlClient,
} from '@/lib/utils/navigation';
import { batchFetchSecureBusinessUrls } from '@/lib/utils/batch-requests';
import type { ProfileData, ProfileFormData } from './types';

export function useProfileData() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [profileData, setProfileData] = useState<ProfileData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState<ProfileFormData>({
    full_name: '',
    phone_number: '',
  });
  const [secureBusinessUrls, setSecureBusinessUrls] = useState<Map<string, string>>(new Map());
  const [profileImageUrl, setProfileImageUrl] = useState<string | null>(null);
  const isCancelledRef = useRef(false);

  const fetchProfile = async () => {
    setLoading(true);
    setError(null);
    isCancelledRef.current = false;

    try {
      const response = await fetch('/api/user/profile', {
        credentials: 'include',
        cache: 'no-store',
      });

      if (isCancelledRef.current) return;

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        if (response.status === 401) {
          router.push(ROUTES.AUTH_LOGIN(ROUTES.PROFILE));
          return;
        }
        setError(errorData.error || `Failed to fetch profile (${response.status})`);
        setLoading(false);
        return;
      }

      const result = await response.json();
      if (!result.success || !result.data) {
        setError(result.error || 'Failed to load profile');
        setLoading(false);
        return;
      }

      setProfileData(result.data);

      const rawPhone = result.data.profile?.phone_number || '';
      const phoneDigits = rawPhone.replace(/\D/g, '').slice(0, PHONE_DIGITS);
      setFormData({
        full_name: result.data.profile?.full_name || '',
        phone_number: phoneDigits,
      });

      const parallelFetches: Promise<void>[] = [];

      if (result.data.profile?.user_type !== 'customer' && result.data.profile?.profile_media_id) {
        parallelFetches.push(
          fetch(`/api/media/signed-url?mediaId=${result.data.profile.profile_media_id}`, {
            credentials: 'include',
          })
            .then((res) => res.json())
            .then((data) => {
              if (!isCancelledRef.current && data.success && data.data?.url) {
                setProfileImageUrl(data.data.url);
              }
            })
            .catch(() => {})
        );
      }

      if (result.data.businesses && result.data.businesses.length > 0) {
        const bookingLinks = result.data.businesses.map(
          (b: { booking_link: string }) => b.booking_link
        );
        parallelFetches.push(
          batchFetchSecureBusinessUrls(bookingLinks).then((urlMap) => {
            if (!isCancelledRef.current) {
              setSecureBusinessUrls(urlMap);
            }
          })
        );
      }

      await Promise.allSettled(parallelFetches);
    } catch (err) {
      if (!isCancelledRef.current) {
        setError(err instanceof Error ? err.message : 'Failed to load profile');
      }
    } finally {
      if (!isCancelledRef.current) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    fetchProfile();
    return () => {
      isCancelledRef.current = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    loading,
    setLoading,
    profileData,
    setProfileData,
    error,
    setError,
    formData,
    setFormData,
    secureBusinessUrls,
    profileImageUrl,
    setProfileImageUrl,
    fetchProfile,
  };
}
