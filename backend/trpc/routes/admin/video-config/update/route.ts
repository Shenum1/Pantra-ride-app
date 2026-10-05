import { adminProcedure } from "../../../../create-context";
import { updateAppVideo, updateAppVideoInput } from "../../../../../services/admin/video-config";

export default adminProcedure
  .input(updateAppVideoInput)
  .mutation(({ ctx, input }) => updateAppVideo(ctx.supabaseAdmin, input));
