import { adminProcedure } from "../../../../create-context";
import { deleteAppVideo, deleteAppVideoInput } from "../../../../../services/admin/video-config";

export default adminProcedure
  .input(deleteAppVideoInput)
  .mutation(({ ctx, input }) => deleteAppVideo(ctx.supabaseAdmin, input));
