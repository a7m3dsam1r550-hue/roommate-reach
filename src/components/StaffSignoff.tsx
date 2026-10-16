import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { BadgeCheck, Wrench } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/StatusBadge";
import { SupervisorStamp } from "@/components/SupervisorStamp";
import { useAssignments } from "@/hooks/use-assignments";
import { useShiftStamps } from "@/hooks/use-shift-stamps";
import { nameOf, type Member } from "@/hooks/use-staff";
import { supabase } from "@/integrations/supabase/client";
import { codeLabel, statusOf, todayISO } from "@/lib/rooms";

export function StaffSignoff({ members }: { members: Member[] }) {
  const date = todayISO();
  const qc = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const selected = members.find((member) => member.id === selectedId);
  const { data: assignments = [], isLoading: roomsLoading, error: roomsError } = useAssignments(date);
  const { data: stamps = [], isLoading: stampsLoading, error: stampsError } = useShiftStamps(date);
  const ids = assignments.map((room) => room.id);
  const { data: notes = [], isLoading: notesLoading, error: notesError } = useQuery({
    queryKey: ["staff-review-notes", date, ids.join(",")],
    enabled: ids.length > 0,
    refetchInterval: 15000,
    queryFn: async () => {
      const { data, error } = await supabase.from("room_notes").select("*").in("assignment_id", ids).order("created_at");
      if (error) throw error;
      return data;
    },
  });
  useEffect(() => {
    const channel = supabase.channel(`staff-review-notes-${date}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "room_notes" }, () => {
        void qc.invalidateQueries({ queryKey: ["staff-review-notes", date] });
      }).subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [date, qc]);

  const rooms = assignments.filter((room) => room.houseman_id === selectedId);
  const roomIds = new Set(rooms.map((room) => room.id));
  const maintenance = notes.filter((note) => note.is_maintenance && roomIds.has(note.assignment_id));
  const stamp = stamps.find((item) => item.houseman_id === selectedId);
  const active = rooms.some((room) => statusOf(room) === "in_progress");

  async function approve() {
    if (!selected || busy) return;
    setBusy(true);
    try {
      const { error } = await supabase.rpc("approve_shift_stamp", { _houseman_id: selected.id, _work_date: date });
      if (error) throw error;
      await qc.invalidateQueries({ queryKey: ["shift-stamps", date] });
      toast.success(`${nameOf(selected)} — shift approved and stamped`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not approve this shift. Please try again.");
    } finally { setBusy(false); }
  }

  return (
    <section className="space-y-5">
      <div><h2 className="font-display text-xl font-bold">Staff Review &amp; Sign-off</h2><p className="text-sm text-muted-foreground">{date}</p></div>
      {!members.length ? <p className="text-sm text-muted-foreground">No housemen assigned to your team.</p> : (
        <div className="flex flex-wrap gap-2">
          {members.map((member) => (
            <Button key={member.id} variant={member.id === selectedId ? "default" : "outline"} aria-pressed={member.id === selectedId} onClick={() => setSelectedId(member.id)} className="max-w-full h-auto min-h-9 whitespace-normal text-left">
              {nameOf(member)}{stamps.some((item) => item.houseman_id === member.id) && <BadgeCheck className="h-4 w-4 shrink-0" />}
            </Button>
          ))}
        </div>
      )}
      {selected && (
        <div className="space-y-4 border-t pt-5">
          <h3 className="font-display text-lg font-semibold break-words">{nameOf(selected)}</h3>
          {roomsLoading || stampsLoading || notesLoading ? <p className="text-muted-foreground">Loading shift summary…</p> : roomsError || stampsError || notesError ? (
            <p role="alert" className="text-destructive">Unable to load the full shift summary. Please try again.</p>
          ) : (
            <>
              <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
                <span><b>{rooms.length}</b> assigned</span><span><b>{rooms.filter((room) => statusOf(room) === "completed").length}</b> completed</span>
                <span><b>{rooms.filter((room) => statusOf(room) === "pending").length}</b> pending</span><span><b>{maintenance.length}</b> maintenance reports</span>
              </div>
              {stamp ? <SupervisorStamp stamp={stamp} /> : (
                <div className="flex flex-wrap items-center gap-3">
                  <Button onClick={approve} disabled={busy || active || rooms.length === 0}><BadgeCheck className="h-4 w-4" />{busy ? "Stamping…" : "Approve & Stamp Shift"}</Button>
                  {active && <p className="text-sm text-muted-foreground">Active room visits must end before clearance.</p>}
                </div>
              )}
              {!rooms.length ? <p className="text-muted-foreground">No rooms assigned today.</p> : (
                <div className="overflow-x-auto rounded-lg border">
                  <table className="w-full text-sm">
                    <thead className="bg-muted text-left"><tr><th className="p-3">Room</th><th className="p-3">Completion</th><th className="p-3">Room status</th><th className="p-3">AM / PM guests</th><th className="p-3">Notes &amp; maintenance</th></tr></thead>
                    <tbody className="divide-y">{rooms.map((room) => (
                      <tr key={room.id} className="align-top">
                        <td className="p-3 font-bold"><Link to="/room/$id" params={{ id: room.id }} className="text-primary underline">{room.room_number}</Link></td>
                        <td className="p-3"><StatusBadge status={statusOf(room)} /></td>
                        <td className="p-3">{room.room_status ? `${room.room_status} · ${codeLabel(room.room_status)}` : "—"}</td>
                        <td className="p-3 tabular-nums">{room.morning_guests ?? "—"} / {room.evening_guests ?? "—"}</td>
                        <td className="p-3 min-w-52 max-w-sm space-y-3">{notes.filter((note) => note.assignment_id === room.id).map((note) => (
                          <div key={note.id} className="space-y-1">
                            {note.is_maintenance && <p className="flex items-center gap-1 font-semibold text-destructive"><Wrench className="h-4 w-4" />Maintenance Issue</p>}
                            <p className="break-words">{note.body || "Photo attachment"}</p>
                            <p className="text-xs text-muted-foreground">{new Date(note.created_at).toLocaleString()}</p>
                            {note.photos.map((photo, index) => <a key={`${photo}-${index}`} href={photo} target="_blank" rel="noreferrer" className="text-xs text-primary underline inline-block mr-3">Photo {index + 1}</a>)}
                          </div>
                        ))}</td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </section>
  );
}