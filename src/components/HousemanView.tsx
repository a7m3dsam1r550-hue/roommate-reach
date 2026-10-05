import { useState } from "react";
import { toast } from "sonner";
import { LogIn, LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusBadge } from "@/components/StatusBadge";
import { useAssignments, useNow } from "@/hooks/use-assignments";
import { durationMs, fmtDuration, fmtTime, statusOf, todayISO, type Assignment } from "@/lib/rooms";

export function HousemanView({ userId }: { userId: string }) {
  const date = todayISO();
  const { data = [], isLoading, refetch } = useAssignments(date, userId);
  const now = useNow();
  const done = data.filter((a) => a.ended_at).length;

  return (
    <div>
      <div className="flex items-end justify-between mb-5">
        <div>
          <h1 className="font-display text-2xl font-bold">My rooms</h1>
          <p className="text-sm text-muted-foreground">
            {new Date().toLocaleDateString([], { weekday: "long", day: "numeric", month: "long" })}
          </p>
        </div>
        <span className="text-sm font-semibold">{done}/{data.length} done</span>
      </div>
      {isLoading ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : data.length === 0 ? (
        <div className="rounded-xl border border-dashed p-10 text-center text-muted-foreground">No rooms assigned to you today.</div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.map((a) => <RoomCard key={a.id} a={a} now={now} onChange={refetch} />)}
        </div>
      )}
    </div>
  );
}

function RoomCard({ a, now, onChange }: { a: Assignment; now: number; onChange: () => void }) {
  const status = statusOf(a);
  const [morning, setMorning] = useState(a.morning_guests?.toString() ?? "");
  const [evening, setEvening] = useState(a.evening_guests?.toString() ?? "");
  const [busy, setBusy] = useState(false);

  async function saveCount(field: "morning_guests" | "evening_guests", value: string) {
    const n = value === "" ? null : Number(value);
    if (n !== null && (!Number.isInteger(n) || n < 0 || n > 50)) return toast.error("Guest count must be 0–50");
    if (n === a[field]) return;
    const { error } = await supabase.from("room_assignments").update({ [field]: n }).eq("id", a.id);
    if (error) toast.error(error.message);
    else toast.success("Guest count saved");
  }

  async function act(kind: "in" | "out") {
    setBusy(true);
    const { error } = await supabase.rpc(kind === "in" ? "room_check_in" : "room_check_out", { _id: a.id });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(kind === "in" ? `Entered room ${a.room_number}` : `Exited room ${a.room_number}`);
    onChange();
  }

  return (
    <div className="rounded-2xl border bg-card p-5 shadow-soft">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Room</p>
          <p className="font-display text-4xl font-bold leading-none mt-1">{a.room_number}</p>
        </div>
        <StatusBadge status={status} />
      </div>

      <div className="grid grid-cols-2 gap-3 mt-5">
        <div className="space-y-1">
          <Label htmlFor={`m-${a.id}`} className="text-xs">Morning guests</Label>
          <Input id={`m-${a.id}`} type="number" inputMode="numeric" min={0} max={50} className="h-12 text-lg"
            value={morning} onChange={(e) => setMorning(e.target.value)} onBlur={() => saveCount("morning_guests", morning)} />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`e-${a.id}`} className="text-xs">Evening guests</Label>
          <Input id={`e-${a.id}`} type="number" inputMode="numeric" min={0} max={50} className="h-12 text-lg"
            value={evening} onChange={(e) => setEvening(e.target.value)} onBlur={() => saveCount("evening_guests", evening)} />
        </div>
      </div>

      <dl className="grid grid-cols-3 gap-2 mt-4 text-center rounded-xl bg-muted p-3">
        <div><dt className="text-[10px] uppercase text-muted-foreground">Start</dt><dd className="font-semibold tabular-nums">{fmtTime(a.started_at)}</dd></div>
        <div><dt className="text-[10px] uppercase text-muted-foreground">End</dt><dd className="font-semibold tabular-nums">{fmtTime(a.ended_at)}</dd></div>
        <div><dt className="text-[10px] uppercase text-muted-foreground">Duration</dt><dd className="font-semibold tabular-nums">{fmtDuration(durationMs(a, now))}</dd></div>
      </dl>

      <div className="grid grid-cols-2 gap-3 mt-4">
        <Button size="lg" className="h-14" disabled={busy || status !== "pending"} onClick={() => act("in")}>
          <LogIn className="h-5 w-5" /> Check-in
        </Button>
        <Button size="lg" variant="brass" className="h-14" disabled={busy || status !== "in_progress"} onClick={() => act("out")}>
          <LogOut className="h-5 w-5" /> Check-out
        </Button>
      </div>
    </div>
  );
}
