import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { HousemanView } from "@/components/HousemanView";
import { HotelAdminDashboard, ManagerDashboard, SuperAdminDashboard, SupervisorDashboard } from "@/components/Dashboards";
import { ROLE_LABEL } from "@/hooks/use-staff";

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
      const [{ data: role }, { data: profile }] = await Promise.all([
        supabase.from("staff_roles").select("role,hotel_id").eq("user_id", user.id).maybeSingle(),
        supabase.from("profiles").select("full_name,email").eq("id", user.id).maybeSingle(),
      ]);
      let hotelName: string | null = null;
      if (role?.hotel_id) {
        const { data: h } = await supabase.from("hotels").select("name").eq("id", role.hotel_id).maybeSingle();
        hotelName = h?.name ?? null;
      }
      return { role: role?.role ?? null, hotelId: role?.hotel_id ?? null, hotelName, name: profile?.full_name ?? user.email };
    },
  });

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const body = () => {
    if (isLoading || !data) return <p className="text-muted-foreground">Loading…</p>;
    const { role, hotelId } = data;
    if (role === "super_admin") return <SuperAdminDashboard />;
    if (!role || !hotelId) return <p className="text-muted-foreground">Your account has no role yet. Ask your administrator.</p>;
    if (role === "hotel_admin") return <HotelAdminDashboard hotelId={hotelId} />;
    if (role === "manager") return <ManagerDashboard hotelId={hotelId} />;
    if (role === "supervisor") return <SupervisorDashboard userId={user.id} hotelId={hotelId} />;
    return <HousemanView userId={user.id} />;
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-20 bg-hero text-hero-foreground">
        <div className="mx-auto max-w-6xl px-4 h-14 flex items-center justify-between">
          <div className="flex items-baseline gap-3 min-w-0">
            <span className="font-display font-bold text-lg">RoomRound</span>
            {data?.role && <span className="text-xs text-brass uppercase tracking-widest">{ROLE_LABEL[data.role]}</span>}
            {data?.hotelName && <span className="hidden sm:inline text-xs text-hero-foreground/70 truncate">· {data.hotelName}</span>}
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden sm:inline text-sm text-hero-foreground/75">{data?.name}</span>
            <Button variant="ghostHero" size="icon" onClick={signOut} aria-label="Sign out"><LogOut className="h-4 w-4" /></Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">{body()}</main>
    </div>
  );
}
