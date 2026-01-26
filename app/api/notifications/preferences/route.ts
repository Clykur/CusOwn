import { NextRequest, NextResponse } from 'next/server';
import { notificationService } from '@/services/notification.service';
import { successResponse, errorResponse } from '@/lib/utils/response';
import { getServerUser } from '@/lib/supabase/server-auth';
import { setCacheHeaders, setNoCacheHeaders } from '@/lib/cache/next-cache';
import { ERROR_MESSAGES } from '@/config/constants';

export async function GET(request: NextRequest) {
  try {
    const user = await getServerUser(request);
    const { searchParams } = new URL(request.url);
    const customerPhone = searchParams.get('customer_phone');

    if (!user && !customerPhone) {
      return errorResponse('Authentication or customer phone required', 401);
    }

    const preferences = await notificationService.getNotificationPreferences(
      user?.id,
      customerPhone || undefined
    );

    const response = NextResponse.json(successResponse(preferences));
    setCacheHeaders(response, 300, 600);
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : ERROR_MESSAGES.DATABASE_ERROR;
    return errorResponse(message, 500);
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = await getServerUser(request);
    const body = await request.json();
    const { customer_phone, email_enabled, sms_enabled, whatsapp_enabled, email_address, phone_number } = body;

    if (!user && !customer_phone) {
      return errorResponse('Authentication or customer phone required', 401);
    }

    await notificationService.updateNotificationPreferences(
      user?.id,
      customer_phone || undefined,
      {
        emailEnabled: email_enabled,
        smsEnabled: sms_enabled,
        whatsappEnabled: whatsapp_enabled,
        emailAddress: email_address,
        phoneNumber: phone_number,
      }
    );

    const response = successResponse({ message: 'Preferences updated' });
    setNoCacheHeaders(response);
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : ERROR_MESSAGES.DATABASE_ERROR;
    return errorResponse(message, 400);
  }
}
