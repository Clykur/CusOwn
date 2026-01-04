import { z } from 'zod';
import { SLOT_DURATIONS, BOOKING_STATUS, SLOT_STATUS } from '@/config/constants';

export const slotDurationSchema = z.enum(SLOT_DURATIONS.map(String) as [string, ...string[]]);

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
  opening_time: z.string().regex(/^([0-1][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$/, 'Invalid time format'),
  closing_time: z.string().regex(/^([0-1][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$/, 'Invalid time format'),
  slot_duration: slotDurationSchema,
  address: z.string().min(5, 'Address must be at least 5 characters').max(500, 'Address must be at most 500 characters'),
  location: z.string().min(2, 'Location must be at least 2 characters').max(100, 'Location must be at most 100 characters'),
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
  booking_link: string;
  address?: string;
  location?: string;
  qr_code?: string | null;
  category?: string;
  created_at: string;
  updated_at: string;
};

export type Slot = {
  id: string;
  business_id: string;
  date: string;
  start_time: string;
  end_time: string;
  status: typeof SLOT_STATUS[keyof typeof SLOT_STATUS];
  reserved_until?: string | null;
  created_at: string;
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
});

export type CreateBookingInput = z.infer<typeof createBookingSchema>;

export type Booking = {
  id: string;
  business_id: string;
  slot_id: string;
  customer_name: string;
  customer_phone: string;
  booking_id: string;
  status: typeof BOOKING_STATUS[keyof typeof BOOKING_STATUS];
  created_at: string;
  updated_at: string;
};

export type BookingWithDetails = Booking & {
  salon?: Salon;
  slot?: Slot;
};

export type ApiResponse<T = unknown> = {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
};

