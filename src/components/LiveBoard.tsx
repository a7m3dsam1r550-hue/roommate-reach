import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { StatusBadge } from "@/components/StatusBadge";
import { useAssignments, useNow } from "@/hooks/use-assignments";
import { nameOf, type Member } from "@/hooks/use-staff";
import { durationMs, fmtDuration, fmtTime, statusOf, todayISO, type Status } from "@/lib/rooms";

/** Live room board. Managers can assign/remove; supervisors see read-only (RLS limits rows to their team). */
export function LiveBoard({ members, readOnly, title, subtitle }: {
  members: Member[]; readOnly?: boolean; title: string; subtitle: string;
}) {
  const [date, setDate] = useState(todayISO());
  const [filter, setFilter] = useState<Status | "all">("all");
  const [who, setWho] = useState<string>("all");
  const { data: all = [] } = useAssignments(date);
  const now = useNow();
  const housemen = members.filter((s) => s.role === "houseman");
  const label = (id: string) => nameOf(members.find((x) => x.id === id));
  const rows = all.filter((r) => who === "all" || r.houseman_id === who);

  const counts = useMemo(() => {
    const c = { pending: 0, in_progress: 0, completed: 0 };
    rows.forEach((r) => c[statusOf(r)]++);
    return c;
  }, [rows]);
  const guests = rows.reduce((s, r) => s + (r.morning_guests ?? 0), 0);
  const eveningGuests = rows.reduce((s, r) => s + (r.evening_guests ?? 0), 0);
  const visible = rows.filter((r) => filter === "all" || statusOf(r) === filter);

  async function remove(id: string) {
    const { error } = await supabase.from("room_assignments").delete().eq("id", id);
    if (error) toast.error(error.message);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl font-bold flex items-center gap-2">
            {title} <span className="h-2 w-2 rounded-full bg-status-done animate-pulse" />
          </h2>
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-auto" />
          <Select value={who} onValueChange={setWho}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All staff</SelectItem>
              {housemen.map((h) => <SelectItem key={h.id} value={h.id}>{nameOf(h)}</SelectItem>)}
            </SelectContent>
          </Select>
          {!readOnly && <AssignDialog date={date} housemen={housemen} />}
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {([
          ["all", "Total rooms", rows.length],
          ["pending", "Pending", counts.pending],
          ["in_progress", "In progress", counts.in_progress],
          ["completed", "Completed", counts.completed],
        ] as const).map(([k, l, n]) => (
          <button key={k} onClick={() => setFilter(k)}
            className={`rounded-xl border p-4 text-left transition ${filter === k ? "border-primary bg-primary/5" : "bg-card"}`}>
            <p className="text-xs uppercase tracking-wider text-muted-foreground">{l}</p>
            <p className="font-display text-3xl font-bold mt-1">{n}</p>
          </button>
        ))}
        <div className="rounded-xl border bg-card p-4 col-span-2 lg:col-span-1">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Guests AM / PM</p>
          <p className="font-display text-3xl font-bold mt-1">{guests} / {eveningGuests}</p>
        </div>
      </div>

      {visible.length === 0 ? (
        <div className="rounded-xl border border-dashed p-10 text-center text-muted-foreground">No rooms to show for this day.</div>
      ) : (
        <>
          <div className="hidden md:block rounded-xl border bg-card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted text-muted-foreground text-xs uppercase tracking-wider">
                <tr>{["Room", "Houseman", "Status", "Start", "End", "Duration", "AM", "PM", ...(readOnly ? [] : [""])].map((h) => <th key={h} className="px-4 py-3 text-left font-semibold">{h}</th>)}</tr>
              </thead>
              <tbody>
                {visible.map((r) => (
                  <tr key={r.id} className="border-t">
                    <td className="px-4 py-3 font-display font-bold text-base">{r.room_number}</td>
                    <td className="px-4 py-3">{label(r.houseman_id)}</td>
                    <td className="px-4 py-3"><StatusBadge status={statusOf(r)} /></td>
                    <td className="px-4 py-3 tabular-nums">{fmtTime(r.started_at)}</td>
                    <td className="px-4 py-3 tabular-nums">{fmtTime(r.ended_at)}</td>
                    <td className="px-4 py-3 tabular-nums">{fmtDuration(durationMs(r, now))}</td>
                    <td className="px-4 py-3">{r.morning_guests ?? "—"}</td>
                    <td className="px-4 py-3">{r.evening_guests ?? "—"}</td>
                    {!readOnly && (
                      <td className="px-4 py-3 text-right">
                        <Button variant="ghost" size="icon" onClick={() => remove(r.id)} aria-label="Remove"><Trash2 className="h-4 w-4" /></Button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="md:hidden space-y-3">
            {visible.map((r) => (
              <div key={r.id} className="rounded-xl border bg-card p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-display text-2xl font-bold">{r.room_number}</span>
                    <p className="text-sm text-muted-foreground">{label(r.houseman_id)}</p>
                  </div>
                  <StatusBadge status={statusOf(r)} />
                </div>
                <div className="grid grid-cols-5 gap-1 mt-3 text-center text-xs">
                  {[["Start", fmtTime(r.started_at)], ["End", fmtTime(r.ended_at)], ["Time", fmtDuration(durationMs(r, now))], ["AM", r.morning_guests ?? "—"], ["PM", r.evening_guests ?? "—"]].map(([l, v]) => (
                    <div key={l as string}><p className="text-muted-foreground uppercase text-[10px]">{l}</p><p className="font-semibold tabular-nums">{v}</p></div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function AssignDialog({ date, housemen }: { date: string; housemen: Member[] }) {
  const [open, setOpen] = useState(false);
  const [who, setWho] = useState("");
  const [rooms, setRooms] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const list = Array.from(new Set(rooms.split(/[\s,]+/).map((r) => r.trim()).filter(Boolean)));
    if (!who) { toast.error("Choose a houseman"); return; }
    if (!list.length || list.some((r) => !/^[A-Za-z0-9-]{1,10}$/.test(r))) { toast.error("Enter valid room numbers"); return; }
    setBusy(true);
    const { error } = await supabase.from("room_assignments")
      .insert(list.map((room_number) => ({ room_number, houseman_id: who, work_date: date })));
    setBusy(false);
    if (error) { toast.error(error.code === "23505" ? "One of those rooms is already assigned for this day" : error.message); return; }
    toast.success(`${list.length} room(s) assigned`);
    setRooms("");
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button><Plus className="h-4 w-4" /> Assign rooms</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Assign rooms for {date}</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Houseman</Label>
            <Select value={who} onValueChange={setWho}>
              <SelectTrigger><SelectValue placeholder={housemen.length ? "Select houseman" : "Create a staff account first"} /></SelectTrigger>
              <SelectContent>{housemen.map((h) => <SelectItem key={h.id} value={h.id}>{nameOf(h)}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rooms">Room numbers</Label>
            <Input id="rooms" placeholder="101, 102, 205" value={rooms} onChange={(e) => setRooms(e.target.value)} />
            <p className="text-xs text-muted-foreground">Separate with commas or spaces.</p>
          </div>
          <Button type="submit" className="w-full" disabled={busy}>{busy ? "Saving…" : "Assign"}</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
