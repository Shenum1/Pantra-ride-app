import { adminProcedure } from "../../../../create-context";
import { createAppVideo, createAppVideoInput } from "../../../../../services/admin/video-config";

export default adminProcedure
  .input(createAppVideoInput)
  .mutation(({ ctx, input }) => createAppVideo(ctx.supabaseAdmin, input));
