'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ERROR_MESSAGES, OWNER_SCREEN_TITLE_CLASSNAME } from '@/config/constants';
import { ROUTES } from '@/lib/utils/navigation';
import { getCSRFToken } from '@/lib/utils/csrf-client';
import { supabaseAuth } from '@/lib/supabase/auth';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

type DayRow = {
  day_of_week: number;
  opening_time: string;
  closing_time: string;
  is_closed: boolean;
};

function toInputTime(t: string | null | undefined): string {
  if (!t) return '10:00';
  const s = t.trim();
  return s.length >= 5 ? s.substring(0, 5) : '10:00';
}

export default function BusinessSetupFlow({ businessId }: { businessId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [salonName, setSalonName] = useState('');
  const [bookingLink, setBookingLink] = useState('');
  const [dayRows, setDayRows] = useState<DayRow[]>(() =>
    Array.from({ length: 7 }, (_, i) => ({
      day_of_week: i,
      opening_time: '10:00',
      closing_time: '21:00',
      is_closed: false,
    }))
  );
  const [breakDay, setBreakDay] = useState<number>(1);
  const [breakStart, setBreakStart] = useState('13:00');
  const [breakEnd, setBreakEnd] = useState('14:00');
  const [includeBreak, setIncludeBreak] = useState(false);
  const [holidayDate, setHolidayDate] = useState('');
  const [holidayName, setHolidayName] = useState('');

  const authHeaders = useCallback(async (): Promise<Record<string, string>> => {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    const csrf = await getCSRFToken();
    if (csrf) headers['x-csrf-token'] = csrf;
    if (supabaseAuth) {
      const {
        data: { session },
      } = await supabaseAuth.auth.getSession();
      if (session?.access_token) headers['Authorization'] = `Bearer ${session.access_token}`;
    }
    return headers;
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const headers: HeadersInit = {};
        if (supabaseAuth) {
          const {
            data: { session },
          } = await supabaseAuth.auth.getSession();
          if (session?.access_token) headers['Authorization'] = `Bearer ${session.access_token}`;
        }
        const res = await fetch(`/api/salons/${encodeURIComponent(businessId)}`, {
          credentials: 'include',
          headers,
        });
        const json = await res.json();
        if (!res.ok || !json.success || !json.data) {
          throw new Error(json.error || ERROR_MESSAGES.SALON_NOT_FOUND);
        }
        const s = json.data;
        if (cancelled) return;
        setSalonName(s.salon_name || '');
        setBookingLink(s.booking_link || '');
        const o = toInputTime(s.opening_time);
        const c = toInputTime(s.closing_time);
        setDayRows(
          Array.from({ length: 7 }, (_, i) => ({
            day_of_week: i,
            opening_time: o,
            closing_time: c,
            is_closed: false,
          }))
        );
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : ERROR_MESSAGES.UNEXPECTED_ERROR);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [businessId]);

  const saveHours = async () => {
    setSaving(true);
    setError(null);
    try {
      const headers = await authHeaders();
      const days = dayRows.map((d) => ({
        day_of_week: d.day_of_week,
        is_closed: d.is_closed,
        opening_time: d.is_closed ? null : `${d.opening_time}:00`,
        closing_time: d.is_closed ? null : `${d.closing_time}:00`,
      }));
      const res = await fetch(`/api/owner/businesses/${encodeURIComponent(businessId)}/hours`, {
        method: 'PUT',
        headers,
        credentials: 'include',
        body: JSON.stringify({ days }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to save hours');
    } catch (e) {
      setError(e instanceof Error ? e.message : ERROR_MESSAGES.UNEXPECTED_ERROR);
    } finally {
      setSaving(false);
    }
  };

  const saveBreak = async () => {
    if (!includeBreak) {
      setSaving(true);
      try {
        const headers = await authHeaders();
        const res = await fetch(`/api/owner/businesses/${encodeURIComponent(businessId)}/breaks`, {
          method: 'PUT',
          headers,
          credentials: 'include',
          body: JSON.stringify({ breaks: [] }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Failed to clear breaks');
      } catch (e) {
        setError(e instanceof Error ? e.message : ERROR_MESSAGES.UNEXPECTED_ERROR);
      } finally {
        setSaving(false);
      }
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const headers = await authHeaders();
      const res = await fetch(`/api/owner/businesses/${encodeURIComponent(businessId)}/breaks`, {
        method: 'PUT',
        headers,
        credentials: 'include',
        body: JSON.stringify({
          breaks: [
            {
              day_of_week: breakDay,
              start: `${breakStart}:00`,
              end: `${breakEnd}:00`,
            },
          ],
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to save break');
    } catch (e) {
      setError(e instanceof Error ? e.message : ERROR_MESSAGES.UNEXPECTED_ERROR);
    } finally {
      setSaving(false);
    }
  };

  const addHoliday = async () => {
    if (!holidayDate.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const headers = await authHeaders();
      const res = await fetch(`/api/owner/businesses/${encodeURIComponent(businessId)}/holidays`, {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({ holiday_date: holidayDate, holiday_name: holidayName || undefined }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to add holiday');
      setHolidayDate('');
      setHolidayName('');
    } catch (e) {
      setError(e instanceof Error ? e.message : ERROR_MESSAGES.UNEXPECTED_ERROR);
    } finally {
      setSaving(false);
    }
  };

  const finish = () => {
    if (bookingLink) {
      router.push(`/owner/${encodeURIComponent(bookingLink)}`);
    } else {
      router.push(ROUTES.OWNER_DASHBOARD_BASE);
    }
  };

  if (loading) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-600">
        Loading…
      </div>
    );
  }

  if (error && !salonName) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-red-800">
        {error}
        <div className="mt-4">
          <Link href="/owner/businesses" className="font-medium underline">
            Back to businesses
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className={OWNER_SCREEN_TITLE_CLASSNAME}>{salonName}</h1>
        <p className="mt-1 text-sm text-slate-600">
          Set weekly hours, an optional daily break, and holidays. You can change these anytime from
          your business page.
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {error}
        </div>
      )}

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Weekly hours</h2>
        <div className="mt-4 space-y-3">
          {dayRows.map((row, idx) => (
            <div
              key={row.day_of_week}
              className="flex flex-wrap items-center gap-3 border-b border-slate-100 pb-3 last:border-0"
            >
              <span className="w-10 text-sm font-medium text-slate-700">{DAY_NAMES[idx]}</span>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={row.is_closed}
                  onChange={(e) => {
                    const v = e.target.checked;
                    setDayRows((prev) =>
                      prev.map((r) =>
                        r.day_of_week === row.day_of_week ? { ...r, is_closed: v } : r
                      )
                    );
                  }}
                />
                Closed
              </label>
              {!row.is_closed && (
                <>
                  <input
                    type="time"
                    value={row.opening_time}
                    onChange={(e) => {
                      const v = e.target.value;
                      setDayRows((prev) =>
                        prev.map((r) =>
                          r.day_of_week === row.day_of_week ? { ...r, opening_time: v } : r
                        )
                      );
                    }}
                    className="rounded border border-slate-300 px-2 py-1 text-sm"
                  />
                  <span className="text-slate-500">–</span>
                  <input
                    type="time"
                    value={row.closing_time}
                    onChange={(e) => {
                      const v = e.target.value;
                      setDayRows((prev) =>
                        prev.map((r) =>
                          r.day_of_week === row.day_of_week ? { ...r, closing_time: v } : r
                        )
                      );
                    }}
                    className="rounded border border-slate-300 px-2 py-1 text-sm"
                  />
                </>
              )}
            </div>
          ))}
        </div>
        <button
          type="button"
          disabled={saving}
          onClick={saveHours}
          className="mt-4 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
        >
          Save hours
        </button>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Break (optional)</h2>
        <p className="mt-1 text-sm text-slate-600">
          One break window for a chosen weekday (e.g. lunch).
        </p>
        <label className="mt-3 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={includeBreak}
            onChange={(e) => setIncludeBreak(e.target.checked)}
          />
          Set a break
        </label>
        {includeBreak && (
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <select
              value={breakDay}
              onChange={(e) => setBreakDay(Number(e.target.value))}
              className="rounded border border-slate-300 px-2 py-1 text-sm"
            >
              {DAY_NAMES.map((n, i) => (
                <option key={n} value={i}>
                  {n}
                </option>
              ))}
            </select>
            <input
              type="time"
              value={breakStart}
              onChange={(e) => setBreakStart(e.target.value)}
              className="rounded border border-slate-300 px-2 py-1 text-sm"
            />
            <span className="text-slate-500">–</span>
            <input
              type="time"
              value={breakEnd}
              onChange={(e) => setBreakEnd(e.target.value)}
              className="rounded border border-slate-300 px-2 py-1 text-sm"
            />
          </div>
        )}
        <button
          type="button"
          disabled={saving}
          onClick={saveBreak}
          className="mt-4 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50 disabled:opacity-50"
        >
          {includeBreak ? 'Save break' : 'Clear breaks'}
        </button>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Holiday</h2>
        <div className="mt-3 flex flex-wrap gap-3">
          <input
            type="date"
            value={holidayDate}
            onChange={(e) => setHolidayDate(e.target.value)}
            className="rounded border border-slate-300 px-2 py-1 text-sm"
          />
          <input
            type="text"
            placeholder="Name (optional)"
            value={holidayName}
            onChange={(e) => setHolidayName(e.target.value)}
            className="min-w-[200px] flex-1 rounded border border-slate-300 px-2 py-1 text-sm"
          />
          <button
            type="button"
            disabled={saving || !holidayDate}
            onClick={addHoliday}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
          >
            Add holiday
          </button>
        </div>
      </section>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={finish}
          className="rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
        >
          Go to business dashboard
        </button>
        <Link
          href="/owner/businesses"
          className="rounded-lg border border-slate-300 px-5 py-2.5 text-sm font-medium text-slate-800 hover:bg-slate-50"
        >
          My businesses
        </Link>
      </div>
    </div>
  );
}
