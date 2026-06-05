import { useEffect, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Sparkles, Loader2, AlertTriangle, ExternalLink, Clock, Activity, Users, FileText, BadgeCheck, Mail, Copy, Check, Pencil, X, History, Save, Eye, Code, GitCompare, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EmailRenderer } from "@/components/EmailRenderer";
import { EmailDiffView } from "@/components/EmailDiffView";
import { research, outreach } from "@/lib/api";
import { fmt } from "@/lib/utils";
import type { IntelPackage, ResearchRun, ResearchEmail } from "@/lib/api";

// Run progress banner — shown at the top of the page while pipeline executes.
export function RunProgressBanner({ run }: { run: ResearchRun }) {
  return (
    <Card className="border-primary/40 bg-primary/5">
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0" />
            <div className="min-w-0">
              <div className="text-sm font-medium">Running intelligence pipeline…</div>
              <div className="text-xs text-muted-foreground capitalize">phase: {run.currentPhase} · {run.progressPct}%</div>
            </div>
          </div>
          <Badge variant="outline">run #{run.id}</Badge>
        </div>
        <div className="mt-3 h-1.5 bg-muted rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-primary/70 to-primary transition-all" style={{ width: `${run.progressPct}%` }} />
        </div>
      </CardContent>
    </Card>
  );
}

