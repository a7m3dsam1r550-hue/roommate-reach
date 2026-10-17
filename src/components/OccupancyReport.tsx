import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Wrench } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAssignments } from "@/hooks/use-assignments";
import { useShiftStamps } from "@/hooks/use-shift-stamps";
import { SupervisorStamp } from "@/components/SupervisorStamp";
import { codeLabel, todayISO } from "@/lib/rooms";

export function OccupancyReport() {
  const date = todayISO();
  const qc = useQueryClient();
  const { data: rooms = [], isLoading } = useAssignments(date);
  const { data: stamps = [] } = useShiftStamps(date);
  const ids = rooms.map((r) => r.id);

  const housemanIds = [...new Set(rooms.map((r) => r.houseman_id))];
  const { data: profiles = [] } = useQuery({
    queryKey: ["occ-profiles", housemanIds.join(",")],
    enabled: housemanIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("id,full_name,email").in("id", housemanIds);
      if (error) throw error;
      return data;
    },
  });
  const nameOf = (id: string) => profiles.find((p) => p.id === id)?.full_name || profiles.find((p) => p.id === id)?.email || "Staff member";
  const visibleStamps = stamps.filter((s) => housemanIds.includes(s.houseman_id));

  const { data: notes = [] } = useQuery({
    queryKey: ["occ-notes", date, ids.join(",")],
    enabled: ids.length > 0,
    refetchInterval: 30000,
    queryFn: async () => {
      const { data, error } = await supabase.from("room_notes")
        .select("assignment_id,body,is_maintenance,created_at").in("assignment_id", ids).order("created_at");
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    const ch = supabase.channel(`occ-notes-${date}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "room_notes" }, () => qc.invalidateQueries({ queryKey: ["occ-notes", date] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [date, qc]);

  const totalAm = rooms.reduce((s, r) => s + (r.morning_guests ?? 0), 0);
  const totalPm = rooms.reduce((s, r) => s + (r.evening_guests ?? 0), 0);

  if (isLoading) return <p className="text-muted-foreground">Loading…</p>;
  if (!rooms.length) return <p className="rounded-xl border border-dashed p-10 text-center text-muted-foreground">No rooms assigned today.</p>;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div><h2 className="font-display text-xl font-bold">Occupancy report</h2><p className="text-sm text-muted-foreground">Live · {rooms.length} rooms</p></div>
        <p className="text-sm">AM guests <b>{totalAm}</b> · PM guests <b>{totalPm}</b></p>
      </div>
      {visibleStamps.length > 0 && (
        <div className="space-y-2">
          <h3 className="font-display text-sm font-bold uppercase tracking-wider text-muted-foreground">Cleared shifts</h3>
          <div className="grid gap-2 sm:grid-cols-2">
            {visibleStamps.map((s) => (
              <div key={s.id} className="space-y-1">
                <p className="text-sm font-semibold">{nameOf(s.houseman_id)}</p>
                <SupervisorStamp stamp={s} compact />
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="overflow-x-auto rounded-xl border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr><th className="px-3 py-2">Room</th><th className="px-3 py-2">AM Guests</th><th className="px-3 py-2">PM Guests / Status</th><th className="px-3 py-2">Notes</th></tr>
          </thead>
          <tbody className="divide-y">
            {rooms.map((r) => {
              const n = notes.filter((x) => x.assignment_id === r.id);
              return (
                <tr key={r.id} className="align-top">
                  <td className="px-3 py-2 font-display font-bold">{r.room_number}</td>
                  <td className="px-3 py-2 tabular-nums">{r.morning_guests ?? "—"}</td>
                  <td className="px-3 py-2">
                    {r.evening_guests != null ? <span className="tabular-nums">{r.evening_guests}</span>
                      : r.room_status ? <span title={codeLabel(r.room_status)} className="font-semibold text-brass">{r.room_status}</span> : "—"}
                  </td>
                  <td className="px-3 py-2 max-w-xs">
                    {n.length ? n.map((x, i) => (
                      <p key={i} className="flex gap-1">{x.is_maintenance && <Wrench className="h-3.5 w-3.5 text-destructive mt-0.5 shrink-0" />}<span className="line-clamp-2">{x.body || "(photo)"}</span></p>
                    )) : <span className="text-muted-foreground">—</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
