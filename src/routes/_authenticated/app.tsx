import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { AdminDashboard } from "@/components/AdminDashboard";
import { HousemanView } from "@/components/HousemanView";

export const Route = createFileRoute("/_authenticated/app")({
  head: () => ({
    meta: [
      { title: "Board — RoomRound" },
      { name: "description", content: "Your RoomRound housekeeping board." },
      { property: "og:title", content: "Board — RoomRound" },
      { property: "og:description", content: "Your RoomRound housekeeping board." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AppPage,
});

function AppPage() {
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["me", user.id],
    queryFn: async () => {
      const [{ data: roles }, { data: profile }] = await Promise.all([
        supabase.from("user_roles").select("role").eq("user_id", user.id),
        supabase.from("profiles").select("full_name,email").eq("id", user.id).maybeSingle(),
      ]);
      return { isAdmin: !!roles?.some((r) => r.role === "admin"), name: profile?.full_name ?? user.email };
    },
  });

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-20 bg-hero text-hero-foreground">
        <div className="mx-auto max-w-6xl px-4 h-14 flex items-center justify-between">
          <div className="flex items-baseline gap-3">
            <span className="font-display font-bold text-lg">RoomRound</span>
            {data && <span className="text-xs text-brass uppercase tracking-widest">{data.isAdmin ? "Manager" : "Houseman"}</span>}
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden sm:inline text-sm text-hero-foreground/75">{data?.name}</span>
            <Button variant="ghostHero" size="icon" onClick={signOut} aria-label="Sign out"><LogOut className="h-4 w-4" /></Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">
        {isLoading || !data ? (
          <p className="text-muted-foreground">Loading…</p>
        ) : data.isAdmin ? (
          <AdminDashboard />
        ) : (
          <HousemanView userId={user.id} />
        )}
      </main>
    </div>
  );
}