// Empty state — shown when no intel yet.
export function IntelEmptyState() {
  return (
    <Card>
      <CardContent className="p-12 text-center space-y-3">
        <Sparkles className="h-10 w-10 text-muted-foreground/40 mx-auto" />
        <div>
          <p className="font-medium">No intel yet</p>
          <p className="text-xs text-muted-foreground mt-1">
            Generate an AI dossier with company facts, decision-makers,
            articles, and a leadership org chart with family members highlighted.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

// Top-right Generate button — only shown when intel has NOT been collected.
// Once a Regenerate run has produced data, the button disappears entirely so
// the dossier can't be accidentally overwritten. (A future "force regenerate"
// flow can go in a settings menu if/when needed.)
export function IntelGenerateButton({ distributorId, defaultUrl, hasIntel, isRunning }: { distributorId: string; defaultUrl?: string | null; hasIntel: boolean; isRunning?: boolean }) {
  const qc = useQueryClient();
  if (hasIntel) {
    // Show a small "AI generated" pill instead of the button so the user
    // knows the dossier is from the AI pipeline.
    return (
      <span className="inline-flex items-center gap-1.5 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-2 py-1 text-[11px] font-medium text-emerald-300">
        <Sparkles className="h-3 w-3" />
        AI generated
      </span>
    );
  }
  return (
    <GenerateDialog
      defaultUrl={defaultUrl}
      distributorId={distributorId}
      regenerate={false}
      isRunning={!!isRunning}
      onSubmitted={() => {
        qc.invalidateQueries({ queryKey: ["intel", distributorId] });
        qc.invalidateQueries({ queryKey: ["family-tree", distributorId] });
      }}
    />
  );
}

export function OverviewTab({ intel }: { intel: NonNullable<import("@/lib/api").IntelPackage["intel"]> }) {
  const brands = Array.isArray(intel.brands_json) ? intel.brands_json : [];
  return (
    <>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <StatTile label="Founded" value={intel.founded_year ?? "—"} />
        <StatTile label="Employees" value={intel.employee_count ? fmt(intel.employee_count) : "—"} />
        <StatTile label="Stores" value={intel.account_count ? fmt(intel.account_count) : "—"} />
        <StatTile label="Tier · Score" value={`${intel.tier ?? "—"} · ${intel.score ?? "—"}`} highlight={intel.tier === "A"} />
      </div>
      <Card>
        <CardContent className="p-5">
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80 mb-2">Summary</h3>
          <p className="text-sm leading-relaxed text-foreground/90">{intel.summary}</p>
        </CardContent>
      </Card>
      {intel.founding_moment ? (
        <Card>
          <CardContent className="p-5">
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80 mb-2">Founding moment</h3>
            <p className="text-sm leading-relaxed text-foreground/80 italic">{intel.founding_moment}</p>
          </CardContent>
        </Card>
      ) : null}
      {brands.length > 0 ? (
        <Card>
          <CardContent className="p-5">
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80 mb-2">Top brands</h3>
            <div className="flex flex-wrap gap-1.5">
              {brands.map((b) => <Badge key={b} variant="secondary">{b}</Badge>)}
            </div>
          </CardContent>
        </Card>
      ) : null}
    </>
  );
}

function StatTile({ label, value, highlight }: { label: string; value: string | number; highlight?: boolean }) {
  return (
    <Card className={highlight ? "border-primary/40 bg-primary/5" : ""}>
      <CardContent className="p-4">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground/80">{label}</div>
        <div className={`text-2xl font-semibold tabular-nums mt-1 ${highlight ? "text-primary" : ""}`}>{value}</div>
      </CardContent>
    </Card>
  );
}

export function SourcesPanel({ articles, facts }: { articles: import("@/lib/api").IntelPackage["articles"]; facts: import("@/lib/api").IntelPackage["facts"] }) {
  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80 mb-2">Articles</h3>
        <div className="space-y-2">
          {articles.length === 0 ? (
            <p className="text-sm text-muted-foreground">No articles indexed.</p>
          ) : articles.map((a) => (
            <Card key={a.id}><CardContent className="p-4">
              <div className="flex items-start gap-2">
                <div className="flex-1 min-w-0">
                  <a href={a.url} target="_blank" rel="noreferrer" className="font-medium hover:text-primary inline-flex items-center gap-1.5 group">
                    {a.title} <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 transition" />
                  </a>
                  <p className="text-xs text-muted-foreground mt-0.5">{a.outlet} · {a.publication_date} · {a.article_type}</p>
                  {a.snippet ? <p className="text-sm text-foreground/80 mt-2">{a.snippet}</p> : null}
                  {a.key_quote ? <blockquote className="border-l-2 border-primary/40 pl-3 mt-2 text-sm italic text-foreground/70">{a.key_quote}</blockquote> : null}
                </div>
                {a.relevance != null ? <Badge variant="outline" className="text-xs">{(a.relevance * 100).toFixed(0)}% rel</Badge> : null}
              </div>
            </CardContent></Card>
          ))}
        </div>
      </div>
      {facts.length > 0 ? (
      <div>
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80 mb-2">Validated facts</h3>
        <div className="space-y-2">
          {facts.map((f) => (
            <Card key={f.id}><CardContent className="p-3">
              <div className="flex items-center gap-2 text-sm">
                <span className="font-medium">{f.subject}</span>
                <span className="text-muted-foreground">{f.predicate}</span>
                <span className="font-medium">{f.object}</span>
                {f.validated ? <Badge variant="outline" className="ml-auto text-xs">validated</Badge> : null}
              </div>
              {f.verbatim_quote ? <p className="text-xs text-muted-foreground italic mt-1">{f.verbatim_quote}</p> : null}
            </CardContent></Card>
          ))}
        </div>
      </div>
      ) : null}
    </div>
  );
}

export function FlagsPanel({ flags }: { flags: import("@/lib/api").IntelPackage["flags"] }) {
  if (flags.length === 0) {
    return (
      <Card><CardContent className="p-12 text-center space-y-2">
        <div className="h-10 w-10 rounded-full bg-emerald-500/10 grid place-items-center text-emerald-500 mx-auto">
          ✓
        </div>
        <p className="text-sm text-muted-foreground">No red flags detected.</p>
      </CardContent></Card>
    );
  }
  return (
    <div className="space-y-2">
      {flags.map((f) => (
        <Card key={f.id} className="border-rose-500/30 bg-rose-500/5">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-4 w-4 text-rose-400 mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant="outline" className="text-xs uppercase border-rose-500/40 text-rose-400">{f.severity}</Badge>
                  <span className="text-xs text-muted-foreground">{f.flag_type}</span>
                </div>
                <p className="text-sm">{f.description}</p>
                {f.source_url ? <a href={f.source_url} target="_blank" rel="noreferrer" className="text-xs text-primary inline-flex items-center gap-1 mt-1 hover:underline">source <ExternalLink className="h-3 w-3" /></a> : null}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// Agent Stats — pipeline run telemetry (runtime, phase progression, output counts).
export function AgentStatsTab({ data }: { data: IntelPackage }) {
  const run = data.latestRun;
  if (!run) {
    return (
      <Card>
        <CardContent className="p-12 text-center space-y-2">
          <Activity className="h-10 w-10 text-muted-foreground/40 mx-auto" />
          <p className="text-sm text-muted-foreground">No pipeline runs yet — click <em>Generate</em> to start one.</p>
        </CardContent>
      </Card>
    );
  }
  const ranAt = run.completedAt ? new Date(run.completedAt) : new Date(run.startedAt);
  const fmtSec = (s: number | null | undefined) => s == null ? "—" : s < 60 ? `${s.toFixed(0)}s` : `${Math.floor(s / 60)}m ${(s % 60).toFixed(0)}s`;
  const peopleWithPhotos = data.people.filter((p) => p.photoUrl).length;
  const peopleWithLinkedin = data.people.filter((p) => p.linkedinUrl).length;
  const decisionMakers = data.people.filter((p) => p.isDecisionMaker).length;
  const familyMembers = data.people.filter((p) => p.generation != null).length;

  const fmtUsd = (n: number | null | undefined) => n == null ? "—" : `$${n.toFixed(2)}`;
  return (
    <div className="space-y-3">
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <StatTile label="Run #" value={`#${run.id}`} />
        <StatTile label="Status" value={run.status} highlight={run.status === "done"} />
        <StatTile label="Phase" value={run.currentPhase} />
        <StatTile label="Runtime" value={fmtSec(run.runtimeSeconds)} />
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <StatTile label="Total cost" value={fmtUsd(run.costUsd)} highlight />
        <StatTile label="LLM cost" value={fmtUsd(run.llmCostUsd)} />
        <StatTile label="Tavily searches" value={run.webSearches ?? "—"} />
        <StatTile label="Search cost" value={fmtUsd(run.webSearchCostUsd)} />
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <StatTile label="People" value={data.people.length} />
        <StatTile label="Decision-makers" value={decisionMakers} />
        <StatTile label="Family members" value={familyMembers} />
        <StatTile label="Articles" value={data.articles.length} />
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <StatTile label="Validated facts" value={data.facts.length} />
        <StatTile label="Red flags" value={data.flags.length} />
        <StatTile label="Photos" value={`${peopleWithPhotos}/${data.people.length}`} />
        <StatTile label="LinkedIn URLs" value={`${peopleWithLinkedin}/${data.people.length}`} />
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <StatTile label="Input tokens" value={run.inputTokens ? fmt(run.inputTokens) : "—"} />
        <StatTile label="Output tokens" value={run.outputTokens ? fmt(run.outputTokens) : "—"} />
      </div>
      <Card>
        <CardContent className="p-5 space-y-3">
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80">Run timeline</h3>
          <div className="grid sm:grid-cols-2 gap-3 text-sm">
            <RunDetail icon={<Clock className="h-3.5 w-3.5" />} label="Started" value={new Date(run.startedAt).toLocaleString()} />
            <RunDetail icon={<BadgeCheck className="h-3.5 w-3.5" />} label={run.completedAt ? "Completed" : "Last update"} value={ranAt.toLocaleString()} />
            <RunDetail icon={<Activity className="h-3.5 w-3.5" />} label="URL" value={run.url} />
            <RunDetail icon={<Users className="h-3.5 w-3.5" />} label="Source" value="research pipeline" />
          </div>
          {run.error ? (
            <div className="rounded border border-rose-500/30 bg-rose-500/5 p-3 text-xs">
              <div className="font-medium text-rose-400 mb-1 flex items-center gap-1.5"><AlertTriangle className="h-3 w-3" /> Error</div>
              <pre className="whitespace-pre-wrap break-words text-muted-foreground">{run.error}</pre>
            </div>
          ) : null}
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-5">
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80 mb-2 flex items-center gap-1.5">
            <FileText className="h-3.5 w-3.5" /> Pipeline
          </h3>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Pipeline: discover → article-hunter → fact-builder → fact-validator →
            relationship-resolver → person-profile-builder (parallel) → photo-resolver
            (2nd pass on URLs already collected) → hook-specialist → per-person
            email-writer + validator. PhotoFinder removed — PPB+PhotoResolver
            cover photo extraction without burning extra search queries.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function RunDetail({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground/70 mb-0.5 flex items-center gap-1 font-medium">{icon}{label}</div>
      <div className="text-sm text-foreground/90 truncate">{value}</div>
    </div>
  );
}

// Emails — generated outreach per person. Subject + body + sources, copyable + EDITABLE with history.
export function EmailsPanel({ emails, loading, distributorId, onOpenPerson }: { emails: ResearchEmail[] | undefined; loading: boolean; distributorId: string; onOpenPerson?: (toName: string) => void }) {
  if (loading) return <Card><CardContent className="p-12 text-center text-sm text-muted-foreground">Loading emails…</CardContent></Card>;
  if (!emails || emails.length === 0) {
    return (
      <Card>
        <CardContent className="p-12 text-center space-y-2">
          <Mail className="h-10 w-10 text-muted-foreground/40 mx-auto" />
          <p className="text-sm text-muted-foreground">
            No emails generated yet. Run the pipeline (or wait for it to finish) — emails are written in the
            email-writer phase after person profiles are built.
          </p>
        </CardContent>
      </Card>
    );
  }
  return (
    <div className="space-y-3">
      {emails.map((e) => (
        <EmailCard key={e.id} email={e} distributorId={distributorId} onOpenPerson={onOpenPerson} />
      ))}
    </div>
  );
}

function EmailCard({ email, distributorId, onOpenPerson }: { email: ResearchEmail; distributorId: string; onOpenPerson?: (toName: string) => void }) {
  const qc = useQueryClient();
  const [copied, setCopied] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draftSubject, setDraftSubject] = useState(email.subject ?? "");
  const [draftBody, setDraftBody] = useState(email.body ?? "");
  const [viewOriginal, setViewOriginal] = useState(false);
  const [renderMode, setRenderMode] = useState<"preview" | "raw">("preview");
  const [showDiff, setShowDiff] = useState(false);

  const showOriginal = viewOriginal && email.isEdited;
  const visibleSubject = showOriginal ? (email.subjectOriginal ?? "") : (email.subject ?? "");
  const visibleBody    = showOriginal ? (email.bodyOriginal ?? "")    : (email.body ?? "");

  const saveMutation = useMutation({
    mutationFn: () => research.updateEmail(distributorId, email.id, { subject: draftSubject, body: draftBody }),
    onSuccess: () => {
      toast.success("Email saved · original preserved");
      qc.invalidateQueries({ queryKey: ["emails", distributorId] });
      qc.invalidateQueries({ queryKey: ["person-dossier"] });
      setEditing(false);
    },
    onError: (err: Error) => toast.error(err.message || "Failed to save"),
  });

  const approveMutation = useMutation({
    mutationFn: () => research.approveEmail(distributorId, email.id),
    onSuccess: () => {
      toast.success("Approved — ready to send");
      qc.invalidateQueries({ queryKey: ["emails", distributorId] });
      qc.invalidateQueries({ queryKey: ["person-dossier"] });
    },
    onError: (err: Error) => toast.error(err.message || "Failed to approve"),
  });

  const [sendOpen, setSendOpen] = useState(false);
  const [sendToEmail, setSendToEmail] = useState(email.sentToEmail ?? email.toEmail ?? "");
  const [sendMailbox, setSendMailbox] = useState<string>("");
  // Load live mailbox list from /api/outreach/mailboxes when the dialog opens.
  const mailboxesQ = useQuery({
    queryKey: ["mailboxes-for-send"],
    queryFn: () => outreach.listMailboxes(),
    enabled: sendOpen,
    staleTime: 60_000,
  });
  // Auto-pick first connected mailbox once loaded.
  useEffect(() => {
    if (sendMailbox || !mailboxesQ.data?.accounts?.length) return;
    const first = mailboxesQ.data.accounts.find((a) => a.address);
    if (first?.address) setSendMailbox(first.address);
  }, [mailboxesQ.data, sendMailbox]);

  const sendMutation = useMutation({
    mutationFn: (manualOnly: boolean) =>
      research.sendEmail(distributorId, email.id, {
        toEmail: sendToEmail.trim(),
        mailboxEmail: manualOnly ? undefined : sendMailbox || undefined,
        manualOnly,
      }),
    onSuccess: (data) => {
      if (data.sentVia === "instantly") toast.success(`Sent via Instantly from ${data.sentBy ? data.sentToEmail : "selected mailbox"}`);
      else toast.success("Marked sent (manual)");
      qc.invalidateQueries({ queryKey: ["emails", distributorId] });
      qc.invalidateQueries({ queryKey: ["person-dossier"] });
      setSendOpen(false);
    },
    onError: (err: Error) => toast.error(err.message || "Send failed — email NOT marked sent"),
  });

  function copyToClipboard() {
    const text = `Subject: ${visibleSubject}\n\n${visibleBody}`;
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      toast.success("Copied to clipboard");
      setTimeout(() => setCopied(false), 1500);
    });
  }

  function startEdit() {
    setDraftSubject(email.subject ?? "");
    setDraftBody(email.body ?? "");
    setViewOriginal(false);
    setShowDiff(false);
    setEditing(true);
  }
  function cancelEdit() {
    setEditing(false);
    setDraftSubject(email.subject ?? "");
    setDraftBody(email.body ?? "");
  }

  const canShowDiff = email.isEdited && !editing && !showOriginal;
  const approvalNeeded = email.approvalStatus === "draft" || email.approvalStatus === "edited_by_human";

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-0">
        <div className="flex flex-col gap-2 px-5 py-3 bg-muted/30 border-b border-border">
          <div className="flex items-center gap-2 min-w-0 flex-wrap">
            <Mail className="h-3.5 w-3.5 text-primary shrink-0" />
            {onOpenPerson && email.toName ? (
              <button
                type="button"
                onClick={() => onOpenPerson(email.toName!)}
                className="text-sm font-medium truncate hover:text-primary hover:underline transition cursor-pointer text-left"
                title="Open recipient details"
              >
                {email.toName}
              </button>
            ) : (
              <span className="text-sm font-medium truncate">{email.toName ?? "Unnamed"}</span>
            )}
            {email.recipientTitle ? (
              <span className="text-xs text-muted-foreground truncate">· {email.recipientTitle}</span>
            ) : null}
            {email.toEmail ? (
              <span className="text-xs text-muted-foreground truncate">{email.toEmail}</span>
            ) : (
              <span className="text-[10px] text-muted-foreground/60 italic">no email on file</span>
            )}
            {email.role ? (
              <Badge variant="outline" className="text-[9px] uppercase tracking-wider text-muted-foreground/80" title="Playbook used to draft this email">
                {email.role.replace(/_/g, " ")} playbook
              </Badge>
            ) : null}
            {email.isEdited ? (
              <Badge variant="outline" className="text-[10px] uppercase border-amber-400/40 text-amber-300 bg-amber-400/10">
                edited
              </Badge>
            ) : null}
            <ApprovalBadge status={email.approvalStatus} approvedBy={email.approvedBy} approvedAt={email.approvedAt} />
            {email.sentAt ? (
              <Badge
                className="text-[10px] uppercase border-emerald-500/40 text-emerald-300 bg-emerald-500/10"
                title={`Sent ${new Date(email.sentAt).toLocaleString()} via ${email.sentVia ?? "?"}${email.sentToEmail ? ` to ${email.sentToEmail}` : ""}`}
              >
                Sent · {email.sentVia ?? "?"}
              </Badge>
            ) : null}
            <span className="text-xs text-muted-foreground">{email.wordCount ?? 0} words</span>
          </div>
          <div className="flex items-center gap-1 flex-wrap">
            {!editing ? (
              <div className="inline-flex rounded-md border border-border bg-background/40 p-0.5">
                <button
                  type="button"
                  onClick={() => setRenderMode("preview")}
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] transition ${renderMode === "preview" ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                  title="Pretty rendered preview"
                >
                  <Eye className="h-3 w-3" /> Preview
                </button>
                <button
                  type="button"
                  onClick={() => setRenderMode("raw")}
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] transition ${renderMode === "raw" ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                  title="Raw text (as the LLM produced it)"
                >
                  <Code className="h-3 w-3" /> Raw
                </button>
              </div>
            ) : null}
            {canShowDiff ? (
              <Button size="sm" variant={showDiff ? "secondary" : "ghost"} onClick={() => setShowDiff((v) => !v)}>
                <GitCompare className="h-3.5 w-3.5" />
                <span className="ml-1.5 text-xs">{showDiff ? "Hide diff" : "Show diff"}</span>
              </Button>
            ) : null}
            {email.isEdited && !editing ? (
              <Button size="sm" variant="ghost" onClick={() => setViewOriginal((v) => !v)} title="Toggle original / edited view">
                <History className="h-3.5 w-3.5" />
                <span className="ml-1.5 text-xs">{viewOriginal ? "Edited" : "Original"}</span>
              </Button>
            ) : null}
            {editing ? (
              <>
                <Button size="sm" variant="ghost" onClick={cancelEdit} disabled={saveMutation.isPending}>
                  <X className="h-3.5 w-3.5" />
                  <span className="ml-1.5 text-xs">Cancel</span>
                </Button>
                <Button size="sm" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
                  {saveMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                  <span className="ml-1.5 text-xs">Save</span>
                </Button>
              </>
            ) : (
              <>
                <Button size="sm" variant="ghost" onClick={startEdit} disabled={viewOriginal}>
                  <Pencil className="h-3.5 w-3.5" />
                  <span className="ml-1.5 text-xs">Edit</span>
                </Button>
                <Button size="sm" variant="ghost" onClick={copyToClipboard}>
                  {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  <span className="ml-1.5 text-xs">{copied ? "Copied" : "Copy"}</span>
                </Button>
                {approvalNeeded ? (
                  <Button
                    size="sm"
                    onClick={() => approveMutation.mutate()}
                    disabled={approveMutation.isPending}
                    className="bg-emerald-600 hover:bg-emerald-600/90 text-white"
                  >
                    {approveMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5" />}
                    <span className="ml-1.5 text-xs">Approve</span>
                  </Button>
                ) : null}
                {!email.sentAt ? (
                  <Button
                    size="sm"
                    onClick={() => { setSendToEmail(email.sentToEmail ?? email.toEmail ?? ""); setSendOpen(true); }}
                    className="bg-primary hover:bg-primary/90 text-primary-foreground"
                    title={email.toEmail ? `Send to ${email.toEmail}` : "Set recipient email first"}
                  >
                    <Mail className="h-3.5 w-3.5" />
                    <span className="ml-1.5 text-xs">Send</span>
                  </Button>
                ) : null}
              </>
            )}
          </div>
        </div>
        <div className="px-5 py-4 space-y-3">
          {editing ? (
            <>
              <div>
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground/70 mb-1 font-medium">Subject</div>
                <input
                  type="text"
                  value={draftSubject}
                  onChange={(ev) => setDraftSubject(ev.target.value)}
                  className="w-full rounded border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground/70 mb-1 font-medium">Body</div>
                <textarea
                  value={draftBody}
                  onChange={(ev) => setDraftBody(ev.target.value)}
                  rows={Math.min(28, Math.max(10, draftBody.split("\n").length + 2))}
                  className="w-full rounded border border-border bg-background px-3 py-2 text-sm font-sans leading-relaxed focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>
            </>
          ) : showDiff ? (
            <EmailDiffView
              originalBody={email.bodyOriginal}
              editedBody={email.body}
              originalSubject={email.subjectOriginal}
              editedSubject={email.subject}
            />
          ) : (
            <>
              {showOriginal ? (
                <div className="text-[10px] uppercase tracking-wide text-amber-300/80 mb-1 font-medium">
                  Showing original · edited {email.editedAt ? new Date(email.editedAt).toLocaleString() : ""} by {email.editedBy ?? "—"}
                </div>
              ) : null}
              {renderMode === "preview" ? (
                <EmailRenderer subject={visibleSubject} body={visibleBody} />
              ) : (
                <>
                  {visibleSubject ? (
                    <div>
                      <div className="text-[10px] uppercase tracking-wide text-muted-foreground/70 mb-0.5 font-medium">Subject</div>
                      <div className="text-sm font-medium">{visibleSubject}</div>
                    </div>
                  ) : null}
                  <div>
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground/70 mb-0.5 font-medium">Body</div>
                    <pre className="text-sm whitespace-pre-wrap font-sans leading-relaxed text-foreground/90">{visibleBody}</pre>
                  </div>
                </>
              )}
            </>
          )}
          {email.sourcesMd ? (
            <details className="rounded border border-border/60 bg-muted/20 p-3">
              <summary className="text-xs text-muted-foreground cursor-pointer select-none flex items-center gap-1.5">
                <FileText className="h-3 w-3" /> Source citations
              </summary>
              <pre className="text-xs whitespace-pre-wrap font-sans mt-2 text-muted-foreground/80 leading-relaxed">{email.sourcesMd}</pre>
            </details>
          ) : null}
        </div>
      </CardContent>
      {/* Send confirmation dialog — shows exactly what will be sent. */}
      <Dialog open={sendOpen} onOpenChange={setSendOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-primary" /> Send email
            </DialogTitle>
            <DialogDescription>
              Sends via Instantly using the mailbox you pick below. If the workspace that owns that mailbox can't send (e.g. expired plan), the email is <strong>not</strong> marked Sent — you'll see the error and can retry from another mailbox.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor={`to-${email.id}`} className="text-xs uppercase tracking-wider text-muted-foreground">Recipient (to)</Label>
                <Input
                  id={`to-${email.id}`}
                  type="email"
                  value={sendToEmail}
                  onChange={(e) => setSendToEmail(e.target.value)}
                  placeholder="name@company.com"
                  autoFocus
                />
                {!sendToEmail && !email.toEmail ? (
                  <p className="text-[11px] text-amber-400/80">No email on file — type one to send.</p>
                ) : null}
              </div>
              <div className="space-y-1">
                <Label htmlFor={`from-${email.id}`} className="text-xs uppercase tracking-wider text-muted-foreground">Send from</Label>
                <select
                  id={`from-${email.id}`}
                  value={sendMailbox}
                  onChange={(e) => setSendMailbox(e.target.value)}
                  disabled={mailboxesQ.isLoading}
                  className="w-full h-9 px-2 rounded-md border border-input bg-background text-sm focus:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  {mailboxesQ.isLoading ? (
                    <option value="">Loading mailboxes…</option>
                  ) : (
                    <>
                      <option value="">— pick a mailbox —</option>
                      {mailboxesQ.data?.accounts?.filter((a) => a.address).map((a) => (
                        <option key={a.address} value={a.address}>
                          {a.address}{a.warmupActive ? " · warm" : ""}
                        </option>
                      ))}
                    </>
                  )}
                </select>
                {!mailboxesQ.isLoading && (!mailboxesQ.data?.accounts || mailboxesQ.data.accounts.length === 0) ? (
                  <p className="text-[11px] text-amber-400/80">No connected mailboxes — only "Mark sent (manual)" available.</p>
                ) : null}
              </div>
            </div>
            <div className="rounded-md border border-border bg-muted/30 p-3 max-h-64 overflow-y-auto">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground/70 mb-1">Subject</div>
              <div className="text-sm font-medium mb-3">{visibleSubject}</div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground/70 mb-1">Body</div>
              <pre className="text-xs whitespace-pre-wrap font-sans text-foreground/85 leading-relaxed">{visibleBody}</pre>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setSendOpen(false)} disabled={sendMutation.isPending}>Cancel</Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => sendMutation.mutate(true)}
              disabled={!sendToEmail.trim() || sendMutation.isPending}
              title="Skip Instantly — just mark as sent (you'll handle delivery)"
            >
              Mark sent (manual)
            </Button>
            <Button
              type="button"
              onClick={() => sendMutation.mutate(false)}
              disabled={!sendToEmail.trim() || !sendMailbox || sendMutation.isPending}
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
              title={!sendMailbox ? "Pick a mailbox to send from" : `Send from ${sendMailbox}`}
            >
              {sendMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
              <span className="ml-1.5">Send via Instantly</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function ApprovalBadge({
  status,
  approvedBy,
  approvedAt,
}: {
  status: ResearchEmail["approvalStatus"];
  approvedBy: string | null;
  approvedAt: string | null;
}) {
  if (status === "approved") {
    const title = approvedBy
      ? `Approved by ${approvedBy}${approvedAt ? ` · ${new Date(approvedAt).toLocaleString()}` : ""}`
      : "Approved";
    return (
      <Badge
        variant="outline"
        title={title}
        className="text-[10px] uppercase border-emerald-400/40 text-emerald-300 bg-emerald-500/10 gap-1"
      >
        <ShieldCheck className="h-3 w-3" /> approved
      </Badge>
    );
  }
  if (status === "edited_by_human") {
    return (
      <Badge variant="outline" className="text-[10px] uppercase border-amber-400/40 text-amber-300 bg-amber-400/10">
        edited · needs approval
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="text-[10px] uppercase text-muted-foreground border-border">
      draft
    </Badge>
  );
}

function GenerateDialog({ defaultUrl, distributorId, regenerate, isRunning, onSubmitted }: { defaultUrl?: string | null; distributorId: string; regenerate: boolean; isRunning: boolean; onSubmitted: () => void }) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  // For regenerate: first show a confirm step, then the URL form.
  const [confirmed, setConfirmed] = useState(false);

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) setConfirmed(false);
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    try {
      const fd = new FormData(e.currentTarget);
      const url = String(fd.get("url") ?? "").trim();
      if (!url) throw new Error("URL required");
      // On regenerate, send force:true since the backend would otherwise refuse if a
      // run is active. The user already confirmed in the UI.
      await research.enqueue(url, distributorId, regenerate);
      toast.success("Run queued — pipeline starting…");
      handleOpenChange(false);
      onSubmitted();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally { setPending(false); }
  }

  const showConfirm = regenerate && !confirmed;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm" disabled={isRunning} title={isRunning ? "A run is already in progress" : undefined}>
          {isRunning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {isRunning ? "Running…" : regenerate ? "Regenerate" : "Generate intelligence"}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        {showConfirm ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-400" /> Regenerate intelligence?
              </DialogTitle>
              <DialogDescription>
                Intel for this distributor already exists. Regenerating will refresh the
                company summary, articles, facts, and emails. People rows are
                merged — your manually-edited contact info (emails, phones,
                LinkedIn, photos, titles) is preserved.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => handleOpenChange(false)}>Cancel</Button>
              <Button type="button" variant="destructive" onClick={() => setConfirmed(true)}>
                <Sparkles className="h-4 w-4" /> Yes, regenerate
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" /> Generate intelligence
              </DialogTitle>
              <DialogDescription>
                Runs the multi-agent pipeline (discover → photo-finder → article-hunter → fact-builder → person-profile-builder → emails) and writes a structured dossier: company facts, leadership org chart with family member highlights, per-person profiles, and cited sources.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={onSubmit} className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="research-url">Company website</Label>
                <Input id="research-url" name="url" defaultValue={defaultUrl ?? ""} placeholder="https://example.com" autoFocus required />
              </div>
              <DialogFooter>
                <Button type="button" variant="ghost" onClick={() => handleOpenChange(false)} disabled={pending}>Cancel</Button>
                <Button type="submit" disabled={pending}>
                  {pending ? <><Loader2 className="h-4 w-4 animate-spin" /> Queuing…</> : <><Sparkles className="h-4 w-4" /> Run pipeline</>}
                </Button>
              </DialogFooter>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
