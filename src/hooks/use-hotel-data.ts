import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { StaffRole } from "@/hooks/use-staff";

/** Invalidate a query key whenever a table changes (RLS-filtered realtime). */
export function useLive(table: string, key: unknown[]) {
  const qc = useQueryClient();
  const k = JSON.stringify(key);
  useEffect(() => {
    const ch = supabase
      .channel(`live-${table}-${k}-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table }, () => qc.invalidateQueries({ queryKey: key }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table, k, qc]);
}

export function useMe(userId: string, email?: string) {
  return useQuery({
    queryKey: ["me", userId],
    queryFn: async () => {
      const [{ data: role }, { data: profile }] = await Promise.all([
        supabase.from("staff_roles").select("role,hotel_id").eq("user_id", userId).maybeSingle(),
        supabase.from("profiles").select("full_name,email").eq("id", userId).maybeSingle(),
      ]);
      let hotelName: string | null = null;
      if (role?.hotel_id) {
        const { data: h } = await supabase.from("hotels").select("name").eq("id", role.hotel_id).maybeSingle();
        hotelName = h?.name ?? null;
      }
      return { role: (role?.role ?? null) as StaffRole | null, hotelId: role?.hotel_id ?? null, hotelName, name: profile?.full_name ?? email ?? "" };
    },
  });
}

export function useSessions(assignmentIds: string[] | "date", date?: string) {
  const key = ["sessions", assignmentIds === "date" ? date : assignmentIds.join(",")];
  useLive("room_sessions", ["sessions"]);
  return useQuery({
    queryKey: key,
    queryFn: async () => {
      let q = supabase.from("room_sessions").select("*").order("started_at");
      if (assignmentIds === "date") {
        const start = new Date(`${date}T00:00:00`);
        const end = new Date(start.getTime() + 86400000);
        q = q.gte("started_at", start.toISOString()).lt("started_at", end.toISOString());
      } else q = q.in("assignment_id", assignmentIds.length ? assignmentIds : ["00000000-0000-0000-0000-000000000000"]);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });
}

export function useNotes(assignmentIds: string[]) {
  useLive("room_notes", ["notes"]);
  return useQuery({
    queryKey: ["notes", assignmentIds.join(",")],
    queryFn: async () => {
      if (!assignmentIds.length) return [];
      const { data, error } = await supabase.from("room_notes").select("*").in("assignment_id", assignmentIds).order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

export function useWeeklyTasks(hotelId: string) {
  useLive("weekly_tasks", ["weekly_tasks"]);
  return useQuery({
    queryKey: ["weekly_tasks", hotelId],
    queryFn: async () => {
      const { data, error } = await supabase.from("weekly_tasks").select("*").eq("hotel_id", hotelId);
      if (error) throw error;
      return data;
    },
  });
}

export function useBroadcast(hotelId: string, date: string) {
  useLive("broadcasts", ["broadcast"]);
  return useQuery({
    queryKey: ["broadcast", hotelId, date],
    queryFn: async () => {
      const { data } = await supabase.from("broadcasts").select("*").eq("hotel_id", hotelId).eq("work_date", date).maybeSingle();
      return data;
    },
  });
}

export function useSignoffs(hotelId: string, date: string) {
  useLive("signoffs", ["signoffs"]);
  return useQuery({
    queryKey: ["signoffs", hotelId, date],
    queryFn: async () => {
      const { data, error } = await supabase.from("signoffs").select("*").eq("hotel_id", hotelId).eq("work_date", date).order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}
