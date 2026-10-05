import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";

export const VIDEO_SCREEN_KEYS = [
  "splash",
  "role_selection",
  "rider_login",
  "rider_signup",
  "forgot_password",
  "driver_login",
  "driver_signup",
  "driver_dashboard",
] as const;

export async function listAppVideos(db: SupabaseClient) {
  const { data, error } = await db
    .from("app_video_config")
    .select("*")
    .order("screenKey", { ascending: true })
    .order("sortOrder", { ascending: true });
  if (error) throw new Error(error.message);
  return { videos: data ?? [] };
}

export const createAppVideoInput = z.object({
  screenKey: z
    .enum(VIDEO_SCREEN_KEYS)
    .describe("Which app screen the background video plays behind. A screen with several enabled videos picks one at random per load."),
  videoUrl: z.string().url().describe("Public HTTPS URL of an MP4 video file. It plays muted and looped."),
  isEnabled: z.boolean().default(true).describe("Whether the app may pick this video."),
  sortOrder: z.number().int().min(0).default(0).describe("Display order in the admin list; does not affect which video the app picks."),
});

export async function createAppVideo(db: SupabaseClient, input: z.infer<typeof createAppVideoInput>) {
  const { error } = await db.from("app_video_config").insert({
    screenKey: input.screenKey,
    videoUrl: input.videoUrl,
    isEnabled: input.isEnabled,
    sortOrder: input.sortOrder,
  });
  if (error) throw new Error(error.message);
  return { success: true };
}

export const updateAppVideoInput = z.object({
  id: z.string().uuid().describe("UUID of the app_video_config row to update."),
  videoUrl: z.string().url().optional().describe("New public HTTPS URL of an MP4 video file."),
  isEnabled: z.boolean().optional().describe("Enable or disable this video."),
  sortOrder: z.number().int().min(0).optional().describe("New display order in the admin list."),
});

export async function updateAppVideo(db: SupabaseClient, input: z.infer<typeof updateAppVideoInput>) {
  const { id, ...updates } = input;
  const { error } = await db
    .from("app_video_config")
    .update({ ...updates, updatedAt: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
  return { success: true };
}

export const deleteAppVideoInput = z.object({
  id: z.string().uuid().describe("UUID of the app_video_config row to permanently delete."),
});

export async function deleteAppVideo(db: SupabaseClient, input: z.infer<typeof deleteAppVideoInput>) {
  const { error } = await db.from("app_video_config").delete().eq("id", input.id);
  if (error) throw new Error(error.message);
  return { success: true };
}
