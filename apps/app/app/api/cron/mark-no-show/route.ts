import { NextRequest } from "next/server";
import { requireSupabaseAdmin } from "@cusown/shared/server";
import { successResponse, errorResponse } from "@cusown/shared/server";
import { ERROR_MESSAGES } from "@cusown/config";
import { validateCronSecret } from "@cusown/shared/server";
import { env } from "@cusown/config";
import { withCronRunLog } from "@cusown/shared/server";

/** Cron: mark confirmed bookings as no-show when slot end (business timezone) is past by noShowAutoMarkMinutes. */
export async function POST(request: NextRequest) {
  try {
    const authError = validateCronSecret(request);
    if (authError) return authError;

    return await withCronRunLog("mark-no-show", async () => {
      const supabase = requireSupabaseAdmin();
      const minutes = env.booking.noShowAutoMarkMinutes;
      const { data, error } = await supabase.rpc(
        "mark_no_show_after_slot_end",
        {
          p_minutes_after_slot_end: minutes,
          p_max_count: 500,
        },
      );

      if (error) {
        throw new Error(error.message ?? ERROR_MESSAGES.DATABASE_ERROR);
      }

      const out = data as { success?: boolean; marked_count?: number };
      return successResponse(
        { marked_count: out?.marked_count ?? 0 },
        "No-show auto-mark completed",
      );
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : ERROR_MESSAGES.DATABASE_ERROR;
    return errorResponse(message, 500);
  }
}
