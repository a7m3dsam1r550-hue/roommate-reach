import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type ShiftStamp = Database["public"]["Tables"]["shift_stamps"]["Row"];

export function useShiftStamps(date: string) {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ["shift-stamps", date],
    refetchInterval: 15000,
    queryFn: async () => {
      const { data, error } = await supabase.from("shift_stamps").select("*").eq("work_date", date);
      if (error) throw error;
      return data;
    },
  });
  useEffect(() => {
    const channel = supabase.channel(`shift-stamps-${date}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "shift_stamps" }, () => {
        void qc.invalidateQueries({ queryKey: ["shift-stamps", date] });
      }).subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [date, qc]);
  return query;
}