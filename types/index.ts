import { z } from 'zod';
import {
  SLOT_DURATIONS,
  BOOKING_STATUS,
  SLOT_STATUS,
  MAX_CONCURRENT_BOOKING_CAPACITY,
} from '@/config/constants';

export const slotDurationSchema = z.enum(SLOT_DURATIONS.map(String) as [string, ...string[]]);

/** Accepts HH:MM or HH:MM:SS (IST wall-clock). */
const wallTimeSchema = z.preprocess(
  (v) => {
    if (typeof v !== 'string') return v;
    const t = v.trim();
    return t.length === 5 && /^\d{2}:\d{2}$/.test(t) ? `${t}:00` : t;
  },
  z.string().regex(/^([0-1][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$/, 'Invalid time format')
);

const weeklyHourRowSchema = z.object({
  day: z.string().min(1),
  open: wallTimeSchema,
  close: wallTimeSchema,
  is_closed: z.boolean().optional(),
});

const breakRowSchema = z.object({
  day: z.string().min(1),
  start: wallTimeSchema,
  end: wallTimeSchema,
});

const holidayRowSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  reason: z.string().max(200).optional(),
});

const closureRowSchema = z.object({
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  reason: z.string().max(200).optional(),
});

const createSalonServiceRowSchema = z.object({
  name: z.string().min(1).max(200),
  duration_minutes: z.coerce.number().int().positive(),
  price_cents: z.coerce.number().int().min(0),
});

export const createSalonSchema = z.object({
  salon_name: z
    .string()
    .min(2, 'Salon name must be at least 2 characters')
    .max(100, 'Salon name must be at most 100 characters'),
  owner_name: z
    .string()
    .min(2, 'Owner name must be at least 2 characters')
    .max(100, 'Owner name must be at most 100 characters'),
  whatsapp_number: z
    .string()
    .min(10, 'WhatsApp number must be at least 10 digits')
    .max(15, 'WhatsApp number must be at most 15 digits')
    .regex(/^\+?[1-9]\d{1,14}$/, 'Invalid WhatsApp number format'),
  opening_time: wallTimeSchema,
  closing_time: wallTimeSchema,
  slot_duration: slotDurationSchema,
  address: z
    .string()
    .min(5, 'Address must be at least 5 characters')
    .max(500, 'Address must be at most 500 characters'),
  location: z
    .string()
    .min(2, 'Location must be at least 2 characters')
    .max(100, 'Location must be at most 100 characters'),
  city: z.string().max(100, 'City must be at most 100 characters').optional(),
  area: z.string().max(100, 'Area must be at most 100 characters').optional(),
  pincode: z.string().max(10, 'Pincode must be at most 10 characters').optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  category: z.string().max(50).optional().default('salon'),
  concurrent_booking_capacity: z.coerce
    .number()
    .int()
    .min(1)
    .max(MAX_CONCURRENT_BOOKING_CAPACITY)
    .optional(),
  address_line1: z.string().max(300).optional(),
  address_line2: z.string().max(300).optional(),
  state: z.string().max(100).optional(),
  country: z.string().max(100).optional(),
  postal_code: z.string().max(20).optional(),
  weekly_hours: z.array(weeklyHourRowSchema).optional(),
  breaks: z.array(breakRowSchema).optional(),
  holidays: z.array(holidayRowSchema).optional(),
  closures: z.array(closureRowSchema).optional(),
  services: z.array(createSalonServiceRowSchema).max(50).optional(),
});

export type CreateSalonInput = z.infer<typeof createSalonSchema>;

export type Salon = {
  id: string;
  salon_name: string;
  owner_name: string;
  whatsapp_number: string;
  opening_time: string;
  closing_time: string;
  slot_duration: number;
  /** Max overlapping appointments; businesses.concurrent_booking_capacity. */
  concurrent_booking_capacity?: number;
  booking_link: string;
  address?: string;
  location?: string;
  city?: string | null;
  area?: string | null;
  pincode?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  address_line1?: string | null;
  address_line2?: string | null;
  state?: string | null;
  country?: string | null;
  postal_code?: string | null;
  qr_code?: string | null;
  category?: string;
  owner_user_id?: string | null;
  suspended?: boolean;
  created_at: string;
  updated_at: string;
  /** Cached average of visible reviews; from businesses.rating_avg */
  rating_avg?: number | null;
  /** Count of visible reviews; from businesses.review_count */
  review_count?: number | null;
};

/** Public business shape for QR booking: no owner_user_id, no owner_name. */
export type PublicBusiness = {
  id: string;
  salon_name: string;
  opening_time: string;
  closing_time: string;
  slot_duration: number;
  booking_link: string;
  address: string | null;
  location: string | null;
};

