import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { Bell, CalendarDays, FileDown, Megaphone, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useAssignments } from "@/hooks/use-assignments";
import { useBroadcast, useNotes, useSessions, useSignoffs, useWeeklyTasks } from "@/hooks/use-hotel-data";
import { nameOf, type Member } from "@/hooks/use-staff";
import { WEEKDAYS, durationMs, fmtDuration, fmtTime, roomStatusLabel, statusLabel, statusOf, todayISO, type Assignment } from "@/lib/rooms";

/* ---------- Banner shown at the top of staff & supervisor dashboards ---------- */
export function DayBanner({ hotelId }: { hotelId: string }) {
  const date = todayISO();
  const { data: tasks = [] } = useWeeklyTasks(hotelId);
  const { data: bc } = useBroadcast(hotelId, date);
  const { data: signoffs = [] } = useSignoffs(hotelId, date);
  const task = tasks.find((t) => t.weekday === new Date().getDay())?.body;
  const clearance = signoffs.find((s) => s.kind === "clearance");
  if (!task && !bc?.message && !clearance) return null;
  return (
    <div className="space-y-2 mb-5">
      {bc?.message && (
        <div className="flex gap-3 rounded-xl border border-brass/40 bg-brass/10 p-3 text-sm">
          <Megaphone className="h-4 w-4 mt-0.5 shrink-0 text-brass" /><p className="whitespace-pre-wrap">{bc.message}</p>
        </div>
      )}
      {task && (
        <div className="flex gap-3 rounded-xl border bg-card p-3 text-sm">
          <CalendarDays className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
          <div><p className="text-xs uppercase tracking-wider text-muted-foreground">{WEEKDAYS[new Date().getDay()]} task</p><p className="whitespace-pre-wrap">{task}</p></div>
        </div>
      )}
      {clearance && (
        <div className="flex gap-3 rounded-xl border border-status-done/40 bg-status-done/10 p-3 text-sm">
          <ShieldCheck className="h-4 w-4 mt-0.5 shrink-0 text-status-done" />
          <p><b>Shift cleared</b> — signed “{clearance.signature}” at {fmtTime(clearance.created_at)}{clearance.note ? ` · ${clearance.note}` : ""}</p>
        </div>
      )}
    </div>
  );
}

