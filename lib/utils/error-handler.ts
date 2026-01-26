/**
 * Centralized error handling utility
 * Converts technical errors to user-friendly messages
 */

export const getUserFriendlyError = (error: unknown): string => {
  // If it's already a user-friendly string, return it
  if (typeof error === 'string') {
    return error;
  }

  // If it's an Error object, check for known error messages
  if (error instanceof Error) {
    const message = error.message.toLowerCase();

    // Network/API errors
    if (message.includes('fetch') || message.includes('network') || message.includes('failed to fetch')) {
      return 'Unable to connect to the server. Please check your internet connection and try again.';
    }

    // Database constraint violations (unique, foreign key, etc.)
    if (message.includes('duplicate key') || message.includes('unique constraint')) {
      // Check for specific constraint violations
      if (message.includes('whatsapp_number')) {
        return 'This WhatsApp number is already registered. Please use a different number or contact support if this is your number.';
      }
      if (message.includes('booking_link')) {
        return 'This booking link already exists. Please try a different salon name.';
      }
      return 'This information already exists in our system. Please use different details.';
    }

    // Database errors
    if (message.includes('database') || message.includes('sql') || message.includes('query') || message.includes('constraint')) {
      return 'A database error occurred. Please try again in a moment.';
    }

    // Validation errors
    if (message.includes('required') || message.includes('invalid') || message.includes('must be')) {
      return error.message; // Keep validation messages as they're usually user-friendly
    }

    // Not found errors
    if (message.includes('not found') || message.includes('404')) {
      return 'The requested resource was not found. Please check and try again.';
    }

    // Permission errors
    if (message.includes('permission') || message.includes('unauthorized') || message.includes('403')) {
      return 'You do not have permission to perform this action.';
    }

    // Server errors
    if (message.includes('500') || message.includes('internal server')) {
      return 'An internal server error occurred. Please try again later.';
    }

    // QR code errors
    if (message.includes('qr') || message.includes('qrcode')) {
      return 'Unable to generate QR code. You can access it later from your dashboard.';
    }

    // Default: return the error message if it seems user-friendly, otherwise generic message
    if (error.message.length < 100 && !error.message.includes('error:') && !error.message.includes('at ')) {
      return error.message;
    }
  }

  // Generic fallback
  return 'An unexpected error occurred. Please try again.';
};

/**
 * Log error to console (only in development)
 * Never expose technical details to users
 */
export const logError = (error: unknown, context?: string): void => {
  if (process.env.NODE_ENV === 'development') {
    if (context) {
      console.error(`[${context}]`, error);
    } else {
      console.error(error);
    }
  }

  if (typeof window !== 'undefined' && (window as any).Sentry) {
    (window as any).Sentry.captureException(error, { tags: { context } });
  }

  if (context && typeof window === 'undefined') {
    // Server-side error logging
    const errorObj = error instanceof Error ? error : new Error(String(error));
    // Performance monitoring can be added here if needed
  }
};

/**
 * Handle API errors and return user-friendly message
 */
export const handleApiError = async (response: Response): Promise<string> => {
  try {
    const data = await response.json();
    
    // Check if API returned a user-friendly error message
    if (data.error && typeof data.error === 'string') {
      return getUserFriendlyError(data.error);
    }
    
    if (data.message && typeof data.message === 'string') {
      return getUserFriendlyError(data.message);
    }
  } catch {
    // If response is not JSON, use status code
  }

  // Use HTTP status code to determine error
  switch (response.status) {
    case 400:
      return 'Invalid request. Please check your input and try again.';
    case 401:
      return 'You are not authorized to perform this action.';
    case 403:
      return 'Access denied. You do not have permission.';
    case 404:
      return 'The requested resource was not found.';
    case 409:
      return 'This resource already exists or is in conflict.';
    case 429:
      return 'Too many requests. Please wait a moment and try again.';
    case 500:
      return 'A server error occurred. Please try again later.';
    case 503:
      return 'Service temporarily unavailable. Please try again later.';
    default:
      return 'An error occurred. Please try again.';
  }
};

