import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, Camera, LogIn, LogOut, Wrench } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { StatusBadge } from "@/components/StatusBadge";
import { useNow } from "@/hooks/use-assignments";
import { ROOM_CODES, durationMs, fmtDuration, fmtTime, statusOf, type Assignment } from "@/lib/rooms";

export const Route = createFileRoute("/_authenticated/room/$id")({
  head: () => ({
    meta: [
      { title: "Room details — RoomRound" },
      { name: "description", content: "Room status, check-in history, notes and photos." },
      { property: "og:title", content: "Room details — RoomRound" },
      { property: "og:description", content: "Room status, check-in history, notes and photos." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RoomPage,
});

type Session = { id: string; started_at: string; ended_at: string | null; note: string | null };
type Note = { id: string; body: string; photos: string[]; is_maintenance: boolean; created_at: string; urls?: string[] };

function RoomPage() {
  const { id } = Route.useParams();
  const { user } = Route.useRouteContext();
  const qc = useQueryClient();
  const now = useNow();

  const { data, refetch } = useQuery({
    queryKey: ["room", id],
    queryFn: async () => {
      const [a, s, n] = await Promise.all([
        supabase.from("room_assignments").select("*").eq("id", id).maybeSingle(),
        supabase.from("room_sessions").select("id,started_at,ended_at,note").eq("assignment_id", id).order("started_at"),
        supabase.from("room_notes").select("id,body,photos,is_maintenance,created_at").eq("assignment_id", id).order("created_at", { ascending: false }),
      ]);
      if (a.error) throw a.error;
      const notes = (n.data ?? []) as Note[];
      const paths = notes.flatMap((x) => x.photos);
      if (paths.length) {
        const { data: signed } = await supabase.storage.from("room-photos").createSignedUrls(paths, 3600);
        const map = new Map((signed ?? []).map((x) => [x.path, x.signedUrl]));
        notes.forEach((x) => (x.urls = x.photos.map((p) => map.get(p) ?? "").filter(Boolean)));
      }
      return { a: a.data as Assignment | null, sessions: (s.data ?? []) as Session[], notes };
    },
  });

  useEffect(() => {
    const ch = supabase.channel(`room-${id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "room_assignments", filter: `id=eq.${id}` }, () => refetch())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [id, refetch]);

  const a = data?.a;
  const refresh = () => { refetch(); qc.invalidateQueries({ queryKey: ["assignments"] }); };

  if (!data) return <Shell><p className="text-muted-foreground">Loading…</p></Shell>;
  if (!a) return <Shell><p className="text-muted-foreground">Room not found.</p></Shell>;

  const mine = a.houseman_id === user.id;
  const open = data.sessions.find((s) => !s.ended_at);
  const totalMs = data.sessions.reduce((t, s) => t + ((s.ended_at ? new Date(s.ended_at).getTime() : now) - new Date(s.started_at).getTime()), 0);

  return (
    <Shell>
      <div className="flex items-start justify-between mb-5">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Room</p>
          <h1 className="font-display text-5xl font-bold leading-none">{a.room_number}</h1>
        </div>
        <StatusBadge status={statusOf(a)} />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <section className="rounded-2xl border bg-card p-5 space-y-4">
          <StatusSelect a={a} editable={mine} onSaved={refresh} />
          <Guests a={a} editable={mine} onSaved={refresh} />
          <dl className="grid grid-cols-3 gap-2 text-center rounded-xl bg-muted p-3">
            <div><dt className="text-[10px] uppercase text-muted-foreground">First in</dt><dd className="font-semibold tabular-nums">{fmtTime(a.started_at)}</dd></div>
            <div><dt className="text-[10px] uppercase text-muted-foreground">Last out</dt><dd className="font-semibold tabular-nums">{fmtTime(a.ended_at)}</dd></div>
            <div><dt className="text-[10px] uppercase text-muted-foreground">Total time</dt><dd className="font-semibold tabular-nums">{fmtDuration(totalMs || durationMs(a, now))}</dd></div>
          </dl>
          {mine && <CheckInOut id={a.id} roomNumber={a.room_number} open={!!open} onDone={refresh} />}
        </section>

        <section className="rounded-2xl border bg-card p-5">
          <h2 className="font-display font-bold mb-3">Visits today</h2>
          {data.sessions.length === 0 ? <p className="text-sm text-muted-foreground">No check-ins yet.</p> : (
            <ol className="space-y-2">
              {data.sessions.map((s, i) => (
                <li key={s.id} className="rounded-lg bg-muted p-3 text-sm">
                  <div className="flex justify-between font-semibold tabular-nums">
                    <span>#{i + 1} · {fmtTime(s.started_at)} → {s.ended_at ? fmtTime(s.ended_at) : "now"}</span>
                    <span>{fmtDuration((s.ended_at ? new Date(s.ended_at).getTime() : now) - new Date(s.started_at).getTime())}</span>
                  </div>
                  {s.note && <p className="mt-1 text-muted-foreground">{s.note}</p>}
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>

      <section className="rounded-2xl border bg-card p-5 mt-4">
        <h2 className="font-display font-bold mb-3">Notes & photos</h2>
        {mine && a.hotel_id && <NoteForm assignmentId={a.id} hotelId={a.hotel_id} onSaved={refresh} />}
        <ul className="space-y-3 mt-4">
          {data.notes.map((n) => (
            <li key={n.id} className={`rounded-lg border p-3 ${n.is_maintenance ? "border-destructive" : ""}`}>
              <div className="flex justify-between text-xs text-muted-foreground mb-1">
                <span>{n.is_maintenance && <b className="text-destructive mr-2">MAINTENANCE</b>}{new Date(n.created_at).toLocaleString([], { hour: "2-digit", minute: "2-digit", day: "numeric", month: "short" })}</span>
              </div>
              {n.body && <p className="text-sm whitespace-pre-wrap">{n.body}</p>}
              {n.urls && n.urls.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {n.urls.map((u) => <a key={u} href={u} target="_blank" rel="noreferrer"><img src={u} alt="Room note" className="h-24 w-24 rounded-md object-cover" /></a>)}
                </div>
              )}
            </li>
          ))}
          {data.notes.length === 0 && <li className="text-sm text-muted-foreground">No notes yet.</li>}
        </ul>
      </section>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-20 bg-hero text-hero-foreground">
        <div className="mx-auto max-w-4xl px-4 h-14 flex items-center gap-3">
          <Link to="/app" className="flex items-center gap-2 text-sm"><ArrowLeft className="h-4 w-4" /> Back</Link>
          <span className="font-display font-bold">RoomRound</span>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-4 py-6">{children}</main>
    </div>
  );
}

function StatusSelect({ a, editable, onSaved }: { a: Assignment; editable: boolean; onSaved: () => void }) {
  async function change(v: string) {
    const { error } = await supabase.from("room_assignments").update({ room_status: v || null }).eq("id", a.id);
    if (error) toast.error(error.message); else { toast.success("Status updated"); onSaved(); }
  }
  return (
    <div className="space-y-1">
      <Label htmlFor="rs" className="text-xs">Room status</Label>
      <select id="rs" disabled={!editable} value={a.room_status ?? ""} onChange={(e) => change(e.target.value)}
        className="h-12 w-full rounded-md border bg-background px-3 text-base disabled:opacity-70">
        <option value="">— Not set —</option>
        {ROOM_CODES.map((c) => <option key={c.code} value={c.code}>{c.code} · {c.label}</option>)}
      </select>
    </div>
  );
}

function Guests({ a, editable, onSaved }: { a: Assignment; editable: boolean; onSaved: () => void }) {
  const [m, setM] = useState(a.morning_guests?.toString() ?? "");
  const [e, setE] = useState(a.evening_guests?.toString() ?? "");
  const pmLocked = !a.started_at;
  async function save(field: "morning_guests" | "evening_guests", value: string) {
    const n = value === "" ? null : Number(value);
    if (n !== null && (!Number.isInteger(n) || n < 0 || n > 50)) { toast.error("Guest count must be 0–50"); return; }
    if (n === a[field]) return;
    const { error } = await supabase.from("room_assignments").update({ [field]: n }).eq("id", a.id);
    if (error) toast.error(error.message); else { toast.success("Guest count saved"); onSaved(); }
  }
  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="space-y-1">
        <Label htmlFor="am" className="text-xs">AM guests</Label>
        <Input id="am" type="number" inputMode="numeric" min={0} max={50} className="h-12 text-lg" disabled={!editable}
          value={m} onChange={(ev) => setM(ev.target.value)} onBlur={() => save("morning_guests", m)} />
      </div>
      <div className="space-y-1">
        <Label htmlFor="pm" className="text-xs">PM guests {pmLocked && editable && <span className="text-muted-foreground">(check in first)</span>}</Label>
        <Input id="pm" type="number" inputMode="numeric" min={0} max={50} className="h-12 text-lg" disabled={!editable || pmLocked}
          value={e} onChange={(ev) => setE(ev.target.value)} onBlur={() => save("evening_guests", e)} />
      </div>
    </div>
  );
}

function CheckInOut({ id, roomNumber, open, onDone }: { id: string; roomNumber: string; open: boolean; onDone: () => void }) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  async function act() {
    setBusy(true);
    const { error } = open
      ? await supabase.rpc("room_check_out_note", { _id: id, _note: note })
      : await supabase.rpc("room_check_in", { _id: id });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success(open ? `Exited room ${roomNumber}` : `Entered room ${roomNumber}`);
    setNote("");
    onDone();
  }
  return (
    <div className="space-y-3">
      {open && (
        <div className="space-y-1">
          <Label htmlFor="sn" className="text-xs">Visit note (optional)</Label>
          <Textarea id="sn" maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} placeholder="What was done in this visit?" />
        </div>
      )}
      <Button size="lg" variant={open ? "brass" : "default"} className="h-14 w-full" disabled={busy} onClick={act}>
        {open ? <><LogOut className="h-5 w-5" /> Check-out</> : <><LogIn className="h-5 w-5" /> Check-in</>}
      </Button>
    </div>
  );
}

function NoteForm({ assignmentId, hotelId, onSaved }: { assignmentId: string; hotelId: string; onSaved: () => void }) {
  const [body, setBody] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [maint, setMaint] = useState(false);
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim() && files.length === 0) { toast.error("Write a note or add a photo"); return; }
    if (files.some((f) => f.size > 10 * 1024 * 1024)) { toast.error("Each photo must be under 10 MB"); return; }
    setBusy(true);
    const paths: string[] = [];
    for (const f of files) {
      const ext = f.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${hotelId}/${assignmentId}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from("room-photos").upload(path, f, { contentType: f.type });
      if (error) { setBusy(false); toast.error(error.message); return; }
      paths.push(path);
    }
    const { error } = await supabase.from("room_notes").insert({ assignment_id: assignmentId, hotel_id: hotelId, body: body.trim().slice(0, 2000), photos: paths, is_maintenance: maint });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success(maint ? "Maintenance issue reported — manager & supervisor alerted" : "Note saved");
    setBody(""); setFiles([]); setMaint(false);
    onSaved();
  }
  return (
    <form onSubmit={submit} className="space-y-3">
      <Textarea value={body} maxLength={2000} onChange={(e) => setBody(e.target.value)} placeholder={maint ? "Describe the maintenance issue…" : "Add a note…"} />
      <div className="flex flex-wrap items-center gap-4">
        <label className="inline-flex items-center gap-2 text-sm cursor-pointer rounded-md border px-3 h-10">
          <Camera className="h-4 w-4" /> {files.length ? `${files.length} photo(s)` : "Add photos"}
          <input type="file" accept="image/*" multiple className="sr-only" onChange={(e) => setFiles(Array.from(e.target.files ?? []))} />
        </label>
        <label className="inline-flex items-center gap-2 text-sm">
          <Switch checked={maint} onCheckedChange={setMaint} /> <Wrench className="h-4 w-4" /> Maintenance issue
        </label>
        <Button type="submit" disabled={busy} variant={maint ? "destructive" : "default"} className="ml-auto">
          {busy ? "Saving…" : maint ? "Report issue" : "Save note"}
        </Button>
      </div>
    </form>
  );
}
