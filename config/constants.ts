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

export const DAYS_TO_GENERATE_SLOTS = 2;

// Slot reservation timeout in minutes (5-10 minutes recommended)
export const SLOT_RESERVATION_TIMEOUT_MINUTES = 10;

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
    `Hi, my name is ${customerName}. I want an appointment on ${date} at ${time}. Booking ID: ${bookingId}`,
  CONFIRMATION: (customerName: string, date: string, time: string, salonName: string, address?: string) =>
    `${customerName}, your appointment is confirmed for ${date} at ${time} at ${salonName}.${address ? ` Address: ${address}.` : ''} See you soon! 💇‍♀️`,
  REJECTION: (customerName: string, bookingLink: string) =>
    `Sorry ${customerName}, that slot is unavailable. Please choose another time: ${bookingLink}`,
} as const;

export const VALIDATION = {
  WHATSAPP_NUMBER_MIN_LENGTH: 10,
  WHATSAPP_NUMBER_MAX_LENGTH: 15,
  SALON_NAME_MIN_LENGTH: 2,
  SALON_NAME_MAX_LENGTH: 100,
  OWNER_NAME_MIN_LENGTH: 2,
  OWNER_NAME_MAX_LENGTH: 100,
  ADDRESS_MAX_LENGTH: 500,
} as const;

export const ERROR_MESSAGES = {
  SALON_NAME_REQUIRED: 'Salon name is required',
  SALON_NAME_INVALID: `Salon name must be between ${VALIDATION.SALON_NAME_MIN_LENGTH} and ${VALIDATION.SALON_NAME_MAX_LENGTH} characters`,
  OWNER_NAME_REQUIRED: 'Owner name is required',
  OWNER_NAME_INVALID: `Owner name must be between ${VALIDATION.OWNER_NAME_MIN_LENGTH} and ${VALIDATION.OWNER_NAME_MAX_LENGTH} characters`,
  WHATSAPP_NUMBER_REQUIRED: 'WhatsApp number is required',
  WHATSAPP_NUMBER_INVALID: 'Invalid WhatsApp number format',
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
} as const;

export const SUCCESS_MESSAGES = {
  SALON_CREATED: 'Salon created successfully',
  SLOTS_GENERATED: 'Slots generated successfully',
  SLOT_RESERVED: 'Slot reserved successfully',
  SLOT_RELEASED: 'Slot released successfully',
  BOOKING_CREATED: 'Booking created successfully',
  BOOKING_CONFIRMED: 'Booking confirmed successfully',
  BOOKING_REJECTED: 'Booking rejected successfully',
} as const;

export const BOOKING_EXPIRY_HOURS = 24;

