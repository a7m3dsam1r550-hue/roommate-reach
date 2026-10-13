import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Building2, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LiveBoard } from "@/components/LiveBoard";
import { StaffDialog } from "@/components/StaffDialog";
import { ROLE_LABEL, nameOf, useMembers, useTeams, type Member, type StaffRole } from "@/hooks/use-staff";

type Hotel = { id: string; name: string; code: string; max_managers: number; max_supervisors: number; max_staff: number };

function useHotels() {
  return useQuery({
    queryKey: ["hotels"],
    queryFn: async () => {
      const { data, error } = await supabase.from("hotels").select("*").order("name");
      if (error) throw error;
      return data as Hotel[];
    },
  });
}

const countRole = (m: Member[], hotelId: string, role: StaffRole) => m.filter((x) => x.hotel_id === hotelId && x.role === role).length;

function Quota({ label, used, max }: { label: string; used: number; max: number }) {
  const pct = max ? Math.min(100, (used / max) * 100) : 100;
  return (
    <div>
      <div className="flex justify-between text-xs"><span className="text-muted-foreground">{label}</span><span className="font-semibold tabular-nums">{used}/{max}</span></div>
      <div className="h-1.5 rounded-full bg-muted mt-1 overflow-hidden"><div className={`h-full ${used >= max ? "bg-destructive" : "bg-primary"}`} style={{ width: `${pct}%` }} /></div>
    </div>
  );
}

