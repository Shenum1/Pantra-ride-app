import { z } from "zod";
import { adminProcedure } from "../../../../create-context";

const SCREEN_KEYS = [
  "splash",
  "role_selection",
  "rider_login",
  "rider_signup",
  "forgot_password",
  "driver_login",
  "driver_signup",
  "driver_dashboard",
] as const;

export default adminProcedure
  .input(
    z.object({
      screenKey: z.enum(SCREEN_KEYS),
      videoUrl: z.string().url(),
      isEnabled: z.boolean().default(true),
      sortOrder: z.number().min(0).default(0),
    })
  )
  .mutation(async ({ ctx, input }) => {
    const db = ctx.supabaseAdmin;
    const { error } = await db.from("app_video_config").insert({
      screenKey: input.screenKey,
      videoUrl: input.videoUrl,
      isEnabled: input.isEnabled,
      sortOrder: input.sortOrder,
    });
    if (error) throw new Error(error.message);
    return { success: true };
  });
