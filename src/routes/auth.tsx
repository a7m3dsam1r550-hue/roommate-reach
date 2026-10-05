import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — RoomRound" },
      { name: "description", content: "Staff sign in for RoomRound housekeeping." },
      { property: "og:title", content: "Sign in — RoomRound" },
      { property: "og:description", content: "Staff sign in for RoomRound housekeeping." },
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

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "setup">("signin");
  const [noAdmin, setNoAdmin] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/app", replace: true });
    });
    supabase.rpc("admin_exists").then(({ data }) => setNoAdmin(data === false));
  }, [navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = creds.safeParse({ email, password });
    if (!parsed.success) { toast.error(parsed.error.issues[0]?.message ?? "Invalid input"); return; }
    setBusy(true);
    if (mode === "signin") {
      const { error } = await supabase.auth.signInWithPassword(parsed.data);
      setBusy(false);
      if (error) { toast.error(error.message); return; }
      navigate({ to: "/app", replace: true });
    } else {
      const { data, error } = await supabase.auth.signUp({
        ...parsed.data,
        options: { emailRedirectTo: window.location.origin, data: { full_name: name.trim() || undefined } },
      });
      setBusy(false);
      if (error) { toast.error(error.message); return; }
      if (data.session) navigate({ to: "/app", replace: true });
      else toast.success("Check your email to confirm your manager account.");
    }
  }

  return (
    <main className="min-h-screen bg-hero flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm rounded-2xl bg-card p-7 shadow-elevated">
        <h1 className="font-display text-2xl font-bold">{mode === "signin" ? "Staff sign in" : "Create manager account"}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {mode === "signin" ? "Use the email your manager gave you." : "The first account becomes the manager."}
        </p>
        <form onSubmit={submit} className="mt-6 space-y-4">
          {mode === "setup" && (
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
        {noAdmin && (
          <button className="mt-5 text-sm text-primary underline-offset-4 hover:underline w-full" onClick={() => setMode(mode === "signin" ? "setup" : "signin")}>
            {mode === "signin" ? "First time? Set up the manager account" : "Back to sign in"}
          </button>
        )}
      </div>
    </main>
  );
}
