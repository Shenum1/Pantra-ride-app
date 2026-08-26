import { z } from "zod";
import { adminProcedure } from "../../../../create-context";

export default adminProcedure
  .input(z.object({ riderId: z.string().uuid() }))
  .query(async ({ ctx, input }) => {
    const db = ctx.supabaseAdmin;

    const { data: profile, error: profileError } = await db
      .from("users")
      .select("uid, displayName, email, role, createdAt, dateOfBirth, address, rating, totalRatings")
      .eq("uid", input.riderId)
      .single();

    if (profileError || !profile) throw new Error("Rider not found.");

    const [walletRes, savedLocationsRes, familyMembersRes, ratingsRes] = await Promise.all([
      db.from("wallets").select("balance, createdAt, updatedAt").eq("userId", input.riderId).maybeSingle(),
      db
        .from("saved_locations")
        .select("id, name, address, type, createdAt")
        .eq("userId", input.riderId)
        .order("createdAt", { ascending: false }),
      db
        .from("family_members")
        .select("id, name, relationship, phone, createdAt")
        .eq("userId", input.riderId)
        .order("createdAt", { ascending: false }),
      db
        .from("driver_ratings_of_riders")
        .select("id, rideId, driverId, rating, comment, tags, createdAt")
        .eq("userId", input.riderId)
        .order("createdAt", { ascending: false })
        .limit(20),
    ]);

    return {
      profile,
      wallet: walletRes.data ?? null,
      savedLocations: savedLocationsRes.data ?? [],
      familyMembers: familyMembersRes.data ?? [],
      ratings: ratingsRes.data ?? [],
    };
  });
