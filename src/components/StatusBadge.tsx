import { cn } from "@/lib/utils";
import { statusLabel, type Status } from "@/lib/rooms";

const styles: Record<Status, string> = {
  pending: "bg-status-pending/15 text-status-pending",
  in_progress: "bg-status-progress/15 text-status-progress",
  completed: "bg-status-done/15 text-status-done",
};

export function StatusBadge({ status }: { status: Status }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold", styles[status])}>
      <span className={cn("h-1.5 w-1.5 rounded-full bg-current", status === "in_progress" && "animate-pulse")} />
      {statusLabel[status]}
    </span>
  );
}
