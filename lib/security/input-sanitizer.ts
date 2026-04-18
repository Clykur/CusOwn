import { NextRequest } from 'next/server';

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

export const isValidToken = (input: string): boolean => {
  return (
    typeof input === 'string' &&
    input.length >= 32 &&
    input.length <= 4096 &&
    /^[a-zA-Z0-9_-]+$/.test(input)
  );
};

export const sanitizeString = (input: string): string => {
  if (typeof input !== 'string') {
    return '';
  }
  const trimmed = input.trim();

  return trimmed.replace(/[^a-zA-Z0-9@._+=\- /]/g, '');
};

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

export const sanitizeEmail = (input: string): string | null => {
  const sanitized = sanitizeString(input);
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(sanitized) ? sanitized : null;
};

export const sanitizePhone = (input: string): string | null => {
  const sanitized = sanitizeString(input).replace(/\s+/g, '');
  const phoneRegex = /^\+?[1-9]\d{1,14}$/;
  return phoneRegex.test(sanitized) ? sanitized : null;
};

export const sanitizeUUID = (input: string): string | null => {
  const sanitized = sanitizeString(input);
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(sanitized) ? sanitized : null;
};

export const sanitizeDate = (input: string): string | null => {
  const sanitized = sanitizeString(input);
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(sanitized)) {
    return null;
  }
  const date = new Date(sanitized);
  return isNaN(date.getTime()) ? null : sanitized;
};

export const sanitizeTime = (input: string): string | null => {
  const sanitized = sanitizeString(input);
  const timeRegex = /^([0-1][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$/;
  return timeRegex.test(sanitized) ? sanitized : null;
};

export const sanitizeObject = <T extends Record<string, any>>(
  obj: T,
  schema: Record<keyof T, (value: any) => any>
): Partial<T> => {
  const sanitized: Partial<T> = {};
  for (const [key, sanitizer] of Object.entries(schema)) {
    if (key in obj) {
      const result = sanitizer(obj[key]);
      if (result !== null && result !== undefined) {
        sanitized[key as keyof T] = result;
      }
    }
  }
  return sanitized;
};

export const sanitizeRequestBody = async (request: NextRequest): Promise<any> => {
  try {
    const body = await request.json();
    if (typeof body !== 'object' || body === null || Array.isArray(body)) {
      return null;
    }
    return body;
  } catch {
    return null;
  }
};
