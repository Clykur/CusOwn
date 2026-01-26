import { NextRequest, NextResponse } from 'next/server';
import { getSecureResourceUrl, isValidUUID } from '@/lib/utils/security';
import { successResponse, errorResponse } from '@/lib/utils/response';
import { enhancedRateLimit } from '@/lib/security/rate-limit-enhanced';
import { getServerUser } from '@/lib/supabase/server-auth';
import { userService } from '@/services/user.service';
import { salonService } from '@/services/salon.service';
import { bookingService } from '@/services/booking.service';

const resourceUrlRateLimit = enhancedRateLimit({ maxRequests: 50, windowMs: 60000, perIP: true, keyPrefix: 'resource_url_gen' });

const RESOURCE_TYPES = ['salon', 'booking', 'booking-status', 'owner-dashboard', 'accept', 'reject', 'admin-business', 'admin-booking'] as const;
type ResourceType = typeof RESOURCE_TYPES[number];

export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = await resourceUrlRateLimit(request);
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    const body = await request.json();
    const { resourceType, resourceId } = body;

    if (!resourceType || !RESOURCE_TYPES.includes(resourceType as ResourceType)) {
      return errorResponse('Invalid resource type', 400);
    }

    if (!resourceId || typeof resourceId !== 'string') {
      return errorResponse('Resource ID is required', 400);
    }

    // Authorization checks based on resource type
    const user = await getServerUser(request);
    
    if (resourceType === 'owner-dashboard') {
      // Verify user owns the business
      if (!user) {
        return errorResponse('Authentication required', 401);
      }
      
      // Check if bookingLink is UUID or slug
      const isUUID = isValidUUID(resourceId);
      let business;
      
      if (isUUID) {
        business = await salonService.getSalonById(resourceId);
      } else {
        business = await salonService.getSalonByBookingLink(resourceId);
      }
      
      if (!business) {
        return errorResponse('Business not found', 404);
      }
      
      // Verify ownership
      const userBusinesses = await userService.getUserBusinesses(user.id);
      const hasAccess = userBusinesses.some(b => b.id === business.id);
      
      if (!hasAccess) {
        const profile = await userService.getUserProfile(user.id);
        const isAdmin = profile?.user_type === 'admin';
        if (!isAdmin) {
          return errorResponse('Access denied', 403);
        }
      }
    } else if (resourceType === 'booking-status' || resourceType === 'accept' || resourceType === 'reject') {
      // Verify user has access to booking
      if (user) {
        const booking = await bookingService.getBookingByUuidWithDetails(resourceId);
        if (!booking) {
          return errorResponse('Booking not found', 404);
        }
        
        const isCustomer = booking.customer_user_id === user.id;
        let isOwner = false;
        if (booking.business_id) {
          const userBusinesses = await userService.getUserBusinesses(user.id);
          isOwner = userBusinesses.some(b => b.id === booking.business_id);
        }
        const profile = await userService.getUserProfile(user.id);
        const isAdmin = profile?.user_type === 'admin';
        
        if (!isCustomer && !isOwner && !isAdmin) {
          return errorResponse('Access denied', 403);
        }
      }
    } else if (resourceType === 'admin-business' || resourceType === 'admin-booking') {
      // Verify user is admin
      if (!user) {
        return errorResponse('Authentication required', 401);
      }
      const profile = await userService.getUserProfile(user.id);
      if (profile?.user_type !== 'admin') {
        return errorResponse('Admin access required', 403);
      }
    }

    const secureUrl = getSecureResourceUrl(resourceType as ResourceType, resourceId);
    const urlPath = secureUrl.replace(/^https?:\/\/[^/]+/, '');
    
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    return successResponse({ 
      url: urlPath,
      expiresAt: expiresAt.toISOString(),
    });
  } catch (error) {
    console.error('Error generating secure resource URL:', error);
    return errorResponse('Failed to generate secure URL', 500);
  }
}
