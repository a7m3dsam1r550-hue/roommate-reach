import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — RoomRound" },
      { name: "description", content: "Staff sign in for RoomRound hotel housekeeping." },
      { property: "og:title", content: "Sign in — RoomRound" },
      { property: "og:description", content: "Staff sign in for RoomRound hotel housekeeping." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

const creds = z.object({
  email: z.string().trim().email("Enter a valid email").max(255),
  password: z.string().min(8, "At least 8 characters").max(72),
});

const SUPER = "__super__";

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "setup">("signin");
  const [noSuper, setNoSuper] = useState(false);
  const [hotels, setHotels] = useState<{ id: string; name: string; code: string }[]>([]);
  const [hotel, setHotel] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/app", replace: true });
    });
    supabase.rpc("super_admin_exists").then(({ data }) => setNoSuper(data === false));
    supabase.rpc("list_hotels").then(({ data }) => setHotels(data ?? []));
  }, [navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = creds.safeParse({ email, password });
    if (!parsed.success) { toast.error(parsed.error.issues[0]?.message ?? "Invalid input"); return; }
    if (mode === "signin" && !hotel) { toast.error("Select your hotel"); return; }
    setBusy(true);
    if (mode === "signin") {
      const { data, error } = await supabase.auth.signInWithPassword(parsed.data);
      if (error || !data.user) { setBusy(false); toast.error(error?.message ?? "Sign in failed"); return; }
      const { data: role } = await supabase.from("staff_roles").select("role,hotel_id").eq("user_id", data.user.id).maybeSingle();
      const ok = role && (hotel === SUPER ? role.role === "super_admin" : role.hotel_id === hotel);
      setBusy(false);
      if (!ok) {
        await supabase.auth.signOut();
        toast.error("This account does not belong to the selected hotel");
        return;
      }
      navigate({ to: "/app", replace: true });
    } else {
      const { data, error } = await supabase.auth.signUp({
        ...parsed.data,
        options: { emailRedirectTo: window.location.origin, data: { full_name: name.trim() || undefined } },
      });
      setBusy(false);
      if (error) { toast.error(error.message); return; }
      if (data.session) navigate({ to: "/app", replace: true });
      else toast.success("Account created — you can sign in now.");
    }
  }

  return (
    <main className="min-h-screen bg-hero flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm rounded-2xl bg-card p-7 shadow-elevated">
        <h1 className="font-display text-2xl font-bold">{mode === "signin" ? "Staff sign in" : "Create Super Admin"}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {mode === "signin" ? "Select your hotel, then use the email you were given." : "The first account controls all hotels."}
        </p>
        <form onSubmit={submit} className="mt-6 space-y-4">
          {mode === "signin" ? (
            <div className="space-y-1.5">
              <Label>Hotel</Label>
              <Select value={hotel} onValueChange={setHotel}>
                <SelectTrigger><SelectValue placeholder="Select hotel" /></SelectTrigger>
                <SelectContent>
                  {hotels.map((h) => <SelectItem key={h.id} value={h.id}>{h.name} ({h.code})</SelectItem>)}
                  <SelectItem value={SUPER}>Super Admin (no hotel)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label htmlFor="name">Full name</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} maxLength={100} />
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" autoComplete={mode === "signin" ? "current-password" : "new-password"} value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <Button type="submit" className="w-full" size="lg" disabled={busy}>
            {busy ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
          </Button>
        </form>
        {noSuper && (
          <button className="mt-5 text-sm text-primary underline-offset-4 hover:underline w-full" onClick={() => setMode(mode === "signin" ? "setup" : "signin")}>
            {mode === "signin" ? "First time? Set up the Super Admin account" : "Back to sign in"}
          </button>
        )}
      </div>
    </main>
  );
}
