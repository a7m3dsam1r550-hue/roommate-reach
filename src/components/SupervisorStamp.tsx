import { BadgeCheck } from "lucide-react";
import type { ShiftStamp } from "@/hooks/use-shift-stamps";
import { cn } from "@/lib/utils";

export function SupervisorStamp({ stamp, compact = false }: { stamp: ShiftStamp; compact?: boolean }) {
  return (
    <div role="status" aria-label="Official supervisor clearance" className={cn(
      "flex items-start gap-3 rounded-lg border-2 border-status-done bg-status-done/10 text-foreground",
      compact ? "p-3" : "p-5 mb-6",
    )}>
      <BadgeCheck aria-hidden="true" className={cn("shrink-0 text-status-done", compact ? "h-6 w-6" : "h-10 w-10")} />
      <div className="min-w-0 space-y-1 break-words">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Official supervisor stamp</p>
        <p className={cn("font-display font-bold text-status-done", compact ? "text-sm" : "text-lg")}>{stamp.verification_status}</p>
        <p className="text-sm font-semibold">Approved by Supervisor: {stamp.supervisor_name}</p>
        <p className="text-xs text-muted-foreground">
          <time dateTime={stamp.approved_at}>{new Date(stamp.approved_at).toLocaleString([], { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit", timeZoneName: "short" })}</time>
        </p>
        <p className="text-xs text-muted-foreground">Shift: {stamp.work_date}</p>
      </div>
    </div>
  );
}