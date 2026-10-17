import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Ban } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/StatusBadge";
import { TodayTask } from "@/components/WeeklyTasks";
import { useAssignments } from "@/hooks/use-assignments";
import { useShiftStamps } from "@/hooks/use-shift-stamps";
import { SupervisorStamp } from "@/components/SupervisorStamp";
import { SKIP_CODES, codeLabel, statusOf, todayISO } from "@/lib/rooms";
import { cn } from "@/lib/utils";

type Filter = "all" | "pending" | "completed";

export function HousemanView({ userId }: { userId: string }) {
  const date = todayISO();
  const { data = [], isLoading } = useAssignments(date, userId);
  const { data: stamps = [] } = useShiftStamps(date);
  const myStamp = stamps.find((s) => s.houseman_id === userId);
  const [filter, setFilter] = useState<Filter>("all");
  const done = data.filter((a) => a.ended_at).length;
  const shown = data.filter((a) => filter === "all" || (filter === "completed" ? statusOf(a) === "completed" : statusOf(a) === "pending"));
  const skipped = data.filter((a) => !a.started_at && a.room_status && SKIP_CODES.includes(a.room_status));

  return (
    <div>
      <TodayTask />
      {myStamp && <SupervisorStamp stamp={myStamp} />}
      <div className="flex items-end justify-between mb-4">
        <div>
          <h1 className="font-display text-2xl font-bold">My rooms</h1>
          <p className="text-sm text-muted-foreground">
            {new Date().toLocaleDateString([], { weekday: "long", day: "numeric", month: "long" })}
          </p>
        </div>
        <span className="text-sm font-semibold">{done}/{data.length} done</span>
      </div>

      <div className="flex gap-2 mb-4">
        {(["all", "pending", "completed"] as Filter[]).map((f) => (
          <Button key={f} size="sm" variant={filter === f ? "default" : "outline"} onClick={() => setFilter(f)}>
            {f === "all" ? "All" : f === "pending" ? "Pending Rooms" : "Completed Rooms"}
          </Button>
        ))}
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : data.length === 0 ? (
        <div className="rounded-xl border border-dashed p-10 text-center text-muted-foreground">No rooms assigned to you today.</div>
      ) : (
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
          {shown.map((a) => {
            const s = statusOf(a);
            return (
              <Link key={a.id} to="/room/$id" params={{ id: a.id }}
                className={cn("rounded-2xl border bg-card p-3 shadow-soft hover:border-primary transition-colors flex flex-col gap-2",
                  s === "in_progress" && "border-status-progress", s === "completed" && "opacity-80")}>
                <span className="font-display text-3xl font-bold leading-none">{a.room_number}</span>
                {a.room_status && <span className="text-xs font-semibold text-brass">{a.room_status}</span>}
                <StatusBadge status={s} />
              </Link>
            );
          })}
          {shown.length === 0 && <p className="col-span-full text-sm text-muted-foreground">No rooms in this filter.</p>}
        </div>
      )}

      {skipped.length > 0 && (
        <section className="mt-8">
          <h2 className="font-display text-lg font-bold flex items-center gap-2 mb-3"><Ban className="h-4 w-4" /> Not accessed</h2>
          <ul className="divide-y rounded-xl border bg-card">
            {skipped.map((a) => (
              <li key={a.id}>
                <Link to="/room/$id" params={{ id: a.id }} className="flex items-center justify-between px-4 py-3 hover:bg-muted">
                  <span className="font-semibold">Room {a.room_number}</span>
                  <span className="text-sm"><b>{a.room_status}</b> <span className="text-muted-foreground">· {codeLabel(a.room_status)}</span></span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
