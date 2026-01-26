import { NextRequest } from 'next/server';
import { successResponse } from '@/lib/utils/response';
import { generateCSRFToken, setCSRFToken } from '@/lib/security/csrf';
import { NextResponse } from 'next/server';

/**
 * GET /api/csrf-token
 * Returns CSRF token for client-side use
 */
export async function GET(request: NextRequest) {
  const existingToken = request.cookies.get('csrf-token')?.value;
  
  if (existingToken) {
    const response = successResponse({ token: existingToken });
    return response;
  }

  const token = generateCSRFToken();
  const response = successResponse({ token });
  setCSRFToken(response, token);
  return response;
}
