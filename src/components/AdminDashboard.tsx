import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Plus, Trash2, UserPlus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { createStaff } from "@/lib/staff.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { StatusBadge } from "@/components/StatusBadge";
import { useAssignments, useNow } from "@/hooks/use-assignments";
import { durationMs, fmtDuration, fmtTime, statusOf, todayISO, type Status } from "@/lib/rooms";

type Staff = { id: string; email: string; full_name: string | null; isAdmin: boolean };

function useStaff() {
  return useQuery({
    queryKey: ["staff"],
    queryFn: async () => {
      const [{ data: profiles }, { data: roles }] = await Promise.all([
        supabase.from("profiles").select("id,email,full_name").order("full_name"),
        supabase.from("user_roles").select("user_id,role"),
      ]);
      const admins = new Set((roles ?? []).filter((r) => r.role === "admin").map((r) => r.user_id));
      return (profiles ?? []).map((p) => ({ ...p, isAdmin: admins.has(p.id) })) as Staff[];
    },
  });
}

export function AdminDashboard() {
  const [date, setDate] = useState(todayISO());
  const [filter, setFilter] = useState<Status | "all">("all");
  const { data: rows = [] } = useAssignments(date);
  const { data: staff = [] } = useStaff();
  const now = useNow();
  const housemen = staff.filter((s) => !s.isAdmin);
  const nameOf = (id: string) => {
    const s = staff.find((x) => x.id === id);
    return s?.full_name || s?.email || "—";
  };

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
          <h1 className="font-display text-2xl font-bold flex items-center gap-2">
            Live board <span className="h-2 w-2 rounded-full bg-status-done animate-pulse" />
          </h1>
          <p className="text-sm text-muted-foreground">Updates instantly as housemen check in and out.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-auto" />
          <AssignDialog date={date} housemen={housemen} />
          <StaffDialog />
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {([
          ["all", "Total rooms", rows.length],
          ["pending", "Pending", counts.pending],
          ["in_progress", "In progress", counts.in_progress],
          ["completed", "Completed", counts.completed],
        ] as const).map(([k, label, n]) => (
          <button key={k} onClick={() => setFilter(k)}
            className={`rounded-xl border p-4 text-left transition ${filter === k ? "border-primary bg-primary/5" : "bg-card"}`}>
            <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
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
                <tr>{["Room", "Houseman", "Status", "Start", "End", "Duration", "AM", "PM", ""].map((h) => <th key={h} className="px-4 py-3 text-left font-semibold">{h}</th>)}</tr>
              </thead>
              <tbody>
                {visible.map((r) => (
                  <tr key={r.id} className="border-t">
                    <td className="px-4 py-3 font-display font-bold text-base">{r.room_number}</td>
                    <td className="px-4 py-3">{nameOf(r.houseman_id)}</td>
                    <td className="px-4 py-3"><StatusBadge status={statusOf(r)} /></td>
                    <td className="px-4 py-3 tabular-nums">{fmtTime(r.started_at)}</td>
                    <td className="px-4 py-3 tabular-nums">{fmtTime(r.ended_at)}</td>
                    <td className="px-4 py-3 tabular-nums">{fmtDuration(durationMs(r, now))}</td>
                    <td className="px-4 py-3">{r.morning_guests ?? "—"}</td>
                    <td className="px-4 py-3">{r.evening_guests ?? "—"}</td>
                    <td className="px-4 py-3 text-right">
                      <Button variant="ghost" size="icon" onClick={() => remove(r.id)} aria-label="Remove"><Trash2 className="h-4 w-4" /></Button>
                    </td>
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
                    <p className="text-sm text-muted-foreground">{nameOf(r.houseman_id)}</p>
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

function AssignDialog({ date, housemen }: { date: string; housemen: Staff[] }) {
  const [open, setOpen] = useState(false);
  const [who, setWho] = useState("");
  const [rooms, setRooms] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const list = Array.from(new Set(rooms.split(/[\s,]+/).map((r) => r.trim()).filter(Boolean)));
    if (!who) return toast.error("Choose a houseman");
    if (!list.length || list.some((r) => !/^[A-Za-z0-9-]{1,10}$/.test(r))) return toast.error("Enter valid room numbers");
    setBusy(true);
    const { error } = await supabase.from("room_assignments")
      .insert(list.map((room_number) => ({ room_number, houseman_id: who, work_date: date })));
    setBusy(false);
    if (error) return toast.error(error.code === "23505" ? "One of those rooms is already assigned for this day" : error.message);
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
              <SelectContent>
                {housemen.map((h) => <SelectItem key={h.id} value={h.id}>{h.full_name || h.email}</SelectItem>)}
              </SelectContent>
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

function StaffDialog() {
  const qc = useQueryClient();
  const create = useServerFn(createStaff);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ fullName: "", email: "", password: "", role: "houseman" as "houseman" | "admin" });
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (form.password.length < 8) return toast.error("Password must be at least 8 characters");
    setBusy(true);
    try {
      await create({ data: form });
      toast.success(`Account created for ${form.email}`);
      setForm({ fullName: "", email: "", password: "", role: "houseman" });
      qc.invalidateQueries({ queryKey: ["staff"] });
      setOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create account");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button variant="outline"><UserPlus className="h-4 w-4" /> New staff</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Create staff account</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5"><Label>Full name</Label><Input required maxLength={100} value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>Email</Label><Input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>Temporary password</Label><Input required minLength={8} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></div>
          <div className="space-y-1.5">
            <Label>Role</Label>
            <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v as "houseman" | "admin" })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="houseman">Houseman</SelectItem><SelectItem value="admin">Manager</SelectItem></SelectContent>
            </Select>
          </div>
          <Button type="submit" className="w-full" disabled={busy}>{busy ? "Creating…" : "Create account"}</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
