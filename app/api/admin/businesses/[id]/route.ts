import { NextRequest } from 'next/server';
import { getServerUser } from '@/lib/supabase/server-auth';
import { checkIsAdminServer } from '@/lib/utils/admin';
import { requireSupabaseAdmin } from '@/lib/supabase/server';
import { auditService } from '@/services/audit.service';
import { adminNotificationService } from '@/services/admin-notification.service';
import { successResponse, errorResponse } from '@/lib/utils/response';
import { ERROR_MESSAGES } from '@/config/constants';
import { formatPhoneNumber } from '@/lib/utils/string';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getServerUser(request);
    if (!user) {
      return errorResponse('Authentication required', 401);
    }

    const isAdmin = await checkIsAdminServer(user.id);
    if (!isAdmin) {
      return errorResponse('Admin access required', 403);
    }

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

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getServerUser(request);
    if (!user) {
      return errorResponse('Authentication required', 401);
    }

    const isAdmin = await checkIsAdminServer(user.id);
    if (!isAdmin) {
      return errorResponse('Admin access required', 403);
    }

    const supabase = requireSupabaseAdmin();
    const body = await request.json();

    // Get old data for audit
    const { data: oldBusiness } = await supabase
      .from('businesses')
      .select('*')
      .eq('id', params.id)
      .single();

    if (!oldBusiness) {
      return errorResponse('Business not found', 404);
    }

    // Prepare update data
    const updateData: any = {};
    if (body.salon_name !== undefined) updateData.salon_name = body.salon_name;
    if (body.owner_name !== undefined) updateData.owner_name = body.owner_name;
    if (body.whatsapp_number !== undefined) updateData.whatsapp_number = formatPhoneNumber(body.whatsapp_number);
    if (body.opening_time !== undefined) updateData.opening_time = body.opening_time;
    if (body.closing_time !== undefined) updateData.closing_time = body.closing_time;
    if (body.slot_duration !== undefined) updateData.slot_duration = body.slot_duration;
    if (body.address !== undefined) updateData.address = body.address;
    if (body.location !== undefined) updateData.location = body.location;
    if (body.suspended !== undefined) {
      updateData.suspended = body.suspended;
      updateData.suspended_at = body.suspended ? new Date().toISOString() : null;
      updateData.suspended_reason = body.suspended_reason || null;
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
    Object.keys(updateData).forEach(key => {
      if (oldBusiness[key] !== updateData[key]) {
        changes.push(`${key}: ${oldBusiness[key]} → ${updateData[key]}`);
      }
    });

    await auditService.createAuditLog(
      user.id,
      'business_updated',
      'business',
      {
        entityId: params.id,
        oldData: oldBusiness,
        newData: updatedBusiness,
        description: `Business updated: ${changes.join(', ')}`,
        request,
      }
    );

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

    return successResponse(updatedBusiness, 'Business updated successfully');
  } catch (error) {
    const message = error instanceof Error ? error.message : ERROR_MESSAGES.DATABASE_ERROR;
    return errorResponse(message, 500);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getServerUser(request);
    if (!user) {
      return errorResponse('Authentication required', 401);
    }

    const isAdmin = await checkIsAdminServer(user.id);
    if (!isAdmin) {
      return errorResponse('Admin access required', 403);
    }

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
    const { error } = await supabase
      .from('businesses')
      .delete()
      .eq('id', params.id);

    if (error) {
      return errorResponse(error.message || ERROR_MESSAGES.DATABASE_ERROR, 500);
    }

    // Create audit log
    await auditService.createAuditLog(
      user.id,
      'business_deleted',
      'business',
      {
        entityId: params.id,
        oldData: business,
        description: `Business deleted: ${business.salon_name}`,
        request,
      }
    );

    return successResponse(null, 'Business deleted successfully');
  } catch (error) {
    const message = error instanceof Error ? error.message : ERROR_MESSAGES.DATABASE_ERROR;
    return errorResponse(message, 500);
  }
}

