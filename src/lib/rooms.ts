export type Assignment = {
  id: string;
  houseman_id: string;
  room_number: string;
  work_date: string;
  morning_guests: number | null;
  evening_guests: number | null;
  started_at: string | null;
  ended_at: string | null;
};

export type Status = "pending" | "in_progress" | "completed";

export function statusOf(a: Assignment): Status {
  if (a.ended_at) return "completed";
  if (a.started_at) return "in_progress";
  return "pending";
}

export const statusLabel: Record<Status, string> = {
  pending: "Pending",
  in_progress: "In Progress",
  completed: "Completed",
};

export function fmtTime(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function durationMs(a: Assignment, now = Date.now()) {
  if (!a.started_at) return 0;
  const end = a.ended_at ? new Date(a.ended_at).getTime() : now;
  return Math.max(0, end - new Date(a.started_at).getTime());
}

export function fmtDuration(ms: number) {
  if (!ms) return "—";
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h ? `${h}h ${m}m` : `${m}m ${String(s).padStart(2, "0")}s`;
}

export function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
