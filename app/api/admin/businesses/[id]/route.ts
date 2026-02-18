import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/utils/api-auth-pipeline';
import { requireSupabaseAdmin } from '@/lib/supabase/server';
import { auditService } from '@/services/audit.service';
import { adminNotificationService } from '@/services/admin-notification.service';
import { successResponse, errorResponse } from '@/lib/utils/response';
import { ERROR_MESSAGES } from '@/config/constants';
import { formatPhoneNumber } from '@/lib/utils/string';
import { invalidateApiCacheByPrefix } from '@/lib/cache/api-response-cache';

const ROUTE_GET = 'GET /api/admin/businesses/[id]';
const ROUTE_PATCH = 'PATCH /api/admin/businesses/[id]';
const ROUTE_DELETE = 'DELETE /api/admin/businesses/[id]';

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const auth = await requireAdmin(request, ROUTE_GET);
    if (auth instanceof Response) return auth;

    const supabase = requireSupabaseAdmin();
    const { data: business, error } = await supabase
      .from('businesses')
      .select('*')
      .eq('id', params.id)
      .single();

    if (error || !business) {
      return errorResponse('Business not found', 404);
    }

    return successResponse(business);
  } catch (error) {
    const message = error instanceof Error ? error.message : ERROR_MESSAGES.DATABASE_ERROR;
    return errorResponse(message, 500);
  }
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const auth = await requireAdmin(request, ROUTE_PATCH);
    if (auth instanceof Response) return auth;

    const supabase = requireSupabaseAdmin();
    const body = await request.json();

    // SECURITY: Filter input to prevent mass assignment
    const { filterBusinessUpdateFields, validateStringLength } =
      await import('@/lib/security/input-filter');
    const filteredBody = filterBusinessUpdateFields(body);

    // SECURITY: Validate string lengths
    if (filteredBody.salon_name && !validateStringLength(filteredBody.salon_name, 200)) {
      return errorResponse('Salon name is too long', 400);
    }
    if (filteredBody.owner_name && !validateStringLength(filteredBody.owner_name, 200)) {
      return errorResponse('Owner name is too long', 400);
    }
    if (filteredBody.address && !validateStringLength(filteredBody.address, 500)) {
      return errorResponse('Address is too long', 400);
    }
    if (filteredBody.location && !validateStringLength(filteredBody.location, 200)) {
      return errorResponse('Location is too long', 400);
    }
    if (
      filteredBody.suspended_reason &&
      !validateStringLength(filteredBody.suspended_reason, 500)
    ) {
      return errorResponse('Suspension reason is too long', 400);
    }

    // Get old data for audit
    const { data: oldBusiness } = await supabase
      .from('businesses')
      .select('*')
      .eq('id', params.id)
      .single();

    if (!oldBusiness) {
      return errorResponse('Business not found', 404);
    }

    // Prepare update data from filtered input only
    const updateData: any = {};
    if (filteredBody.salon_name !== undefined) updateData.salon_name = filteredBody.salon_name;
    if (filteredBody.owner_name !== undefined) updateData.owner_name = filteredBody.owner_name;
    if (filteredBody.whatsapp_number !== undefined)
      updateData.whatsapp_number = formatPhoneNumber(filteredBody.whatsapp_number);
    if (filteredBody.opening_time !== undefined)
      updateData.opening_time = filteredBody.opening_time;
    if (filteredBody.closing_time !== undefined)
      updateData.closing_time = filteredBody.closing_time;
    if (filteredBody.slot_duration !== undefined) {
      const duration = Number(filteredBody.slot_duration);
      if (isNaN(duration) || duration <= 0 || duration > 1440) {
        return errorResponse('Invalid slot duration', 400);
      }
      updateData.slot_duration = duration;
    }
    if (filteredBody.address !== undefined) updateData.address = filteredBody.address;
    if (filteredBody.location !== undefined) updateData.location = filteredBody.location;
    if (filteredBody.suspended !== undefined) {
      updateData.suspended = Boolean(filteredBody.suspended);
      updateData.suspended_at = filteredBody.suspended ? new Date().toISOString() : null;
      updateData.suspended_reason = filteredBody.suspended_reason || null;
    }

    const { data: updatedBusiness, error } = await supabase
      .from('businesses')
      .update(updateData)
      .eq('id', params.id)
      .select()
      .single();

    if (error) {
      return errorResponse(error.message || ERROR_MESSAGES.DATABASE_ERROR, 500);
    }

    // Create audit log
    const changes: string[] = [];
    Object.keys(updateData).forEach((key) => {
      if (oldBusiness[key] !== updateData[key]) {
        changes.push(`${key}: ${oldBusiness[key]} → ${updateData[key]}`);
      }
    });

    await auditService.createAuditLog(auth.user.id, 'business_updated', 'business', {
      entityId: params.id,
      oldData: oldBusiness,
      newData: updatedBusiness,
      description: `Business updated: ${changes.join(', ')}`,
      request,
    });

    // Send notification to owner if business was updated
    if (updatedBusiness.owner_user_id && changes.length > 0) {
      try {
        const message = adminNotificationService.generateBusinessUpdateMessage(
          updatedBusiness.salon_name,
          changes,
          request
        );
        await adminNotificationService.notifyBusinessOwner(updatedBusiness.id, message, request);
      } catch {
        // Ignore notification errors
      }
    }

    invalidateApiCacheByPrefix('GET|/api/admin/businesses');
    invalidateApiCacheByPrefix('GET|/api/admin/metrics');
    return successResponse(updatedBusiness, 'Business updated successfully');
  } catch (error) {
    const message = error instanceof Error ? error.message : ERROR_MESSAGES.DATABASE_ERROR;
    return errorResponse(message, 500);
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const auth = await requireAdmin(request, ROUTE_DELETE);
    if (auth instanceof Response) return auth;

    const supabase = requireSupabaseAdmin();

    // Get business data for audit
    const { data: business } = await supabase
      .from('businesses')
      .select('*')
      .eq('id', params.id)
      .single();

    if (!business) {
      return errorResponse('Business not found', 404);
    }

    // Delete business (cascade will handle related records)
    const { error } = await supabase.from('businesses').delete().eq('id', params.id);

    if (error) {
      return errorResponse(error.message || ERROR_MESSAGES.DATABASE_ERROR, 500);
    }

    // Create audit log
    await auditService.createAuditLog(auth.user.id, 'business_deleted', 'business', {
      entityId: params.id,
      oldData: business,
      description: `Business deleted: ${business.salon_name}`,
      request,
    });

    invalidateApiCacheByPrefix('GET|/api/admin/businesses');
    invalidateApiCacheByPrefix('GET|/api/admin/metrics');
    return successResponse(null, 'Business deleted successfully');
  } catch (error) {
    const message = error instanceof Error ? error.message : ERROR_MESSAGES.DATABASE_ERROR;
    return errorResponse(message, 500);
  }
}
