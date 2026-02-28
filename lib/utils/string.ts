export const generateSlug = (text: string): string => {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
};

export const generateUniqueId = (): string => {
  return Math.random().toString(36).substring(2, 9).toUpperCase();
};

export const formatTime = (time: string): string => {
  const [hours, minutes] = time.split(':');
  return `${hours}:${minutes}`;
};

export const formatDate = (date: string | Date): string => {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-IN', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
};

/**
 * Format phone number with +91 country code if not already present
 * Removes spaces and ensures +91 prefix for Indian numbers
 */
export const formatPhoneNumber = (phone: string): string => {
  // Remove all spaces and special characters except + and digits
  let cleaned = phone.replace(/[\s-()]/g, '');

  // If already starts with +91, return as is
  if (cleaned.startsWith('+91')) {
    return cleaned;
  }

  // If starts with 91 (without +), add +
  if (cleaned.startsWith('91') && cleaned.length >= 12) {
    return `+${cleaned}`;
  }

  // If starts with 0, remove it
  if (cleaned.startsWith('0')) {
    cleaned = cleaned.substring(1);
  }

  // If it's a 10-digit number, add +91
  if (/^\d{10}$/.test(cleaned)) {
    return `+91${cleaned}`;
  }

  // If it's already in correct format, return as is
  if (cleaned.startsWith('+')) {
    return cleaned;
  }

  // Default: add +91 if it looks like a valid number
  if (/^\d{10,12}$/.test(cleaned)) {
    return `+91${cleaned.slice(-10)}`; // Take last 10 digits and add +91
  }

  // Return cleaned number (validation will catch invalid formats)
  return cleaned;
};
