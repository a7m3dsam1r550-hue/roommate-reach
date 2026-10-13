import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const schema = z.object({
  email: z.string().trim().email().max(255),
  password: z.string().min(8).max(72),
  fullName: z.string().trim().min(1).max(100),
  role: z.enum(["hotel_admin", "manager", "supervisor", "houseman"]),
  hotelId: z.string().uuid().optional(),
});

// Which roles each creator may create
const ALLOWED: Record<string, string[]> = {
  super_admin: ["hotel_admin"],
  hotel_admin: ["manager"],
  manager: ["supervisor", "houseman"],
};

export const createStaff = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => schema.parse(d))
  .handler(async ({ data, context }) => {
    const { data: me } = await context.supabase
      .from("staff_roles").select("role,hotel_id").eq("user_id", context.userId).maybeSingle();
    if (!me || !ALLOWED[me.role]?.includes(data.role)) throw new Error("You are not allowed to create this account type");
    const hotelId = me.role === "super_admin" ? data.hotelId : me.hotel_id;
    if (!hotelId) throw new Error("Choose a hotel");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: hotel } = await supabaseAdmin.from("hotels").select("*").eq("id", hotelId).maybeSingle();
    if (!hotel) throw new Error("Hotel not found");
    const limit = data.role === "manager" ? hotel.max_managers
      : data.role === "supervisor" ? hotel.max_supervisors
      : data.role === "houseman" ? hotel.max_staff : Infinity;
    const { count } = await supabaseAdmin.from("staff_roles")
      .select("user_id", { count: "exact", head: true }).eq("hotel_id", hotelId).eq("role", data.role);
    if ((count ?? 0) >= limit) throw new Error(`Quota reached: this hotel allows ${limit} ${data.role} account(s)`);

    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.fullName },
    });
    if (error || !created.user) throw new Error(error?.message ?? "Could not create user");
    const { error: rErr } = await supabaseAdmin.from("staff_roles")
      .insert({ user_id: created.user.id, hotel_id: hotelId, role: data.role });
    if (rErr) {
      await supabaseAdmin.auth.admin.deleteUser(created.user.id);
      throw new Error(rErr.message);
    }
    return { id: created.user.id };
  });
