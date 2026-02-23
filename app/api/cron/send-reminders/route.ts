import { NextRequest } from 'next/server';
import { reminderService } from '@/services/reminder.service';
import { successResponse, errorResponse } from '@/lib/utils/response';
import { ERROR_MESSAGES } from '@/config/constants';
import { validateCronSecret } from '@/lib/security/cron-auth';
import { withCronRunLog } from '@/services/cron-run.service';

export async function POST(request: NextRequest) {
  try {
    const authError = validateCronSecret(request);
    if (authError) return authError;

    return await withCronRunLog('send-reminders', async () => {
      const reminders = await reminderService.getPendingReminders(50);
      let sentCount = 0;
      let failedCount = 0;
      for (const reminder of reminders) {
        try {
          await reminderService.sendReminder(reminder.id);
          sentCount++;
        } catch {
          failedCount++;
        }
      }
      return successResponse(
        { processed: reminders.length, sent: sentCount, failed: failedCount },
        `Processed ${reminders.length} reminders`
      );
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : ERROR_MESSAGES.DATABASE_ERROR;
    return errorResponse(message, 500);
  }
}
