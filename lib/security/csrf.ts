import { NextRequest, NextResponse } from 'next/server';

const CSRF_TOKEN_HEADER = 'x-csrf-token';
const CSRF_COOKIE_NAME = 'csrf-token';

export const generateCSRFToken = (): string => {
  return Array.from(crypto.getRandomValues(new Uint8Array(32)))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
};

export const setCSRFToken = (response: NextResponse, token: string): void => {
  response.cookies.set(CSRF_COOKIE_NAME, token, {
    httpOnly: false, // Allow client-side access for CSRF token
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 3600,
  });
};

export const validateCSRFToken = async (request: NextRequest): Promise<boolean> => {
  if (request.method === 'GET' || request.method === 'HEAD') {
    return true;
  }

  const cookieToken = request.cookies.get(CSRF_COOKIE_NAME)?.value;
  const headerToken = request.headers.get(CSRF_TOKEN_HEADER);

  if (!cookieToken || !headerToken) {
    return false;
  }

  return cookieToken === headerToken;
};

export const csrfProtection = async (request: NextRequest): Promise<NextResponse | null> => {
  if (request.method === 'GET' || request.method === 'HEAD') {
    const response = NextResponse.next();
    const existingToken = request.cookies.get(CSRF_COOKIE_NAME)?.value;
    if (!existingToken) {
      const token = generateCSRFToken();
      setCSRFToken(response, token);
    }
    return response;
  }

  const origin = request.headers.get('origin');
  const referer = request.headers.get('referer');
  const requestUrl = new URL(request.url);
  const isSameOrigin = origin && new URL(origin).hostname === requestUrl.hostname;
  const isSameOriginReferer = referer && new URL(referer).hostname === requestUrl.hostname;

  // For same-origin requests, validate CSRF token
  if (isSameOrigin || isSameOriginReferer) {
    const isValid = await validateCSRFToken(request);
    if (!isValid) {
      // If token is missing, try to set one and allow the request (first request scenario)
      const cookieToken = request.cookies.get(CSRF_COOKIE_NAME)?.value;
      const headerToken = request.headers.get(CSRF_TOKEN_HEADER);
      
      // If no token exists at all, generate one and allow (for first POST request)
      if (!cookieToken && !headerToken) {
        const response = NextResponse.next();
        const token = generateCSRFToken();
        setCSRFToken(response, token);
        return response;
      }
      
      // If tokens exist but don't match, reject
      return NextResponse.json(
        { error: 'Invalid CSRF token' },
        { status: 403 }
      );
    }
  }

  return null;
};
