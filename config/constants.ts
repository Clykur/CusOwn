export const SLOT_DURATIONS = [15, 30, 45, 60] as const;

export const BOOKING_STATUS = {
  PENDING: 'pending',
  CONFIRMED: 'confirmed',
  REJECTED: 'rejected',
  CANCELLED: 'cancelled',
} as const;

export const SLOT_STATUS = {
  AVAILABLE: 'available',
  RESERVED: 'reserved',
  BOOKED: 'booked',
} as const;

export const DEFAULT_SLOT_DURATION = 30;

// Generate slots for 7 days initially (matches lazy generation window)
export const DAYS_TO_GENERATE_SLOTS = 7;

import { env } from './env';

export const SLOT_RESERVATION_TIMEOUT_MINUTES = env.payment.slotExpiryMinutes;

// Number of days ahead to generate slots when lazy loading
export const SLOT_GENERATION_WINDOW_DAYS = 7;

export const BOOKING_LINK_PREFIX = '/b/';

export const API_ROUTES = {
  SALONS: '/api/salons',
  SLOTS: '/api/slots',
  BOOKINGS: '/api/bookings',
} as const;

export const ROUTES = {
  HOME: '/',
  SETUP: '/setup',
  BOOKING: '/b',
  ACCEPT: '/accept',
  REJECT: '/reject',
  DASHBOARD: '/dashboard',
} as const;

export const WHATSAPP_MESSAGE_TEMPLATES = {
  BOOKING_REQUEST: (customerName: string, date: string, time: string, bookingId: string) =>
    `📅 *NEW BOOKING REQUEST*\n\n` +
    `Hello! I would like to book an appointment.\n\n` +
    `*Customer Details:*\n` +
    `Name: *${customerName}*\n\n` +
    `*Appointment Details:*\n` +
    `📆 Date: *${date}*\n` +
    `🕐 Time: *${time}*\n\n` +
    `Booking ID: \`${bookingId}\``,
  CONFIRMATION: (customerName: string, date: string, time: string, salonName: string, address: string, mapsLink: string) =>
    `✅ *APPOINTMENT CONFIRMED*\n\n` +
    `Dear *${customerName}*,\n\n` +
    `Your appointment has been confirmed!\n\n` +
    `*Appointment Details:*\n` +
    `📆 Date: *${date}*\n` +
    `🕐 Time: *${time}*\n` +
    `🏢 Salon: *${salonName}*\n\n` +
    `*Location:*\n` +
    `📍 ${address}\n\n` +
    `🗺️ *Get Directions:*\n` +
    `${mapsLink}\n\n` +
    `We look forward to seeing you!\n` +
    `Thank you! 🙏`,
  REJECTION: (customerName: string, bookingLink: string) =>
    `❌ *SLOT UNAVAILABLE*\n\n` +
    `Dear *${customerName}*,\n\n` +
    `We apologize, but the requested time slot is not available.\n\n` +
    `Please select another time slot from our available options:\n\n` +
    `🔗 *Book New Slot:*\n` +
    `${bookingLink}\n\n` +
    `Thank you for your understanding.`,
} as const;

export const VALIDATION = {
  WHATSAPP_NUMBER_MIN_LENGTH: 10,
  WHATSAPP_NUMBER_MAX_LENGTH: 15,
  SALON_NAME_MIN_LENGTH: 2,
  SALON_NAME_MAX_LENGTH: 100,
  OWNER_NAME_MIN_LENGTH: 2,
  OWNER_NAME_MAX_LENGTH: 100,
  ADDRESS_MIN_LENGTH: 5,
  ADDRESS_MAX_LENGTH: 500,
} as const;

