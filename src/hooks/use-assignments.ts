import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Assignment } from "@/lib/rooms";

export function useAssignments(date: string, housemanId?: string) {
  const qc = useQueryClient();
  const key = ["assignments", date, housemanId ?? "all"];
  const query = useQuery({
    queryKey: key,
    queryFn: async () => {
      let q = supabase.from("room_assignments").select("*").eq("work_date", date).order("room_number");
      if (housemanId) q = q.eq("houseman_id", housemanId);
      const { data, error } = await q;
      if (error) throw error;
      return data as Assignment[];
    },
  });

  useEffect(() => {
    const channel = supabase
      .channel(`ra-${date}-${housemanId ?? "all"}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "room_assignments" }, () => {
        qc.invalidateQueries({ queryKey: ["assignments", date] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [date, housemanId, qc]);

  return query;
}

export function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}
