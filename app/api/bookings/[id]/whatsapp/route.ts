import { NextRequest, NextResponse } from 'next/server';
import { bookingService } from '@/services/booking.service';
import generateWhatsAppLink from '@/lib/whatsapp';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!id)
    return NextResponse.json({ success: false, error: 'Missing booking id' }, { status: 400 });

  try {
    // id is the public booking identifier (booking.booking_id)
    const booking = await bookingService.getBookingById(id);
    if (!booking)
      return NextResponse.json({ success: false, error: 'Booking not found' }, { status: 404 });

    const salon = booking.salon;
    const slot = booking.slot;

    if (!salon || !slot || !salon.whatsapp_number) {
      return NextResponse.json({
        success: false,
        data: { whatsapp_url: null },
      });
    }

    const date = slot.date || '';
    const start = slot.start_time || '';
    const end = slot.end_time || '';
    const time = start && end ? `${start} - ${end}` : start || end;

    const link = generateWhatsAppLink({
      phoneNumber: salon.whatsapp_number,
      bookingDetails: {
        salonName: salon.salon_name || '',
        serviceName: undefined,
        date: date,
        time: time,
        customerName: booking.customer_name || '',
        bookingId: booking.booking_id,
      },
    });

    return NextResponse.json({ success: true, data: { whatsapp_url: link } });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: 'Failed to generate whatsapp link' },
      { status: 500 }
    );
  }
}
