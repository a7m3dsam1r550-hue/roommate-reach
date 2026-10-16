import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ClipboardList } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function useWeeklyTasks(hotelId?: string | null) {
  return useQuery({
    queryKey: ["weekly_tasks", hotelId ?? "mine"],
    queryFn: async () => {
      let q = supabase.from("weekly_tasks").select("weekday,body");
      if (hotelId) q = q.eq("hotel_id", hotelId);
      const { data, error } = await q;
      if (error) throw error;
      return data as { weekday: number; body: string }[];
    },
  });
}

export function WeeklyTasksEditor({ hotelId }: { hotelId: string }) {
  const qc = useQueryClient();
  const { data = [] } = useWeeklyTasks(hotelId);
  const [draft, setDraft] = useState<string[]>(Array(7).fill(""));
  const [busy, setBusy] = useState<number | null>(null);

  useEffect(() => {
    const d = Array(7).fill("");
    data.forEach((t) => { d[t.weekday] = t.body; });
    setDraft(d);
  }, [data]);

  async function save(day: number) {
    const body = (draft[day] ?? "").trim().slice(0, 2000);
    setBusy(day);
    const { error } = await supabase.from("weekly_tasks")
      .upsert({ hotel_id: hotelId, weekday: day, body, updated_at: new Date().toISOString() }, { onConflict: "hotel_id,weekday" });
    setBusy(null);
    if (error) { toast.error(error.message); return; }
    toast.success(`${DAYS[day]} tasks saved`);
    qc.invalidateQueries({ queryKey: ["weekly_tasks"] });
  }

  const today = new Date().getDay();
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">Set the tasks for each day. Today's tasks appear automatically on supervisor and staff screens.</p>
      <div className="grid gap-3 md:grid-cols-2">
        {DAYS.map((name, i) => (
          <div key={name} className={`rounded-xl border bg-card p-4 space-y-2 ${i === today ? "border-primary" : ""}`}>
            <div className="flex items-center justify-between">
              <p className="font-semibold">{name}{i === today && <span className="ml-2 text-xs text-primary">Today</span>}</p>
              <Button size="sm" variant="outline" disabled={busy === i} onClick={() => save(i)}>{busy === i ? "Saving…" : "Save"}</Button>
            </div>
            <Textarea rows={3} maxLength={2000} placeholder="e.g. Deep-clean balconies, restock minibars"
              value={draft[i]} onChange={(e) => setDraft((d) => d.map((v, j) => (j === i ? e.target.value : v)))} />
          </div>
        ))}
      </div>
    </div>
  );
}

export function TodayTask() {
  const { data = [] } = useWeeklyTasks();
  const today = new Date().getDay();
  const body = data.find((t) => t.weekday === today)?.body?.trim();
  if (!body) return null;
  return (
    <div className="mb-5 rounded-xl border border-primary/40 bg-primary/5 p-4 flex gap-3">
      <ClipboardList className="h-5 w-5 text-primary shrink-0 mt-0.5" />
      <div>
        <p className="text-xs uppercase tracking-wider text-muted-foreground">{DAYS[today]}'s tasks</p>
        <p className="text-sm whitespace-pre-wrap">{body}</p>
      </div>
    </div>
  );
}
