import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/utils/api-auth-pipeline';
import { errorResponse } from '@/lib/utils/response';
import { parseAdminDateRange } from '@/lib/utils/date-range-admin';
import { adminService } from '@/services/admin.service';
import { auditService } from '@/services/audit.service';
import { ADMIN_EXPORT_BOOKINGS_MAX_ROWS } from '@/config/constants';
import { ERROR_MESSAGES } from '@/config/constants';

const ROUTE = 'GET /api/admin/export/bookings';
const CHUNK_SIZE = 500;

function escapeCsvCell(value: string | number): string {
  const s = String(value ?? '');
  if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdmin(request, ROUTE);
    if (auth instanceof Response) return auth;

    const searchParams = request.nextUrl.searchParams;
    const range = parseAdminDateRange(searchParams);
    const businessId = searchParams.get('business_id')?.trim() || undefined;
    const limit = Math.min(ADMIN_EXPORT_BOOKINGS_MAX_ROWS, 10_000);

    await auditService.createAuditLog(auth.user.id, 'admin_revenue_export', 'system', {
      description: `Bookings export: ${range.startDate.toISOString()} to ${range.endDate.toISOString()}${businessId ? ` business=${businessId}` : ''}`,
      request,
    });

    const encoder = new TextEncoder();
    const header = 'booking_id,business_name,amount,status,payment_status,created_at\n';

    const stream = new ReadableStream({
      async start(controller) {
        controller.enqueue(encoder.encode(header));
        let offset = 0;

        while (offset < limit) {
          const chunkLimit = Math.min(CHUNK_SIZE, limit - offset);
          const rows = await adminService.getBookingsForExport({
            startDate: range.startDate.toISOString(),
            endDate: range.endDate.toISOString(),
            businessId,
            limit: chunkLimit,
            offset,
          });
          if (rows.length === 0) break;

          const bookingIds = rows.map((r) => r.id);
          const paymentMap = await adminService.getPaymentsByBookingIds(bookingIds);

          for (const r of rows) {
            const pay = paymentMap.get(r.id);
            const amount = pay ? (pay.amount_cents / 100).toFixed(2) : '';
            const paymentStatus = pay ? pay.status : '';
            const line =
              [
                escapeCsvCell(r.booking_id),
                escapeCsvCell(r.business_name),
                escapeCsvCell(amount),
                escapeCsvCell(r.status),
                escapeCsvCell(paymentStatus),
                escapeCsvCell(r.created_at),
              ].join(',') + '\n';
            controller.enqueue(encoder.encode(line));
          }

          offset += rows.length;
          if (rows.length < chunkLimit) break;
        }
        controller.close();
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="bookings-export.csv"',
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : ERROR_MESSAGES.DATABASE_ERROR;
    return errorResponse(message, 500);
  }
}
