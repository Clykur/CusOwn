// Environment-agnostic security helpers
export type ResourceType =
  | 'salon'
  | 'booking'
  | 'booking-status'
  | 'owner-dashboard'
  | 'accept'
  | 'reject'
  | 'admin-business'
  | 'admin-booking';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const isValidUUID = (id: string): boolean => {
  return UUID_REGEX.test(id);
};

export const sanitizeInput = (input: string): string => {
  return input.trim().replace(/[<>]/g, '');
};

export {
  sanitizeString,
  sanitizeNumber,
  sanitizeInteger,
  sanitizeEmail,
  sanitizePhone,
  sanitizeUUID,
  sanitizeDate,
  sanitizeTime,
  sanitizeObject,
} from '../security/input-sanitizer';

// Note: generateResourceToken, validateResourceToken, and getSecureResourceUrl 
// are available in security.server.ts for Node.js environments.
