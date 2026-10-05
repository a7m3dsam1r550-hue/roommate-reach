import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { BedDouble, Clock, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "RoomRound — Housekeeping & Houseman Tracking" },
      { name: "description", content: "Assign rooms, track check-in/out times and guest counts live." },
      { property: "og:title", content: "RoomRound — Housekeeping & Houseman Tracking" },
      { property: "og:description", content: "Assign rooms, track check-in/out times and guest counts live." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Index,
});

function Index() {
  const navigate = useNavigate();
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/app", replace: true });
    });
  }, [navigate]);

  return (
    <main className="min-h-screen bg-hero text-hero-foreground flex flex-col">
      <div className="mx-auto w-full max-w-5xl px-6 py-6 flex items-center justify-between">
        <span className="font-display text-xl font-bold tracking-tight">RoomRound</span>
        <Button asChild variant="brass" size="sm"><Link to="/auth">Sign in</Link></Button>
      </div>
      <section className="mx-auto w-full max-w-5xl px-6 flex-1 flex flex-col justify-center py-16">
        <p className="text-brass uppercase tracking-[0.25em] text-xs font-semibold">Housekeeping operations</p>
        <h1 className="font-display mt-4 text-4xl sm:text-6xl font-bold leading-[1.05] max-w-3xl">
          Every room, every minute, accounted for.
        </h1>
        <p className="mt-6 max-w-xl text-hero-foreground/75 text-lg">
          Managers assign rooms. Housemen tap in and out. The live board shows status, time spent and guest counts as it happens.
        </p>
        <div className="mt-10"><Button asChild variant="brass" size="lg"><Link to="/auth">Open the board</Link></Button></div>
        <div className="mt-16 grid gap-4 sm:grid-cols-3">
          {[
            { icon: BedDouble, t: "Daily assignments", d: "Room numbers per houseman, per day." },
            { icon: Clock, t: "Auto timestamps", d: "Check-in, check-out and duration recorded." },
            { icon: Users, t: "Guest counts", d: "Morning and evening counts per room." },
          ].map(({ icon: Icon, t, d }) => (
            <div key={t} className="rounded-xl border border-hero-foreground/15 p-5">
              <Icon className="h-5 w-5 text-brass" />
              <h3 className="mt-3 font-semibold">{t}</h3>
              <p className="text-sm text-hero-foreground/70 mt-1">{d}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
