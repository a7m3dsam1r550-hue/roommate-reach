import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useNotes, useSessions } from "@/hooks/use-hotel-data";
import { fmtDuration, durationMs, fmtTime, roomStatusLabel, statusLabel, statusOf } from "@/lib/rooms";

export const Route = createFileRoute("/_authenticated/room/$id")({
  head: () => ({
    meta: [
      { title: "Room detail — RoomRound" },
      { name: "description", content: "Room history, sessions and notes." },
      { property: "og:title", content: "Room detail — RoomRound" },
      { property: "og:description", content: "Room history, sessions and notes." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RoomPage,
});

function RoomPage() {
  const { id } = Route.useParams();
  const { data: room } = useQuery({
    queryKey: ["room", id],
    queryFn: async () => (await supabase.from("room_assignments").select("*").eq("id", id).maybeSingle()).data,
  });
  const { data: sessions = [] } = useSessions([id]);
  const { data: notes = [] } = useNotes([id]);
  if (!room) return <p className="p-6 text-muted-foreground">Loading…</p>;
  return (
    <main className="mx-auto max-w-3xl px-4 py-6 space-y-5">
      <Link to="/app" className="text-sm text-muted-foreground">← Back</Link>
      <h1 className="font-display text-4xl font-bold">Room {room.room_number}</h1>
      <p className="text-sm">{statusLabel[statusOf(room)]} · {roomStatusLabel(room.room_status)} · AM {room.morning_guests ?? "—"} / PM {room.evening_guests ?? "—"}</p>
      <section className="rounded-xl border bg-card divide-y">
        {sessions.length === 0 && <p className="p-4 text-sm text-muted-foreground">No check-ins yet.</p>}
        {sessions.map((s) => (
          <p key={s.id} className="p-3 text-sm">{fmtTime(s.started_at)} → {fmtTime(s.ended_at)} · {fmtDuration(durationMs(s))}{s.note ? ` · ${s.note}` : ""}</p>
        ))}
      </section>
      <section className="rounded-xl border bg-card divide-y">
        {notes.length === 0 && <p className="p-4 text-sm text-muted-foreground">No notes.</p>}
        {notes.map((n) => (
          <p key={n.id} className={`p-3 text-sm ${n.is_maintenance ? "text-destructive" : ""}`}>{fmtTime(n.created_at)} · {n.body}</p>
        ))}
      </section>
    </main>
  );
}
