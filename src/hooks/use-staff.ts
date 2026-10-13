import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type StaffRole = "super_admin" | "hotel_admin" | "manager" | "supervisor" | "houseman";
export type Member = { id: string; email: string; full_name: string | null; role: StaffRole; hotel_id: string | null };

export const ROLE_LABEL: Record<StaffRole, string> = {
  super_admin: "Super Admin",
  hotel_admin: "Hotel Admin",
  manager: "Manager",
  supervisor: "Supervisor",
  houseman: "Houseman",
};

/** All members visible to the current user (RLS limits this to their hotel). */
export function useMembers(hotelId?: string | null) {
  return useQuery({
    queryKey: ["members", hotelId ?? "all"],
    queryFn: async () => {
      let rq = supabase.from("staff_roles").select("user_id,role,hotel_id");
      if (hotelId) rq = rq.eq("hotel_id", hotelId);
      const [{ data: roles }, { data: profiles }] = await Promise.all([
        rq,
        supabase.from("profiles").select("id,email,full_name"),
      ]);
      const byId = new Map((profiles ?? []).map((p) => [p.id, p]));
      return (roles ?? [])
        .filter((r) => byId.has(r.user_id))
        .map((r) => ({ ...byId.get(r.user_id)!, role: r.role, hotel_id: r.hotel_id }) as Member)
        .sort((a, b) => (a.full_name ?? a.email).localeCompare(b.full_name ?? b.email));
    },
  });
}

export function useTeams() {
  return useQuery({
    queryKey: ["teams"],
    queryFn: async () => {
      const { data, error } = await supabase.from("team_members").select("staff_id,supervisor_id,hotel_id");
      if (error) throw error;
      return data;
    },
  });
}

export const nameOf = (m?: { full_name: string | null; email: string }) => m?.full_name || m?.email || "—";
