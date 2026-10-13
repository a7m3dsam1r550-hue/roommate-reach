import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { UserPlus } from "lucide-react";
import { createStaff } from "@/lib/staff.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ROLE_LABEL } from "@/hooks/use-staff";

type CreatableRole = "hotel_admin" | "manager" | "supervisor" | "houseman";

export function StaffDialog({ roles, hotelId, label = "New account", size }: {
  roles: CreatableRole[]; hotelId?: string; label?: string; size?: "sm" | "default";
}) {
  const qc = useQueryClient();
  const create = useServerFn(createStaff);
  const [open, setOpen] = useState(false);
  const blank = { fullName: "", email: "", password: "", role: roles[0] as CreatableRole };
  const [form, setForm] = useState(blank);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (form.password.length < 8) { toast.error("Password must be at least 8 characters"); return; }
    setBusy(true);
    try {
      await create({ data: { ...form, hotelId } });
      toast.success(`Account created for ${form.email}`);
      setForm(blank);
      qc.invalidateQueries({ queryKey: ["members"] });
      setOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create account");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button variant="outline" size={size}><UserPlus className="h-4 w-4" /> {label}</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Create account</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5"><Label>Full name</Label><Input required maxLength={100} value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>Email</Label><Input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>Temporary password</Label><Input required minLength={8} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></div>
          {roles.length > 1 && (
            <div className="space-y-1.5">
              <Label>Role</Label>
              <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v as CreatableRole })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{roles.map((r) => <SelectItem key={r} value={r}>{ROLE_LABEL[r]}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          )}
          <Button type="submit" className="w-full" disabled={busy}>{busy ? "Creating…" : `Create ${ROLE_LABEL[form.role]}`}</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