/* ---------- Notifications ---------- */
type Notif = { id: string; message: string; kind: string; created_at: string; assignment_id: string | null };
export function NotificationBell() {
  const [items, setItems] = useState<Notif[]>([]);
  const [unread, setUnread] = useState(0);
  useEffect(() => {
    supabase.from("notifications").select("*").order("created_at", { ascending: false }).limit(30).then(({ data }) => setItems((data as Notif[]) ?? []));
    const ch = supabase.channel(`notif-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications" }, (p) => {
        const n = p.new as Notif;
        setItems((x) => [n, ...x].slice(0, 30));
        setUnread((u) => u + 1);
        (n.kind === "maintenance" ? toast.error : toast.info)(n.message);
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);
  return (
    <Popover onOpenChange={(o) => o && setUnread(0)}>
      <PopoverTrigger asChild>
        <Button variant="ghostHero" size="icon" aria-label="Notifications" className="relative">
          <Bell className="h-4 w-4" />
          {unread > 0 && <span className="absolute -top-0.5 -right-0.5 rounded-full bg-destructive text-destructive-foreground text-[10px] px-1">{unread}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0 max-h-96 overflow-auto">
        {items.length === 0 ? <p className="p-4 text-sm text-muted-foreground">No alerts yet.</p> : (
          <ul className="divide-y">
            {items.map((n) => (
              <li key={n.id} className="px-4 py-2 text-sm">
                {n.assignment_id ? <Link to="/room/$id" params={{ id: n.assignment_id }} className={n.kind === "maintenance" ? "text-destructive font-medium" : ""}>{n.message}</Link> : n.message}
                <p className="text-xs text-muted-foreground">{fmtTime(n.created_at)}</p>
              </li>
            ))}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
}

/* ---------- Occupancy report ---------- */
export function OccupancyReport({ members }: { members: Member[] }) {
  const [date, setDate] = useState(todayISO());
  const { data: rows = [] } = useAssignments(date);
  const { data: notes = [] } = useNotes(rows.map((r) => r.id));
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div><h2 className="font-display text-2xl font-bold">Occupancy report</h2><p className="text-sm text-muted-foreground">Updates live.</p></div>
        <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-auto" />
      </div>
      <div className="rounded-xl border bg-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted text-xs uppercase tracking-wider text-muted-foreground">
            <tr>{["Room", "AM guests", "PM guests / Status", "Notes", "Houseman"].map((h) => <th key={h} className="px-3 py-2 text-left">{h}</th>)}</tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">No rooms.</td></tr>}
            {rows.map((r) => {
              const n = notes.filter((x) => x.assignment_id === r.id);
              return (
                <tr key={r.id} className="border-t align-top">
                  <td className="px-3 py-2 font-display font-bold"><Link to="/room/$id" params={{ id: r.id }} className="hover:underline">{r.room_number}</Link></td>
                  <td className="px-3 py-2">{r.morning_guests ?? "—"}</td>
                  <td className="px-3 py-2">{r.evening_guests ?? roomStatusLabel(r.room_status)}{r.evening_guests != null && r.room_status ? ` · ${roomStatusLabel(r.room_status)}` : ""}</td>
                  <td className="px-3 py-2 max-w-xs">{n.length ? n.slice(0, 2).map((x) => <p key={x.id} className={x.is_maintenance ? "text-destructive" : ""}>{x.is_maintenance ? "🔧 " : ""}{x.body}</p>) : "—"}</td>
                  <td className="px-3 py-2 text-muted-foreground">{nameOf(members.find((m) => m.id === r.houseman_id))}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ---------- Weekly tasks editor (manager) ---------- */
export function WeeklyTasksEditor({ hotelId }: { hotelId: string }) {
  const { data: tasks = [] } = useWeeklyTasks(hotelId);
  const [draft, setDraft] = useState<Record<number, string>>({});
  useEffect(() => { setDraft(Object.fromEntries(tasks.map((t) => [t.weekday, t.body]))); }, [tasks]);
  async function save(day: number) {
    const body = (draft[day] ?? "").trim().slice(0, 1000);
    const { error } = await supabase.from("weekly_tasks").upsert({ hotel_id: hotelId, weekday: day, body, updated_at: new Date().toISOString() });
    if (error) toast.error(error.message); else toast.success(`${WEEKDAYS[day]} saved`);
  }
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">Each day's task shows automatically on supervisor and houseman screens.</p>
      <div className="grid gap-3 md:grid-cols-2">
        {WEEKDAYS.map((d, i) => (
          <div key={d} className="rounded-xl border bg-card p-3 space-y-2">
            <Label>{d}{i === new Date().getDay() && <span className="ml-2 text-xs text-primary">today</span>}</Label>
            <Textarea rows={2} maxLength={1000} value={draft[i] ?? ""} onChange={(e) => setDraft({ ...draft, [i]: e.target.value })} />
            <Button size="sm" variant="outline" onClick={() => save(i)}>Save</Button>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------- Supervisor tools ---------- */
export function BroadcastEditor({ hotelId }: { hotelId: string }) {
  const date = todayISO();
  const { data: bc } = useBroadcast(hotelId, date);
  const [msg, setMsg] = useState("");
  useEffect(() => setMsg(bc?.message ?? ""), [bc?.message]);
  async function save() {
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from("broadcasts").upsert({ hotel_id: hotelId, work_date: date, message: msg.trim().slice(0, 1000), author_id: u.user!.id, updated_at: new Date().toISOString() });
    if (error) toast.error(error.message); else toast.success("Banner published");
  }
  return (
    <div className="rounded-xl border bg-card p-4 space-y-2">
      <Label className="flex items-center gap-2"><Megaphone className="h-4 w-4" /> Today's banner for staff</Label>
      <Textarea rows={3} maxLength={1000} placeholder="General message or extra tasks…" value={msg} onChange={(e) => setMsg(e.target.value)} />
      <Button size="sm" onClick={save}>Publish banner</Button>
    </div>
  );
}

function reportFor(rows: Assignment[], members: Member[], kind: "am" | "pm") {
  return rows.map((r) => ({
    room: r.room_number,
    houseman: nameOf(members.find((m) => m.id === r.houseman_id)),
    guests: kind === "am" ? r.morning_guests : r.evening_guests,
    room_status: r.room_status,
    status: statusOf(r),
  }));
}

export function ShiftReports({ hotelId, members }: { hotelId: string; members: Member[] }) {
  const date = todayISO();
  const { data: rows = [] } = useAssignments(date);
  const { data: signoffs = [] } = useSignoffs(hotelId, date);
  const [kind, setKind] = useState<"am" | "pm">("am");
  const [note, setNote] = useState("");
  const [sig, setSig] = useState("");
  const report = reportFor(rows, members, kind);

  async function submit(k: "am" | "pm" | "clearance") {
    if (!sig.trim()) { toast.error("Type your name as signature"); return; }
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from("signoffs").insert({
      hotel_id: hotelId, work_date: date, kind: k, author_id: u.user!.id,
      note: note.trim().slice(0, 1000), signature: sig.trim().slice(0, 100),
      report: k === "clearance" ? null : report,
    });
    if (error) toast.error(error.message);
    else { toast.success(k === "clearance" ? "Clearance signed" : `${k.toUpperCase()} report submitted to manager`); setNote(""); }
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {(["am", "pm"] as const).map((k) => <Button key={k} variant={kind === k ? "default" : "outline"} onClick={() => setKind(k)}>{k.toUpperCase()} report</Button>)}
      </div>
      <div className="rounded-xl border bg-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted text-xs uppercase text-muted-foreground"><tr>{["Room", "Houseman", `${kind.toUpperCase()} guests`, "Room status", "Progress"].map((h) => <th key={h} className="px-3 py-2 text-left">{h}</th>)}</tr></thead>
          <tbody>
            {report.length === 0 && <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">No rooms today.</td></tr>}
            {report.map((r) => (
              <tr key={r.room} className="border-t"><td className="px-3 py-2 font-bold">{r.room}</td><td className="px-3 py-2">{r.houseman}</td><td className="px-3 py-2">{r.guests ?? "—"}</td><td className="px-3 py-2">{roomStatusLabel(r.room_status)}</td><td className="px-3 py-2">{statusLabel[r.status]}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="rounded-xl border bg-card p-4 grid gap-3 md:grid-cols-2">
        <div className="space-y-1.5"><Label>Note</Label><Textarea rows={2} maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} /></div>
        <div className="space-y-1.5"><Label>Electronic signature (full name)</Label><Input maxLength={100} value={sig} onChange={(e) => setSig(e.target.value)} className="font-display italic text-lg" /></div>
        <div className="flex flex-wrap gap-2 md:col-span-2">
          <Button onClick={() => submit(kind)}>Save & submit {kind.toUpperCase()} to manager</Button>
          <Button variant="brass" onClick={() => submit("clearance")}><ShieldCheck className="h-4 w-4" /> Sign end-of-shift clearance</Button>
        </div>
      </div>
      <SignoffList signoffs={signoffs} members={members} />
    </div>
  );
}

export function SignoffList({ signoffs, members }: { signoffs: { id: string; kind: string; note: string; signature: string; created_at: string; author_id: string; report: unknown }[]; members: Member[] }) {
  if (!signoffs.length) return <p className="text-sm text-muted-foreground">No submissions today.</p>;
  return (
    <ul className="divide-y rounded-xl border bg-card">
      {signoffs.map((s) => (
        <li key={s.id} className="px-4 py-3 text-sm">
          <p><b>{s.kind === "clearance" ? "Shift clearance" : `${s.kind.toUpperCase()} report`}</b> · {fmtTime(s.created_at)} · by {nameOf(members.find((m) => m.id === s.author_id))}</p>
          <p className="text-muted-foreground">Signed “<span className="italic">{s.signature}</span>”{s.note ? ` — ${s.note}` : ""}{Array.isArray(s.report) ? ` · ${s.report.length} rooms` : ""}</p>
        </li>
      ))}
    </ul>
  );
}

/* ---------- Manager: End Shift PDF ---------- */
export function EndShiftButton({ hotelName, members }: { hotelName: string; members: Member[] }) {
  const [busy, setBusy] = useState(false);
  async function run() {
    setBusy(true);
    try {
      const date = todayISO();
      const { data: rows = [] } = await supabase.from("room_assignments").select("*").eq("work_date", date).order("room_number");
      const ids = (rows ?? []).map((r) => r.id);
      const none = ["00000000-0000-0000-0000-000000000000"];
      const [{ data: sessions = [] }, { data: notes = [] }] = await Promise.all([
        supabase.from("room_sessions").select("*").in("assignment_id", ids.length ? ids : none).order("started_at"),
        supabase.from("room_notes").select("*").in("assignment_id", ids.length ? ids : none).order("created_at"),
      ]);
      const { default: jsPDF } = await import("jspdf");
      const { default: autoTable } = await import("jspdf-autotable");
      const doc = new jsPDF({ orientation: "landscape" });
      const who = (id: string) => nameOf(members.find((m) => m.id === id));
      doc.setFontSize(16); doc.text(`${hotelName} — Daily housekeeping report`, 14, 15);
      doc.setFontSize(10); doc.text(`${date} · generated ${new Date().toLocaleString()}`, 14, 21);
      const total = (id: string) => (sessions ?? []).filter((s) => s.assignment_id === id).reduce((t, s) => t + durationMs(s), 0);
      autoTable(doc, {
        startY: 26,
        head: [["Room", "Houseman", "Progress", "Room status", "First in", "Last out", "Sessions", "Total time", "AM", "PM"]],
        body: (rows ?? []).map((r) => [r.room_number, who(r.houseman_id), statusLabel[statusOf(r)], roomStatusLabel(r.room_status), fmtTime(r.started_at), fmtTime(r.ended_at),
          String((sessions ?? []).filter((s) => s.assignment_id === r.id).length), fmtDuration(total(r.id)), r.morning_guests ?? "—", r.evening_guests ?? "—"]),
      });
      const room = (id: string) => (rows ?? []).find((r) => r.id === id)?.room_number ?? "";
      autoTable(doc, {
        head: [["Room", "Event", "Time", "Detail"]],
        body: [
          ...(sessions ?? []).flatMap((s) => [[room(s.assignment_id), "Check-in", fmtTime(s.started_at), who(s.houseman_id)], ...(s.ended_at ? [[room(s.assignment_id), "Check-out", fmtTime(s.ended_at), s.note ?? ""]] : [])]),
          ...(notes ?? []).map((n) => [room(n.assignment_id), n.is_maintenance ? "MAINTENANCE" : "Note", fmtTime(n.created_at), `${n.body}${n.photos.length ? ` (${n.photos.length} photo)` : ""}`]),
        ].sort((a, b) => String(a[0]).localeCompare(String(b[0]))),
      });
      doc.save(`report-${date}.pdf`);
      toast.success("Shift ended — report downloaded");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not build report");
    } finally { setBusy(false); }
  }
  return <Button variant="brass" onClick={run} disabled={busy}><FileDown className="h-4 w-4" /> {busy ? "Building…" : "End shift"}</Button>;
}
