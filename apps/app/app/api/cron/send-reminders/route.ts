import { NextRequest } from "next/server";
import { reminderService } from "@cusown/shared/server";
import { successResponse, errorResponse } from "@cusown/shared/server";
import { ERROR_MESSAGES } from "@cusown/config";
import { validateCronSecret } from "@cusown/shared/server";
import { withCronRunLog } from "@cusown/shared/server";

export async function POST(request: NextRequest) {
  try {
    const authError = validateCronSecret(request);
    if (authError) return authError;

    return await withCronRunLog("send-reminders", async () => {
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
        `Processed ${reminders.length} reminders`,
      );
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : ERROR_MESSAGES.DATABASE_ERROR;
    return errorResponse(message, 500);
  }
}
