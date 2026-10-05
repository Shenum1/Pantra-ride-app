import { z } from "zod";
import { defineReadTool, defineWriteTool, pick } from "../types";
import {
  createAppVideo,
  createAppVideoInput,
  deleteAppVideo,
  deleteAppVideoInput,
  listAppVideos,
  updateAppVideo,
  updateAppVideoInput,
} from "../../services/admin/video-config";

const APPROVAL =
  "REQUIRES HUMAN APPROVAL: returns 202 with an actionId; nothing changes until an admin approves.";

export const listAppVideosTool = defineReadTool({
  name: "list_app_videos",
  description:
    "List the background videos shown behind the app's splash, role-selection, login/signup, forgot-password and driver-dashboard screens: id, screenKey, videoUrl, isEnabled and sortOrder. A screen with no enabled video falls back to a built-in default. Returns {videos}. Read-only.",
  inputSchema: z.object({}),
  run: (db) => listAppVideos(db),
});

export const createAppVideoTool = defineWriteTool({
  name: "create_app_video",
  description: `Propose adding a background video to an app screen. The URL must be a publicly reachable HTTPS MP4; it plays muted and looped, and if it fails to load the screen falls back to a plain dark background. ${APPROVAL}`,
  inputSchema: createAppVideoInput,
  summarize: (input) => `Add video to ${input.screenKey}: ${input.videoUrl}${input.isEnabled ? "" : " (disabled)"}`,
  run: (db, input) => createAppVideo(db, input),
});

export const updateAppVideoTool = defineWriteTool({
  name: "update_app_video",
  description: `Propose changing an app background video's URL, enabled state or order; only the fields you send are changed. Prefer isEnabled=false over deleting. ${APPROVAL}`,
  inputSchema: updateAppVideoInput,
  summarize: (input) => {
    const { id, ...changes } = input;
    return `Update app video ${id}: ${Object.keys(changes).join(", ")}`;
  },
  validate: (input) => (Object.keys(input).length <= 1 ? "Provide at least one field to change." : undefined),
  snapshot: async (db, input) => {
    const { data, error } = await db.from("app_video_config").select("*").eq("id", input.id).single();
    if (error || !data) throw new Error("App video not found.");
    return pick(data, ["screenKey", ...Object.keys(input).filter((k) => k !== "id")]);
  },
  run: (db, input) => updateAppVideo(db, input),
});

export const deleteAppVideoTool = defineWriteTool({
  name: "delete_app_video",
  description: `Propose PERMANENTLY deleting an app background video. This cannot be undone — prefer update_app_video with isEnabled=false. ${APPROVAL}`,
  inputSchema: deleteAppVideoInput,
  irreversible: true,
  summarize: (input) => `Permanently delete app video ${input.id}`,
  snapshot: async (db, input) => {
    const { data, error } = await db.from("app_video_config").select("*").eq("id", input.id).single();
    if (error || !data) throw new Error("App video not found.");
    return pick(data, ["screenKey", "videoUrl", "isEnabled", "sortOrder"]);
  },
  run: (db, input) => deleteAppVideo(db, input),
});
