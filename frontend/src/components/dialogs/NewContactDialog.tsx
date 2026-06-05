import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Loader2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { contactApi } from "@/lib/api";

export function NewContactDialog({ distributorId, distributorName }: { distributorId: string; distributorName: string }) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const navigate = useNavigate();
  const qc = useQueryClient();

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    try {
      const fd = new FormData(e.currentTarget);
      const { id } = await contactApi.create(distributorId, {
        firstName: String(fd.get("firstName") ?? ""),
        lastName: String(fd.get("lastName") ?? ""),
        title: String(fd.get("title") ?? ""),
        email: String(fd.get("email") ?? ""),
        phone: String(fd.get("phone") ?? ""),
        linkedin: String(fd.get("linkedin") ?? ""),
      });
      toast.success("Contact created");
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["distributor", distributorId] });
      navigate(`/distributors/${distributorId}/contacts/${id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally { setPending(false); }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4" /> Add contact</Button></DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New contact</DialogTitle>
          <DialogDescription>Add a person at <span className="font-medium text-foreground">{distributorName}</span>.</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label htmlFor="c-firstName">First name</Label><Input id="c-firstName" name="firstName" autoFocus /></div>
            <div className="space-y-1.5"><Label htmlFor="c-lastName">Last name</Label><Input id="c-lastName" name="lastName" /></div>
          </div>
          <div className="space-y-1.5"><Label htmlFor="c-title">Title</Label><Input id="c-title" name="title" placeholder="VP of Sales" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label htmlFor="c-email">Email</Label><Input id="c-email" name="email" type="email" /></div>
            <div className="space-y-1.5"><Label htmlFor="c-phone">Phone</Label><Input id="c-phone" name="phone" /></div>
          </div>
          <div className="space-y-1.5"><Label htmlFor="c-linkedin">LinkedIn URL</Label><Input id="c-linkedin" name="linkedin" /></div>
          <p className="text-xs text-muted-foreground">At least one of name or email is required.</p>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={pending}>Cancel</Button>
            <Button type="submit" disabled={pending}>{pending ? <><Loader2 className="h-4 w-4 animate-spin" /> Creating…</> : "Create"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
