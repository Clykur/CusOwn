/**
 * Client-side CSRF token utility
 * Fetches CSRF token from server and includes it in requests
 */

const CSRF_TOKEN_HEADER = 'x-csrf-token';
let cachedToken: string | null = null;

/**
 * Get CSRF token from cookie or fetch from API
 */
export const getCSRFToken = async (): Promise<string | null> => {
  // Return cached token if available
  if (cachedToken) {
    return cachedToken;
  }

  try {
    // Try to read from cookie first
    if (typeof document !== 'undefined') {
      const cookies = document.cookie.split(';');
      const csrfCookie = cookies.find(c => c.trim().startsWith('csrf-token='));
      if (csrfCookie) {
        const token = csrfCookie.split('=')[1]?.trim() || null;
        if (token) {
          cachedToken = token;
          return token;
        }
      }
    }

    // Fetch token from API endpoint
    const response = await fetch('/api/csrf-token', {
      method: 'GET',
      credentials: 'include',
    });

    if (response.ok) {
      const result = await response.json();
      if (result.success && result.data?.token) {
        cachedToken = result.data.token;
        return result.data.token;
      }
    }
  } catch (error) {
    console.error('Error fetching CSRF token:', error);
  }
  
  return null;
};

/**
 * Clear cached CSRF token (useful after errors)
 */
export const clearCSRFToken = (): void => {
  cachedToken = null;
};
