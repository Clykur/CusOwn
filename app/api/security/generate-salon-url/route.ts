import { NextRequest, NextResponse } from 'next/server';
import { getSecureSalonUrl } from '@/lib/utils/security';
import { isValidUUID } from '@/lib/utils/security';
import { successResponse, errorResponse } from '@/lib/utils/response';
import { enhancedRateLimit } from '@/lib/security/rate-limit-enhanced';

// Rate limit: 50 requests per minute per IP
const strictRateLimit = enhancedRateLimit({ maxRequests: 50, windowMs: 60000, perIP: true, keyPrefix: 'secure_url_gen' });

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  console.log('[URL_GEN] Starting secure URL generation request');
  
  try {
    // Apply rate limiting
    console.log('[URL_GEN] Checking rate limits...');
    const rateLimitResponse = await strictRateLimit(request);
    if (rateLimitResponse) {
      console.warn('[URL_GEN] Rate limit exceeded');
      return rateLimitResponse;
    }
    console.log('[URL_GEN] Rate limit check passed');

    // Parse request body
    console.log('[URL_GEN] Parsing request body...');
    let body;
    try {
      body = await request.json();
      console.log('[URL_GEN] Request body parsed successfully');
    } catch (parseError) {
      console.error('[URL_GEN] Failed to parse request body:', parseError);
      return errorResponse('Invalid request body', 400);
    }

    const { salonId } = body;
    console.log('[URL_GEN] Received salonId:', salonId ? `${salonId.substring(0, 8)}...` : 'missing');

    if (!salonId || typeof salonId !== 'string') {
      console.error('[URL_GEN] Validation failed: Salon ID is missing or invalid type');
      return errorResponse('Salon ID is required', 400);
    }

    console.log('[URL_GEN] Validating UUID format...');
    if (!isValidUUID(salonId)) {
      console.error('[URL_GEN] Validation failed: Invalid UUID format for salonId:', salonId);
      return errorResponse('Invalid salon ID format', 400);
    }
    console.log('[URL_GEN] UUID format validation passed');

    // Generate secure URL
    console.log('[URL_GEN] Generating secure URL for salon:', salonId.substring(0, 8) + '...');
    let secureUrl: string;
    try {
      secureUrl = getSecureSalonUrl(salonId);
      console.log('[URL_GEN] Secure URL generated:', secureUrl.substring(0, 50) + '...');
    } catch (urlError) {
      console.error('[URL_GEN] Error in getSecureSalonUrl:', urlError);
      throw urlError;
    }

    // Process URL path
    console.log('[URL_GEN] Processing URL path...');
    const urlPath = secureUrl.replace(/^https?:\/\/[^/]+/, ''); // Remove base URL if present
    console.log('[URL_GEN] URL path:', urlPath.substring(0, 80) + '...');
    
    // Extract and validate token
    console.log('[URL_GEN] Extracting token from URL...');
    let urlObj: URL;
    let token: string | null;
    try {
      urlObj = new URL(urlPath, 'http://localhost');
      token = urlObj.searchParams.get('token');
      console.log('[URL_GEN] Token extracted, length:', token?.length || 0);
    } catch (urlParseError) {
      console.error('[URL_GEN] Failed to parse URL:', urlParseError, 'URL:', urlPath);
      throw urlParseError;
    }
    
    if (!token) {
      console.error('[URL_GEN] Token validation failed: Token is missing');
      return errorResponse('Failed to generate secure token', 500);
    }

    if (token.length !== 64) {
      console.error('[URL_GEN] Token validation failed: Invalid token length', {
        expected: 64,
        actual: token.length,
        tokenPreview: token.substring(0, 20) + '...'
      });
      return errorResponse('Failed to generate secure token', 500);
    }
    console.log('[URL_GEN] Token validation passed, length:', token.length);

    // Security: Add metadata about token expiration
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours from now
    console.log('[URL_GEN] Token expires at:', expiresAt.toISOString());

    const duration = Date.now() - startTime;
    console.log(`[URL_GEN] Successfully generated secure URL in ${duration}ms for salon: ${salonId.substring(0, 8)}...`);

    return successResponse({ 
      url: urlPath,
      expiresAt: expiresAt.toISOString(),
      // Note: Tokens are valid for 24 hours
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[URL_GEN] Error generating secure salon URL after ${duration}ms:`, error);
    if (error instanceof Error) {
      console.error('[URL_GEN] Error stack:', error.stack);
    }
    return errorResponse('Failed to generate secure URL', 500);
  }
}
