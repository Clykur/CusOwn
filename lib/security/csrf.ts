import { NextRequest, NextResponse } from 'next/server';

const CSRF_TOKEN_HEADER = 'x-csrf-token';
const CSRF_COOKIE_NAME = 'csrf-token';

export const generateCSRFToken = (): string => {
  return Array.from(crypto.getRandomValues(new Uint8Array(32)))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
};

export const setCSRFToken = (response: NextResponse, token: string): void => {
  response.cookies.set(CSRF_COOKIE_NAME, token, {
    httpOnly: false, // Allow client-side access for CSRF token
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 3600,
    path: '/',
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

const STATE_CHANGING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

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

  if (!STATE_CHANGING_METHODS.has(request.method)) {
    return null;
  }

  const origin = request.headers.get('origin');
  const referer = request.headers.get('referer');
  const requestUrl = new URL(request.url);
  const isSameOrigin = origin && new URL(origin).hostname === requestUrl.hostname;
  const isSameOriginReferer = referer && new URL(referer).hostname === requestUrl.hostname;

  // Cross-origin state-changing requests: reject (no token validation = no trust)
  if (!isSameOrigin && !isSameOriginReferer) {
    return NextResponse.json(
      {
        error: 'Forbidden: cross-origin state-changing requests are not allowed',
      },
      { status: 403 }
    );
  }

  // Same-origin: validate CSRF token
  const isValid = await validateCSRFToken(request);
  if (!isValid) {
    const cookieToken = request.cookies.get(CSRF_COOKIE_NAME)?.value;
    const headerToken = request.headers.get(CSRF_TOKEN_HEADER);
    if (!cookieToken && !headerToken) {
      const response = NextResponse.next();
      const token = generateCSRFToken();
      setCSRFToken(response, token);
      return response;
    }
    return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });
  }

  return null;
};