export const ERROR_MESSAGES = {
  SALON_NAME_REQUIRED: 'Salon name is required',
  SALON_NAME_INVALID: `Salon name must be between ${VALIDATION.SALON_NAME_MIN_LENGTH} and ${VALIDATION.SALON_NAME_MAX_LENGTH} characters`,
  OWNER_NAME_REQUIRED: 'Owner name is required',
  OWNER_NAME_INVALID: `Owner name must be between ${VALIDATION.OWNER_NAME_MIN_LENGTH} and ${VALIDATION.OWNER_NAME_MAX_LENGTH} characters`,
  WHATSAPP_NUMBER_REQUIRED: 'WhatsApp number is required',
  WHATSAPP_NUMBER_INVALID: 'Invalid WhatsApp number format',
  ADDRESS_REQUIRED: 'Address is required',
  ADDRESS_INVALID: `Address must be between ${VALIDATION.ADDRESS_MIN_LENGTH} and ${VALIDATION.ADDRESS_MAX_LENGTH} characters`,
  OPENING_TIME_REQUIRED: 'Opening time is required',
  CLOSING_TIME_REQUIRED: 'Closing time is required',
  SLOT_DURATION_REQUIRED: 'Slot duration is required',
  SLOT_DURATION_INVALID: 'Invalid slot duration',
  TIME_INVALID: 'Closing time must be after opening time',
  SALON_NOT_FOUND: 'Salon not found',
  BOOKING_LINK_EXISTS: 'Booking link already exists. Please try a different salon name',
  SLOT_GENERATION_FAILED: 'Failed to generate slots',
  DATABASE_ERROR: 'Database error occurred',
  SLOT_NOT_FOUND: 'Slot not found',
  SLOT_NOT_AVAILABLE: 'This slot is no longer available',
  BOOKING_NOT_FOUND: 'Booking not found',
  CUSTOMER_NAME_REQUIRED: 'Customer name is required',
  CUSTOMER_PHONE_REQUIRED: 'Customer phone number is required',
  CUSTOMER_PHONE_INVALID: 'Invalid phone number format',
  BOOKING_ID_REQUIRED: 'Booking ID is required',
  WHATSAPP_SEND_FAILED: 'Failed to send WhatsApp message',
  WHATSAPP_NUMBER_EXISTS: 'This WhatsApp number is already registered. Please use a different number or contact support if this is your number.',
  QR_CODE_GENERATION_FAILED: 'Unable to generate QR code. You can access it later from your dashboard.',
  NETWORK_ERROR: 'Unable to connect to the server. Please check your internet connection and try again.',
  UNEXPECTED_ERROR: 'An unexpected error occurred. Please try again.',
  LOADING_ERROR: 'Failed to load data. Please refresh the page and try again.',
  BOOKING_CANNOT_BE_CANCELLED: 'This booking cannot be cancelled',
  BOOKING_ALREADY_CANCELLED: 'This booking is already cancelled',
  CANCELLATION_TOO_LATE: 'Cancellation must be at least 2 hours before appointment',
  DOWNTIME_DATE_INVALID: 'Invalid date range for closure',
  REMINDER_NOT_FOUND: 'Reminder not found',
  REMINDER_ALREADY_SENT: 'Reminder already sent',
} as const;

export const SUCCESS_MESSAGES = {
  SALON_CREATED: 'Salon created successfully',
  SLOTS_GENERATED: 'Slots generated successfully',
  SLOT_RESERVED: 'Slot reserved successfully',
  SLOT_RELEASED: 'Slot released successfully',
  BOOKING_CREATED: 'Booking created successfully',
  BOOKING_CONFIRMED: 'Booking confirmed successfully',
  BOOKING_REJECTED: 'Booking rejected successfully',
  BOOKING_CANCELLED: 'Booking cancelled successfully',
  REMINDER_SENT: 'Reminder sent successfully',
} as const;

export const BOOKING_EXPIRY_HOURS = parseInt(process.env.BOOKING_EXPIRY_HOURS || '24', 10);
export const REMINDER_24H_BEFORE_HOURS = parseInt(process.env.REMINDER_24H_BEFORE_HOURS || '24', 10);
export const REMINDER_2H_BEFORE_HOURS = parseInt(process.env.REMINDER_2H_BEFORE_HOURS || '2', 10);
export const CANCELLATION_MIN_HOURS_BEFORE = parseInt(process.env.CANCELLATION_MIN_HOURS_BEFORE || '2', 10);

