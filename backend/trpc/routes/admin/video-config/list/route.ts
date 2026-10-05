import { adminProcedure } from "../../../../create-context";
import { listAppVideos } from "../../../../../services/admin/video-config";

export default adminProcedure.query(({ ctx }) => listAppVideos(ctx.supabaseAdmin));
