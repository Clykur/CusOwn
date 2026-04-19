import { NextRequest } from 'next/server';

/* =========================
   BASIC STRING HELPERS
========================= */

export const getValidString = (input: unknown, maxLen: number = 100): string | null => {
  if (typeof input !== 'string') return null;
  const trimmed = input.trim();
  if (trimmed.length === 0 || trimmed.length > maxLen) return null;
  return trimmed;
};

export const requireString = (input: unknown, fieldName: string = 'value'): string => {
  const valid = getValidString(input, 1000);
  if (!valid) {
    throw new Error(`Invalid or missing ${fieldName}: must be non-empty string <=1000 chars`);
  }
  return valid;
};

/* =========================
   TOKEN VALIDATION
========================= */

export const isValidToken = (input: string): boolean => {
  return (
    typeof input === 'string' &&
    input.length >= 32 &&
    input.length <= 4096 &&
    /^[a-zA-Z0-9_-]+$/.test(input)
  );
};

/* =========================
   CLEANING (GENERIC)
========================= */

export const cleanString = (input: unknown): string => {
  if (typeof input !== 'string') return '';

  const trimmed = input.trim();

  if (trimmed.length > 1000) {
    return trimmed.slice(0, 1000);
  }

  return trimmed.replace(/[^a-zA-Z0-9@._+=\- /]/g, '');
};

/* BACKWARD COMPATIBILITY */
export const sanitizeString = (input: unknown): string => {
  if (typeof input !== 'string') {
    return '';
  }

  let sanitized = input.trim();
  let previous: string;

  do {
    previous = sanitized;

    sanitized = sanitized
      .replace(/[<>]/g, '')
      .replace(/javascript:/gi, '')
      .replace(/data:/gi, '')
      .replace(/vbscript:/gi, '')
      .replace(/on\w+=/gi, '')
      .replace(/script/gi, '');
  } while (sanitized !== previous);

  return sanitized;
};

/* =========================
   VALIDATION (STRICT)
========================= */

export const sanitizeEmail = (input: string): string | null => {
  if (typeof input !== 'string') return null;

  const trimmed = input.trim();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  return emailRegex.test(trimmed) ? trimmed : null;
};

export const sanitizePhone = (input: string): string | null => {
  if (typeof input !== 'string') return null;

  const trimmed = input.trim().replace(/\s+/g, '');
  const phoneRegex = /^\+?[1-9]\d{1,14}$/;

  return phoneRegex.test(trimmed) ? trimmed : null;
};

export const sanitizeUUID = (input: string): string | null => {
  if (typeof input !== 'string') return null;

  const trimmed = input.trim();
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  return uuidRegex.test(trimmed) ? trimmed : null;
};

export const sanitizeDate = (input: string): string | null => {
  if (typeof input !== 'string') return null;

  const trimmed = input.trim();
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(trimmed)) return null;

  const [yearStr, monthStr, dayStr] = trimmed.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);
  const day = parseInt(dayStr, 10);

  if (month < 1 || month > 12 || day < 1) return null;

  const daysInMonth = new Date(year, month, 0).getDate();
  if (day > daysInMonth) return null;

  return trimmed;
};

export const sanitizeTime = (input: string): string | null => {
  if (typeof input !== 'string') return null;

  const trimmed = input.trim();

  const timeRegex = /^([0-1][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$/;
  return timeRegex.test(trimmed) ? trimmed : null;
};

/* =========================
   NUMBER HELPERS
========================= */

export const sanitizeNumber = (input: unknown): number | null => {
  if (typeof input === 'number') {
    return isNaN(input) || !isFinite(input) ? null : input;
  }
  if (typeof input === 'string') {
    const parsed = parseFloat(input);
    return isNaN(parsed) || !isFinite(parsed) ? null : parsed;
  }
  return null;
};

export const sanitizeInteger = (input: unknown): number | null => {
  const num = sanitizeNumber(input);
  return num !== null ? Math.floor(num) : null;
};

/* =========================
   OBJECT SANITIZATION
========================= */

export const sanitizeObject = <T extends Record<string, any>>(
  obj: T,
  schema: Record<keyof T, (value: any) => any>
): Partial<T> => {
  const sanitized: Partial<T> = {};

  (Object.keys(schema) as Array<keyof T>).forEach((key) => {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const result = schema[key](obj[key]);
      if (result !== null && result !== undefined) {
        sanitized[key] = result;
      }
    }
  });

  return sanitized;
};

/* =========================
   REQUEST BODY
========================= */

export const sanitizeRequestBody = async (request: NextRequest): Promise<any> => {
  try {
    const body = await request.json();

    if (typeof body !== 'object' || body === null || Array.isArray(body)) {
      return null;
    }

    return { ...body }; // prevent mutation issues
  } catch {
    return null;
  }
};
