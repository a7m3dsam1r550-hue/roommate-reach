import { BadgeCheck, Calendar, Clock, ShieldCheck } from "lucide-react";
import type { ShiftStamp } from "@/hooks/use-shift-stamps";
import { cn } from "@/lib/utils";

type Summary = { rooms?: unknown[] };
const roomCount = (stamp: ShiftStamp): number | null => {
  const s = stamp.summary as Summary | null;
  const arr = s?.rooms;
  return Array.isArray(arr) ? arr.length : null;
};

const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString([], { weekday: "long", year: "numeric", month: "long", day: "numeric" });

export function SupervisorStamp({ stamp, compact = false }: { stamp: ShiftStamp; compact?: boolean }) {
  const rooms = roomCount(stamp);
  const approved = stamp.verification_status === "APPROVED & CLEARED";

  if (compact) {
    return (
      <div role="status" aria-label="Official supervisor clearance" className="flex items-start gap-2 rounded-lg border-2 border-status-done bg-status-done/10 p-3 text-foreground">
        <BadgeCheck aria-hidden="true" className="shrink-0 h-6 w-6 text-status-done" />
        <div className="min-w-0 space-y-0.5 break-words">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Supervisor stamp</p>
          <p className="font-display text-sm font-bold text-status-done">{stamp.verification_status}</p>
          <p className="text-xs font-semibold">Approved by {stamp.supervisor_name}</p>
          <p className="text-xs text-muted-foreground">{fmtDate(stamp.approved_at)} · {fmtTime(stamp.approved_at)}</p>
        </div>
      </div>
    );
  }

  return (
    <div
      role="status"
      aria-label="Official supervisor clearance covering all assigned rooms"
      className={cn(
        "relative overflow-hidden rounded-2xl border-2 border-status-done bg-gradient-to-br from-status-done/15 via-status-done/5 to-transparent shadow-soft",
        "mb-6",
      )}
    >
      {/* Top accent bar */}
      <div className="h-1.5 w-full bg-status-done" aria-hidden="true" />

      <div className="flex flex-col gap-5 p-6 sm:flex-row sm:items-center sm:gap-6">
        {/* Seal */}
        <div className="relative shrink-0">
          <div className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-status-done bg-status-done/15 sm:h-20 sm:w-20">
            <ShieldCheck aria-hidden="true" className="h-8 w-8 text-status-done sm:h-10 sm:w-10" />
          </div>
          {approved && (
            <span className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 rounded-full bg-status-done px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white shadow-soft whitespace-nowrap">
              Verified
            </span>
          )}
        </div>

        {/* Body */}
        <div className="min-w-0 flex-1 space-y-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-status-done">Official Supervisor Stamp</p>
              {rooms != null && (
                <span className="rounded-full bg-status-done/15 px-2.5 py-0.5 text-xs font-bold text-status-done">
                  {rooms} {rooms === 1 ? "room" : "rooms"} covered
                </span>
              )}
            </div>
            <p className="font-display text-2xl font-bold leading-tight text-status-done sm:text-3xl">
              {stamp.verification_status}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
            <span className="flex items-center gap-2 font-semibold">
              <BadgeCheck className="h-4 w-4 text-status-done" aria-hidden="true" />
              {stamp.supervisor_name}
            </span>
            <span className="flex items-center gap-2 text-muted-foreground">
              <Calendar className="h-4 w-4" aria-hidden="true" />
              <time dateTime={stamp.approved_at}>{fmtDate(stamp.approved_at)}</time>
            </span>
            <span className="flex items-center gap-2 text-muted-foreground">
              <Clock className="h-4 w-4" aria-hidden="true" />
              <time dateTime={stamp.approved_at}>{fmtTime(stamp.approved_at)}</time>
            </span>
          </div>

          <p className="text-xs text-muted-foreground">
            This clearance covers all rooms assigned to this houseman for shift {stamp.work_date}.
          </p>
        </div>
      </div>
    </div>
  );
}