function QuotaCard({ hotel, members }: { hotel: Hotel; members: Member[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-3 rounded-xl border bg-card p-4">
      <Quota label="Managers" used={countRole(members, hotel.id, "manager")} max={hotel.max_managers} />
      <Quota label="Supervisors" used={countRole(members, hotel.id, "supervisor")} max={hotel.max_supervisors} />
      <Quota label="Staff" used={countRole(members, hotel.id, "houseman")} max={hotel.max_staff} />
    </div>
  );
}

function MemberList({ members, roles }: { members: Member[]; roles: StaffRole[] }) {
  const list = members.filter((m) => roles.includes(m.role));
  if (!list.length) return <p className="text-sm text-muted-foreground rounded-xl border border-dashed p-6 text-center">No accounts yet.</p>;
  return (
    <ul className="divide-y rounded-xl border bg-card">
      {list.map((m) => (
        <li key={m.id} className="flex items-center justify-between px-4 py-3 text-sm">
          <div><p className="font-medium">{nameOf(m)}</p><p className="text-muted-foreground text-xs">{m.email}</p></div>
          <span className="text-xs uppercase tracking-wider text-muted-foreground">{ROLE_LABEL[m.role]}</span>
        </li>
      ))}
    </ul>
  );
}

/* ---------------- Super Admin ---------------- */
export function SuperAdminDashboard() {
  const { data: hotels = [] } = useHotels();
  const { data: members = [] } = useMembers();
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl font-bold">Hotels</h2>
          <p className="text-sm text-muted-foreground">{hotels.length} properties · {members.filter((m) => m.hotel_id).length} accounts</p>
        </div>
        <HotelDialog />
      </div>
      {hotels.length === 0 ? (
        <div className="rounded-xl border border-dashed p-10 text-center text-muted-foreground">Create your first hotel to get started.</div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {hotels.map((h) => {
            const admins = members.filter((m) => m.hotel_id === h.id && m.role === "hotel_admin");
            return (
              <div key={h.id} className="rounded-2xl border bg-card p-5 space-y-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <Building2 className="h-5 w-5 text-primary" />
                    <div><p className="font-display text-lg font-bold">{h.name}</p><p className="text-xs text-muted-foreground">Code: {h.code}</p></div>
                  </div>
                  <HotelDialog hotel={h} />
                </div>
                <div className="space-y-2">
                  <Quota label="Managers" used={countRole(members, h.id, "manager")} max={h.max_managers} />
                  <Quota label="Supervisors" used={countRole(members, h.id, "supervisor")} max={h.max_supervisors} />
                  <Quota label="Staff" used={countRole(members, h.id, "houseman")} max={h.max_staff} />
                </div>
                <div className="flex items-center justify-between gap-2 border-t pt-3">
                  <p className="text-xs text-muted-foreground">Hotel admins: {admins.length ? admins.map(nameOf).join(", ") : "none"}</p>
                  <StaffDialog roles={["hotel_admin"]} hotelId={h.id} label="Hotel admin" size="sm" />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function HotelDialog({ hotel }: { hotel?: Hotel }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const init = { name: hotel?.name ?? "", code: hotel?.code ?? "", max_managers: hotel?.max_managers ?? 2, max_supervisors: hotel?.max_supervisors ?? 5, max_staff: hotel?.max_staff ?? 30 };
  const [f, setF] = useState(init);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const code = f.code.trim().toUpperCase();
    if (!f.name.trim() || !/^[A-Z0-9-]{2,12}$/.test(code)) { toast.error("Enter a name and a 2–12 character code (letters, numbers)"); return; }
    if ([f.max_managers, f.max_supervisors, f.max_staff].some((n) => !Number.isInteger(n) || n < 0 || n > 1000)) { toast.error("Quotas must be 0–1000"); return; }
    setBusy(true);
    const payload = { ...f, name: f.name.trim(), code };
    const { error } = hotel
      ? await supabase.from("hotels").update(payload).eq("id", hotel.id)
      : await supabase.from("hotels").insert(payload);
    setBusy(false);
    if (error) { toast.error(error.code === "23505" ? "That hotel code is taken" : error.message); return; }
    toast.success(hotel ? "Hotel updated" : "Hotel created");
    qc.invalidateQueries({ queryKey: ["hotels"] });
    setOpen(false);
  }

  const num = (k: "max_managers" | "max_supervisors" | "max_staff", l: string) => (
    <div className="space-y-1.5"><Label>{l}</Label><Input type="number" min={0} value={f[k]} onChange={(e) => setF({ ...f, [k]: Number(e.target.value) })} /></div>
  );

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (o) setF(init); }}>
      <DialogTrigger asChild>
        {hotel ? <Button variant="ghost" size="sm">Edit</Button> : <Button><Plus className="h-4 w-4" /> New hotel</Button>}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>{hotel ? "Edit hotel" : "New hotel"}</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5"><Label>Hotel name</Label><Input required maxLength={100} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>Hotel code</Label><Input required maxLength={12} placeholder="GRAND-CAI" value={f.code} onChange={(e) => setF({ ...f, code: e.target.value })} /></div>
          <div className="grid grid-cols-3 gap-3">{num("max_managers", "Max managers")}{num("max_supervisors", "Max supervisors")}{num("max_staff", "Max staff")}</div>
          <Button type="submit" className="w-full" disabled={busy}>{busy ? "Saving…" : "Save"}</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ---------------- Hotel Admin ---------------- */
export function HotelAdminDashboard({ hotelId }: { hotelId: string }) {
  const { data: hotels = [] } = useHotels();
  const { data: members = [] } = useMembers(hotelId);
  const hotel = hotels.find((h) => h.id === hotelId);
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><h2 className="font-display text-2xl font-bold">{hotel?.name ?? "Hotel"}</h2><p className="text-sm text-muted-foreground">Manage manager accounts within your quota.</p></div>
        <StaffDialog roles={["manager"]} label="New manager" />
      </div>
      {hotel && <QuotaCard hotel={hotel} members={members} />}
      <MemberList members={members} roles={["manager", "supervisor", "houseman"]} />
    </div>
  );
}

/* ---------------- Manager ---------------- */
export function ManagerDashboard({ hotelId }: { hotelId: string }) {
  const { data: hotels = [] } = useHotels();
  const { data: members = [] } = useMembers(hotelId);
  const hotel = hotels.find((h) => h.id === hotelId);
  return (
    <Tabs defaultValue="board" className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <TabsList><TabsTrigger value="board">Live board</TabsTrigger><TabsTrigger value="teams">Teams</TabsTrigger><TabsTrigger value="staff">Staff</TabsTrigger></TabsList>
        <StaffDialog roles={["houseman", "supervisor"]} label="New staff" />
      </div>
      <TabsContent value="board"><LiveBoard members={members} title="Live board" subtitle="Updates instantly as housemen check in and out." /></TabsContent>
      <TabsContent value="teams"><TeamsPanel members={members} hotelId={hotelId} /></TabsContent>
      <TabsContent value="staff" className="space-y-4">
        {hotel && <QuotaCard hotel={hotel} members={members} />}
        <MemberList members={members} roles={["supervisor", "houseman"]} />
      </TabsContent>
    </Tabs>
  );
}

function TeamsPanel({ members, hotelId }: { members: Member[]; hotelId: string }) {
  const qc = useQueryClient();
  const { data: teams = [] } = useTeams();
  const supervisors = members.filter((m) => m.role === "supervisor");
  const housemen = members.filter((m) => m.role === "houseman");

  async function setSupervisor(staffId: string, supervisorId: string) {
    const { error } = supervisorId === "none"
      ? await supabase.from("team_members").delete().eq("staff_id", staffId)
      : await supabase.from("team_members").upsert({ staff_id: staffId, supervisor_id: supervisorId, hotel_id: hotelId });
    if (error) toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["teams"] });
  }

  if (!housemen.length) return <p className="rounded-xl border border-dashed p-10 text-center text-muted-foreground">Create houseman accounts first.</p>;
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">Choose which supervisor monitors each houseman.</p>
      <ul className="divide-y rounded-xl border bg-card">
        {housemen.map((h) => (
          <li key={h.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
            <span className="font-medium">{nameOf(h)}</span>
            <Select value={teams.find((t) => t.staff_id === h.id)?.supervisor_id ?? "none"} onValueChange={(v) => setSupervisor(h.id, v)}>
              <SelectTrigger className="w-52"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No supervisor</SelectItem>
                {supervisors.map((s) => <SelectItem key={s.id} value={s.id}>{nameOf(s)}</SelectItem>)}
              </SelectContent>
            </Select>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ---------------- Supervisor ---------------- */
export function SupervisorDashboard({ userId, hotelId }: { userId: string; hotelId: string }) {
  const { data: members = [] } = useMembers(hotelId);
  const { data: teams = [] } = useTeams();
  const team = new Set(teams.filter((t) => t.supervisor_id === userId).map((t) => t.staff_id));
  return (
    <LiveBoard readOnly members={members.filter((m) => team.has(m.id))}
      title="My team" subtitle={`Live monitoring for ${team.size} assigned staff member(s).`} />
  );
}