export type Slot = {
  id: string;
  business_id: string;
  date: string;
  start_time: string;
  end_time: string;
  status: (typeof SLOT_STATUS)[keyof typeof SLOT_STATUS];
  reserved_until?: string | null;
  created_at: string;
  /** Set by Realtime payload; used for event_id deduplication. */
  updated_at?: string | null;
};

export const createBookingSchema = z.object({
  salon_id: z.string().uuid('Invalid salon ID'),
  slot_id: z.string().uuid('Invalid slot ID'),
  customer_name: z.string().min(2, 'Customer name must be at least 2 characters').max(100),
  customer_phone: z
    .string()
    .min(10, 'Phone number must be at least 10 digits')
    .max(15, 'Phone number must be at most 15 digits')
    .regex(/^\+?[1-9]\d{1,14}$/, 'Invalid phone number format'),
  service_ids: z.array(z.string().uuid()).max(10, 'At most 10 services per booking').optional(),
});

export type CreateBookingInput = z.infer<typeof createBookingSchema>;

export type Booking = {
  id: string;
  business_id: string;
  slot_id: string;
  customer_name: string;
  customer_phone: string;
  booking_id: string;
  status: (typeof BOOKING_STATUS)[keyof typeof BOOKING_STATUS];
  customer_user_id?: string | null;
  total_duration_minutes?: number | null;
  total_price_cents?: number | null;
  services_count?: number | null;
  cancelled_by?: 'customer' | 'owner' | 'system' | null;
  cancellation_reason?: string | null;
  cancelled_at?: string | null;
  rescheduled_from_booking_id?: string | null;
  rescheduled_at?: string | null;
  rescheduled_by?: 'customer' | 'owner' | null;
  reschedule_reason?: string | null;
  reschedule_count?: number;
  late_cancellation?: boolean;
  no_show?: boolean;
  no_show_marked_at?: string | null;
  no_show_marked_by?: 'owner' | 'system' | null;
  created_at: string;
  updated_at: string;
  undo_used_at?: string | null;
};

export type BookingReview = {
  rating: number;
  comment: string | null;
};

export type BookingWithDetails = Booking & {
  salon?: Salon;
  slot?: Slot;
  service_name?: string;
  services?: { id: string; name: string }[];
  review?: BookingReview;
};

export type ApiResponse<T = unknown> = {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  code?: string;
};

/** Admin analytics: revenue metrics response */
export type AdminRevenueMetrics = {
  totalRevenue: number;
  revenueToday: number;
  revenueWeek: number;
  revenueMonth: number;
  avgBookingValue: number;
  paymentSuccessRate: number;
  failedPayments: number;
  failedPaymentsPct: number;
  revenueTrend: { date: string; revenue: number }[];
  paymentStatusDistribution: { status: string; count: number }[];
  revenueByBusiness: { business_id: string; name: string; revenue: number }[];
};

/** Admin analytics: booking funnel response */
export type AdminBookingFunnel = {
  attempts: number;
  confirmed: number;
  rejected: number;
  cancelled: number;
  expired: number;
  conversionRate: number;
  avgTimeToAcceptMinutes: number;
  autoExpiredPct: number;
};

/** Admin analytics: business health item */
export type AdminBusinessHealthItem = {
  business_id: string;
  name: string;
  healthScore: number;
  acceptanceRate: number;
  cancellationRate: number;
  paymentSuccessRate: number;
  avgResponseTimeMinutes: number;
  revenue: number;
};

/** Admin analytics: system metrics response */
export type AdminSystemMetrics = {
  avgResponseTimeMs: number;
  p95LatencyMs: number;
  rateLimitHits429: number;
  failedCalls5xx: number;
  cronExpireBookingsLastRun: string | null;
  cronExpireBookingsOk: boolean;
};

/** Media record (DB). */
export type Media = {
  id: string;
  entity_type: 'business' | 'profile';
  entity_id: string;
  storage_path: string;
  bucket_name: string;
  content_type: string;
  size_bytes: number;
  sort_order: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  content_hash?: string | null;
  etag?: string | null;
  processing_status?: string | null;
  variants?: MediaVariants | null;
  content_type_resolved?: string | null;
  recompressed_at?: string | null;
  purged_at?: string | null;
};

/** Variants metadata (thumbnail, medium, large). */
export type MediaVariants = {
  thumbnail?: { path: string; width?: number; height?: number };
  medium?: { path: string; width?: number; height?: number };
  large?: { path: string; width?: number; height?: number };
};

/** Media list item (no internal path; optional etag for cache). */
export type MediaListItem = Pick<
  Media,
  | 'id'
  | 'entity_type'
  | 'entity_id'
  | 'content_type'
  | 'size_bytes'
  | 'sort_order'
  | 'created_at'
  | 'etag'
  | 'variants'
>;

/** Upload response: media record + optional signed URL. */
export type MediaUploadResponse = {
  media: MediaListItem;
  signedUrl?: string;
  expiresAt?: string;
};
