import { Link, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Mail, Phone, Linkedin, ExternalLink, Copy, Check, Sparkles, Calendar } from "lucide-react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { distributors as distApi, contactApi, followups } from "@/lib/api";
import { InlineEdit } from "@/components/InlineEdit";
import { initials } from "@/lib/utils";

const STATUS_OPTS = ["NEW", "CONTACTED", "INTERESTED", "QUALIFIED", "MEETING", "PROPOSAL", "NEGOTIATING", "CLOSED_WON", "CLOSED_LOST", "NOT_INTERESTED"];

export function ContactDossierPage() {
  const { id, contactId } = useParams<{ id: string; contactId: string }>();
  const qc = useQueryClient();
  const dist = useQuery({
    queryKey: ["distributor", id],
    queryFn: () => distApi.get(id!),
    enabled: !!id,
  });

  if (dist.isLoading || !dist.data) return (
    <div className="space-y-5 max-w-7xl mx-auto">
      <Skeleton className="h-4 w-40" />
      <div className="grid lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-5"><Skeleton className="h-56" /><Skeleton className="h-32" /></div>
        <Skeleton className="h-72" />
      </div>
    </div>
  );

  const distributor = dist.data;
  const contact = distributor.contacts.find((c) => c.id === contactId);
  if (!contact) return <div className="grid place-items-center py-16"><p className="text-muted-foreground">Contact not found</p></div>;

  const fullName = [contact.firstName, contact.lastName].filter(Boolean).join(" ") || "Unnamed contact";

  async function field(f: string, v: string) {
    if (!id || !contactId) return;
    try {
      await contactApi.updateField(id, contactId, f, v);
      qc.invalidateQueries({ queryKey: ["distributor", id] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  }
  async function setStatus(s: string) {
    if (!id || !contactId) return;
    await contactApi.setStatus(id, contactId, s);
    qc.invalidateQueries({ queryKey: ["distributor", id] });
    toast.success("Status updated");
  }

  return (
    <div className="space-y-5 max-w-7xl mx-auto">
      <Link to={`/distributors/${distributor.id}`} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition">
        <ArrowLeft className="h-3.5 w-3.5" /> {distributor.name}
      </Link>

      <div className="grid lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-5">
          <Card><CardContent className="p-6">
            <div className="flex items-start gap-5">
              <Avatar className="h-20 w-20"><AvatarFallback className="text-xl font-semibold bg-primary/10 text-primary">{initials(fullName)}</AvatarFallback></Avatar>
              <div className="flex-1 min-w-0 space-y-2">
                <h1 className="text-2xl font-semibold tracking-tight">
                  <span className="inline-block"><InlineEdit value={contact.firstName} onSave={(v) => field("firstName", v)} /></span>{" "}
                  <span className="inline-block"><InlineEdit value={contact.lastName} onSave={(v) => field("lastName", v)} /></span>
                </h1>
                <div className="text-muted-foreground">
                  <InlineEdit value={contact.title} onSave={(v) => field("title", v)} placeholder="Add a title…" />
                  <span> · {distributor.name}</span>
                </div>
                {contact.seniority ? <Badge variant="secondary">{contact.seniority}</Badge> : null}
              </div>
            </div>
          </CardContent></Card>

          <Section title="About">
            <div className="text-sm text-foreground/90 leading-relaxed">
              <InlineEdit value={contact.note ?? null} multiline placeholder="Add notes about this contact…" onSave={(v) => field("note", v)} />
            </div>
          </Section>

          <Section title="Related Articles">
            <div className="text-sm text-muted-foreground">
              <p>No articles yet.</p>
              <p className="text-xs mt-1">AI &quot;Find articles&quot; — coming soon.</p>
            </div>
          </Section>
        </div>

        <aside className="space-y-3 lg:sticky lg:top-20 lg:self-start">
          <Card><CardContent className="p-5 space-y-4">
            <ContactInfo label="Email" icon={<Mail className="h-4 w-4" />} value={contact.email} type="email" onSave={(v) => field("email", v)} />
            <Separator />
            <ContactInfo label="Phone" icon={<Phone className="h-4 w-4" />} value={contact.phone} type="tel" onSave={(v) => field("phone", v)} />
            <Separator />
            <ContactInfo label="LinkedIn" icon={<Linkedin className="h-4 w-4" />} value={contact.linkedin} type="url" onSave={(v) => field("linkedin", v)} />
            <Separator />
            <div>
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground/70 mb-1.5 font-medium">Status</div>
              <Select value={contact.status} onValueChange={setStatus}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>{STATUS_OPTS.map((s) => <SelectItem key={s} value={s}>{s.replace(/_/g, " ")}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </CardContent></Card>

          <Card><CardContent className="p-5 space-y-2.5">
            <Button className="w-full"><Sparkles className="h-4 w-4" /> AI message (coming soon)</Button>
            <QuickActionButton
              label="Log call"
              icon={<Phone className="h-4 w-4" />}
              onClick={async () => {
                if (!id || !contactId) return;
                await contactApi.logCall(id, contactId, fullName);
                toast.success("Call logged");
                qc.invalidateQueries({ queryKey: ["distributor", id] });
                qc.invalidateQueries({ queryKey: ["activity", id] });
              }}
            />
            <QuickActionButton
              label="Mark as emailed"
              icon={<Mail className="h-4 w-4" />}
              onClick={async () => {
                if (!id || !contactId) return;
                await contactApi.markEmailed(id, contactId, fullName);
                toast.success("Marked as emailed");
                qc.invalidateQueries({ queryKey: ["distributor", id] });
                qc.invalidateQueries({ queryKey: ["activity", id] });
              }}
            />
            <FollowupDialog distributorId={distributor.id} contactName={fullName} />
          </CardContent></Card>
        </aside>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <Card><CardContent className="p-5"><h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80 mb-3">{title}</h2>{children}</CardContent></Card>;
}

function ContactInfo({ label, icon, value, type, onSave }: { label: string; icon: React.ReactNode; value: string | null; type: "email" | "tel" | "url"; onSave: (v: string) => Promise<void> | void }) {
  const href = value ? (type === "email" ? `mailto:${value}` : type === "tel" ? `tel:${value}` : value.startsWith("http") ? value : `https://${value}`) : null;
  return (
    <div className="group">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground/70 mb-1.5 flex items-center gap-1.5 font-medium">{icon}{label}</div>
      <div className="flex items-center gap-1.5 text-sm">
        <span className="flex-1 min-w-0 truncate"><InlineEdit value={value} onSave={onSave} placeholder={type === "email" ? "Add email…" : type === "tel" ? "Add phone…" : "Add URL…"} /></span>
        {value && href ? (
          <>
            <a href={href} target={type === "url" ? "_blank" : undefined} rel="noreferrer" className="text-muted-foreground/60 hover:text-primary opacity-0 group-hover:opacity-100 transition shrink-0"><ExternalLink className="h-3.5 w-3.5" /></a>
            <CopyBtn text={value} />
          </>
        ) : null}
      </div>
    </div>
  );
}

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => { navigator.clipboard.writeText(text).then(() => { setCopied(true); toast.success("Copied"); setTimeout(() => setCopied(false), 1200); }); }}
      className="text-muted-foreground/60 hover:text-primary opacity-0 group-hover:opacity-100 transition"
    >
      {copied ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}

function QuickActionButton({ label, icon, onClick }: { label: string; icon: React.ReactNode; onClick: () => Promise<void> }) {
  const [pending, setPending] = useState(false);
  return (
    <Button variant="outline" className="w-full" disabled={pending} onClick={() => { setPending(true); onClick().catch((e) => toast.error(e instanceof Error ? e.message : "Failed")).finally(() => setPending(false)); }}>
      {icon} {label}
    </Button>
  );
}

function FollowupDialog({ distributorId, contactName }: { distributorId: string; contactName: string }) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const tomorrow = new Date(Date.now() + 24 * 3600_000).toISOString().slice(0, 10);
  const qc = useQueryClient();

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    try {
      const fd = new FormData(e.currentTarget);
      const when = String(fd.get("when") ?? "");
      await followups.schedule(distributorId, contactName, when);
      toast.success(`Follow-up scheduled for ${when}`);
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["distributor", distributorId] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally { setPending(false); }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button variant="outline" className="w-full"><Calendar className="h-4 w-4" /> Schedule follow-up</Button></DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader><DialogTitle>Schedule follow-up</DialogTitle><DialogDescription>Logs a reminder note on this distributor.</DialogDescription></DialogHeader>
        <form onSubmit={onSubmit} className="space-y-3">
          <div className="space-y-1.5"><Label htmlFor="when">Date</Label><Input id="when" name="when" type="date" defaultValue={tomorrow} required /></div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={pending}>Cancel</Button>
            <Button type="submit" disabled={pending}>Schedule</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
