import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Globe, Phone, MapPin, Building2, ExternalLink, Download, Mail, Linkedin, MessageSquare, ArrowRight, Brain, Network, ScrollText, AlertTriangle, Activity, MapPinned, Paperclip, FileText, Link2, Trash2, Upload, Plus, Loader2, Table as TableIcon, Workflow } from "lucide-react";
import { OverviewTab, SourcesPanel, FlagsPanel, RunProgressBanner, IntelGenerateButton, IntelEmptyState } from "@/components/IntelPanel";
import { PersonSidePanel } from "@/components/PersonSidePanel";
import { FamilyTreePanel } from "@/components/FamilyTree";
import { OrgChartTable } from "@/components/OrgChartTable";
import { DistributorLogo } from "@/components/DistributorLogo";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { distributors as api, research, materials, type Material } from "@/lib/api";
import { InlineEdit } from "@/components/InlineEdit";
import { LocalTimeChip } from "@/components/chips/LocalTimeChip";
import { cn, initials, relativeTime } from "@/lib/utils";

export function DistributorDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  // Reconstruct previous list URL from localStorage so the "All distributors"
  // link returns the user to their search/filter/page state. Falls back to
  // /distributors when nothing is saved (e.g. deep link arrival).
  const lastListUrl = (typeof localStorage !== "undefined" && localStorage.getItem("distributorsLastUrl")) || "/distributors";
  const { data, isLoading } = useQuery({
    queryKey: ["distributor", id],
    queryFn: () => api.get(id!),
    enabled: !!id,
  });
  const activity = useQuery({
    queryKey: ["activity", id],
    queryFn: () => api.activity(id!),
    enabled: !!id,
  });
  const intelQ = useQuery({
    queryKey: ["intel", id],
    queryFn: () => research.intel(id!),
    enabled: !!id,
    refetchInterval: (q) => {
      const status = q.state.data?.latestRun?.status;
      return status === "queued" || status === "running" ? 1500 : false;
    },
  });
  const treeQ = useQuery({
    queryKey: ["family-tree", id],
    queryFn: () => research.familyTree(id!),
    enabled: !!id && !!intelQ.data?.intel,
  });
  const emailsQ = useQuery({
    queryKey: ["emails", id],
    queryFn: () => research.emails(id!),
    enabled: !!id && !!intelQ.data?.intel,
  });

  // Click a person in the Emails tab → show their card in a right-hand panel.
  const [panelPersonId, setPanelPersonId] = useState<number | null>(null);
  function openPersonByName(toName: string) {
    const match = (intelQ.data?.people ?? []).find((p) => p.fullName.trim().toLowerCase() === toName.trim().toLowerCase());
    if (match) setPanelPersonId(match.id);
  }
  const [sp, setSp] = useSearchParams();
  // Persist current distributor URL (with ?tab=...&orgView=...) so the
  // PersonDossierPage "Back to distributor" link can restore the exact tab.
  useEffect(() => {
    if (!id) return;
    const params = sp.toString();
    const url = params ? `/distributors/${id}?${params}` : `/distributors/${id}`;
    try { localStorage.setItem(`distributorLastUrl:${id}`, url); } catch {}
  }, [id, sp]);
  // `contacts` tab was removed — fall back to Overview for any saved deep links.
  const rawTab = sp.get("tab") ?? "overview";
  const tab = rawTab === "contacts" ? "overview" : rawTab;
  // Org Chart opens in **Tree** view by default; ?orgView=table switches to the table.
  const orgView = (sp.get("orgView") === "table" ? "table" : "tree") as "tree" | "table";
  function setTab(next: string) {
    const p = new URLSearchParams(sp);
    if (next === "overview") p.delete("tab"); else p.set("tab", next);
    setSp(p, { replace: true });
  }
  function setOrgView(next: "tree" | "table") {
    const p = new URLSearchParams(sp);
    if (next === "tree") p.delete("orgView"); else p.set("orgView", "table");
    setSp(p, { replace: true });
  }

  if (isLoading || !data) return <DetailSkeleton />;

  const intel = intelQ.data;
  const run = intel?.latestRun;
  const isRunning = run?.status === "queued" || run?.status === "running";
  const hasIntel = !!intel?.intel;

  async function field(f: string, v: string) {
    if (!id) return;
    try { await api.updateField(id, f, v); qc.invalidateQueries({ queryKey: ["distributor", id] }); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <button
        type="button"
        onClick={() => {
          // Prefer browser back if history has a referrer to our list page,
          // else fall back to the saved last-list URL.
          if (window.history.length > 1 && document.referrer.includes("/distributors")) navigate(-1);
          else navigate(lastListUrl);
        }}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition cursor-pointer"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> All distributors
      </button>

      <Card>
        <CardContent className="p-5">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-start gap-3.5 min-w-0 flex-1">
              <DistributorLogo name={data.name} website={data.website} className="h-12 w-12 shrink-0" />
              <div className="min-w-0 flex-1 space-y-2.5">
                <h1 className="text-xl font-semibold tracking-tight uppercase leading-snug">
                  <InlineEdit value={data.name} onSave={(v) => field("name", v)} />
                </h1>
                <div className="flex flex-wrap items-center gap-1.5">
                  {data.state ? <LocalTimeChip state={data.state} compact /> : null}
                  {/* Show state badges only when the distributor spans multiple
                      states — the time chip already shows the single home state. */}
                  {data.states.length > 1
                    ? data.states.slice(0, 5).map((s) => <Badge key={s} variant="secondary" className="text-[10px] px-1.5 h-5">{s}</Badge>)
                    : null}
                  {data.states.length > 5 ? <Badge variant="secondary" className="text-[10px] px-1.5 h-5">+{data.states.length - 5}</Badge> : null}
                  {data.supplier && data.supplier !== "none" ? (
                    <Badge
                      className={
                        "h-6 px-2 inline-flex items-center text-[10px] uppercase tracking-wider " +
                        (data.supplier === "molson_coors"
                          ? "bg-red-500/15 text-red-400 border-red-500/40"
                          : data.supplier === "ab_inbev"
                            ? "bg-amber-500/15 text-amber-400 border-amber-500/40"
                            : "bg-zinc-500/15 text-zinc-300 border-zinc-500/40")
                      }
                    >
                      {data.supplier === "molson_coors" ? "Molson Coors" : data.supplier === "ab_inbev" ? "AB InBev" : data.supplier}
                    </Badge>
                  ) : null}
                </div>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 pt-1">
                  <FieldRow label="Phone" icon={<Phone className="h-3.5 w-3.5" />}>
                    <InlineEdit value={data.phone} onSave={(v) => field("phone", v)} placeholder="Add phone…" />
                  </FieldRow>
                  <FieldRow label="Website" icon={<Globe className="h-3.5 w-3.5" />}
                    actions={data.website ? <a href={data.website.startsWith("http") ? data.website : `https://${data.website}`} target="_blank" rel="noreferrer" className="text-muted-foreground/70 hover:text-primary"><ExternalLink className="h-3.5 w-3.5" /></a> : null}>
                    <InlineEdit value={data.website} onSave={(v) => field("website", v)} placeholder="Add website…" />
                  </FieldRow>
                  <FieldRow label="Address" icon={<Building2 className="h-3.5 w-3.5" />}>
                    <InlineEdit value={data.addressLine1} onSave={(v) => field("addressLine1", v)} placeholder="Street…" />
                  </FieldRow>
                  <FieldRow label="City" icon={<MapPin className="h-3.5 w-3.5" />}>
                    <InlineEdit value={data.city} onSave={(v) => field("city", v)} placeholder="City…" />
                  </FieldRow>
                  <FieldRow label="State" icon={<MapPin className="h-3.5 w-3.5" />}>
                    <InlineEdit value={data.state} onSave={(v) => field("state", v)} placeholder="State…" />
                  </FieldRow>
                  <FieldRow label="ZIP" icon={<MapPin className="h-3.5 w-3.5" />}>
                    <InlineEdit value={data.zip} onSave={(v) => field("zip", v)} placeholder="ZIP…" />
                  </FieldRow>
                </div>
              </div>
            </div>
            <div className="flex flex-col items-end gap-2 shrink-0">
              <Button size="sm" asChild>
                <a href={`/api/distributors/${data.id}/report.html`} target="_blank" rel="noopener"><FileText className="h-4 w-4" /> Report</a>
              </Button>
              <IntelGenerateButton distributorId={data.id} defaultUrl={data.website} hasIntel={hasIntel} isRunning={isRunning} />
            </div>
          </div>
        </CardContent>
      </Card>

      {isRunning && run ? <RunProgressBanner run={run} /> : null}

      <Tabs value={tab} onValueChange={setTab} className="space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <TabsList className="flex-wrap h-auto">
            <TabsTrigger value="overview"><Brain className="h-3.5 w-3.5 mr-1" />Overview</TabsTrigger>
            <TabsTrigger value="tree" disabled={!hasIntel}>
              <Network className="h-3.5 w-3.5 mr-1" />Org Chart
              {hasIntel ? <span className="ml-1.5 text-muted-foreground text-xs">({intel!.people.length})</span> : null}
            </TabsTrigger>
            <TabsTrigger value="sources" disabled={!hasIntel}>
              <ScrollText className="h-3.5 w-3.5 mr-1" />Sources
              {hasIntel ? <span className="ml-1.5 text-muted-foreground text-xs">({intel!.articles.length + intel!.facts.length})</span> : null}
            </TabsTrigger>
            <TabsTrigger value="flags" disabled={!hasIntel}>
              <AlertTriangle className="h-3.5 w-3.5 mr-1" />Flags
              {hasIntel && intel!.flags.length > 0 ? <span className="ml-1.5 rounded-full bg-rose-500/20 text-rose-400 px-1.5 text-[10px]">{intel!.flags.length}</span> : null}
            </TabsTrigger>
            <TabsTrigger value="emails" disabled={!hasIntel}>
              <Mail className="h-3.5 w-3.5 mr-1" />Emails
              {emailsQ.data?.length ? <span className="ml-1.5 text-muted-foreground text-xs">({emailsQ.data.length})</span> : null}
            </TabsTrigger>
            <TabsTrigger value="materials">
              <Paperclip className="h-3.5 w-3.5 mr-1" />Materials
            </TabsTrigger>
            <TabsTrigger value="branches">
              <MapPinned className="h-3.5 w-3.5 mr-1" />Branches
              {data.branches.length ? <span className="ml-1.5 text-muted-foreground text-xs">({data.branches.length})</span> : null}
            </TabsTrigger>
            <TabsTrigger value="notes">Notes <span className="ml-1.5 text-muted-foreground text-xs">({data.notes.length})</span></TabsTrigger>
            <TabsTrigger value="activity">Activity <span className="ml-1.5 text-muted-foreground text-xs">({activity.data?.length ?? 0})</span></TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="overview" className="space-y-3">
          {hasIntel ? <OverviewTab intel={intel!.intel!} /> : <IntelEmptyState />}
        </TabsContent>
        <TabsContent value="tree" className="space-y-3">
          {hasIntel ? (
            <>
              <div className="flex justify-start">
                <div className="inline-flex rounded-md border border-border bg-background p-0.5 text-xs">
                  <button
                    type="button"
                    onClick={() => setOrgView("table")}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded px-2.5 py-1 transition",
                      orgView === "table" ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-accent/30",
                    )}
                  >
                    <TableIcon className="h-3.5 w-3.5" /> Table
                  </button>
                  <button
                    type="button"
                    onClick={() => setOrgView("tree")}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded px-2.5 py-1 transition",
                      orgView === "tree" ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-accent/30",
                    )}
                  >
                    <Workflow className="h-3.5 w-3.5" /> Tree
                  </button>
                </div>
              </div>
              {orgView === "tree"
                ? <FamilyTreePanel tree={treeQ.data} loading={treeQ.isLoading} />
                : <OrgChartTable people={intel!.people} />}
            </>
          ) : <IntelEmptyState />}
        </TabsContent>
        <TabsContent value="sources" className="space-y-3">
          {hasIntel ? <SourcesPanel articles={intel!.articles} facts={intel!.facts} /> : <IntelEmptyState />}
        </TabsContent>
        <TabsContent value="flags">
          {hasIntel ? <FlagsPanel flags={intel!.flags} /> : <IntelEmptyState />}
        </TabsContent>
        <TabsContent value="emails">
          {hasIntel ? (
            <div className={cn("grid gap-4 items-start", panelPersonId ? "lg:grid-cols-[1fr_360px]" : "grid-cols-1")}>
              <div className="min-w-0">
                <EmailsList emails={emailsQ.data} loading={emailsQ.isLoading} onOpenPerson={openPersonByName} />
              </div>
              {panelPersonId ? (
                <div className="lg:sticky lg:top-4 self-start">
                  <PersonSidePanel distributorId={id!} personId={panelPersonId} open={!!panelPersonId} onClose={() => setPanelPersonId(null)} />
                </div>
              ) : null}
            </div>
          ) : <IntelEmptyState />}
        </TabsContent>
        <TabsContent value="materials">
          <MaterialsPanel distributorId={id!} />
        </TabsContent>
        <TabsContent value="branches">
          {data.branches.length === 0 ? (
            <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">No branch information.</CardContent></Card>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {data.branches.map((b) => (
                <Card key={b.id}><CardContent className="p-4">
                  <h3 className="font-medium mb-1">{b.name}</h3>
                  {b.addressFull ? <p className="text-sm text-muted-foreground flex items-start gap-1.5"><MapPin className="h-3.5 w-3.5 mt-0.5 shrink-0" />{b.addressFull}</p> : null}
                  {b.phone ? <p className="text-sm text-muted-foreground flex items-center gap-1.5 mt-1"><Phone className="h-3.5 w-3.5" />{b.phone}</p> : null}
                </CardContent></Card>
              ))}
            </div>
          )}
        </TabsContent>
        <TabsContent value="notes">
          <NotesTab distributorId={data.id} notes={data.notes} />
        </TabsContent>
        <TabsContent value="activity">
          {!activity.data?.length ? (
            <Card><CardContent className="p-12 text-center text-sm text-muted-foreground">No activity yet.</CardContent></Card>
          ) : (
            <Card><CardContent className="p-0 divide-y">
              {activity.data.map((a) => (
                <div key={`${a.kind}-${a.id}`} className="flex items-start gap-3 p-4">
                  <div className="h-8 w-8 rounded-full grid place-items-center shrink-0 mt-0.5"
                    style={a.kind === "status_change" ? { background: "rgb(219 234 254)" } : { background: "rgb(255 237 213)" }}>
                    {a.kind === "status_change" ? <ArrowRight className="h-4 w-4 text-blue-700" /> : <MessageSquare className="h-4 w-4 text-amber-700" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm whitespace-pre-wrap text-foreground/90">{a.text}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{a.user} · {relativeTime(a.date)}</p>
                  </div>
                </div>
              ))}
            </CardContent></Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function FieldRow({ label, icon, children, actions }: { label: string; icon: React.ReactNode; children: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground/70 mb-0.5 flex items-center gap-1 font-medium">{icon}{label}</div>
      <div className="text-sm text-foreground/90 flex items-center gap-1.5">
        <span className="flex-1 min-w-0 truncate">{children}</span>
        {actions}
      </div>
    </div>
  );
}

function EmailsList({ emails, loading, onOpenPerson }: { emails: import("@/lib/api").ResearchEmail[] | undefined; loading: boolean; onOpenPerson?: (toName: string) => void }) {
  if (loading) return <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-40" />)}</div>;
  if (!emails || emails.length === 0) {
    return <Card><CardContent className="p-12 text-center"><p className="text-sm text-muted-foreground">No drafted emails yet.</p></CardContent></Card>;
  }
  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">{emails.length} AI-drafted, personalized {emails.length === 1 ? "email" : "emails"} — one per decision-maker. Click a name to see their profile.</p>
      {emails.map((e) => (
        <Card key={e.id}>
          <CardContent className="p-5 space-y-3">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="min-w-0">
                <button type="button" onClick={() => e.toName && onOpenPerson?.(e.toName)} className="text-sm font-medium hover:text-primary transition text-left">
                  {e.toName}{e.recipientTitle ? <span className="text-muted-foreground font-normal"> · {e.recipientTitle}</span> : null}
                </button>
                {e.toEmail ? <div className="text-xs text-muted-foreground">{e.toEmail}</div> : null}
              </div>
              {e.role ? <Badge variant="outline" className="text-[10px] uppercase tracking-wide">{e.role.replace(/_/g, " ")}</Badge> : null}
            </div>
            <div className="text-[15px] font-semibold tracking-tight">{e.subject}</div>
            <div className="text-sm text-foreground/85 whitespace-pre-wrap leading-relaxed border-l-2 border-border pl-4">{e.body}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function NotesTab({ distributorId, notes }: { distributorId: string; notes: import("@/lib/api").Note[] }) {
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);
  const qc = useQueryClient();

  async function post(e: FormEvent) {
    e.preventDefault();
    if (!draft.trim()) return;
    setPending(true);
    try {
      await api.addNote(distributorId, draft);
      setDraft("");
      qc.invalidateQueries({ queryKey: ["distributor", distributorId] });
      qc.invalidateQueries({ queryKey: ["activity", distributorId] });
      toast.success("Note posted");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally { setPending(false); }
  }
  return (
    <div className="space-y-4 max-w-3xl">
      <Card><CardContent className="p-4">
        <form onSubmit={post}>
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Add a note… (Cmd/Ctrl+Enter to submit)"
            rows={3}
            onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") post(e as unknown as FormEvent); }}
          />
          <div className="flex justify-end mt-2">
            <Button size="sm" type="submit" disabled={pending || !draft.trim()}>Post note</Button>
          </div>
        </form>
      </CardContent></Card>
      {notes.length === 0 ? (
        <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">No notes yet.</CardContent></Card>
      ) : (
        <div className="space-y-3">
          {notes.map((n) => (
            <Card key={n.id}><CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Avatar className="h-7 w-7"><AvatarFallback className="text-[10px]">{initials(n.user)}</AvatarFallback></Avatar>
                <span className="font-medium text-sm">{n.user}</span>
                <span className="text-xs text-muted-foreground">· {relativeTime(n.date)}</span>
              </div>
              <p className="text-sm whitespace-pre-wrap text-foreground/90">{n.text}</p>
            </CardContent></Card>
          ))}
        </div>
      )}
    </div>
  );
}

function fmtBytes(n: number | null) {
  if (n == null) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function MaterialsPanel({ distributorId }: { distributorId: string }) {
  const qc = useQueryClient();
  const matsQ = useQuery({
    queryKey: ["materials", distributorId],
    queryFn: () => materials.list(distributorId),
  });
  const [addingLink, setAddingLink] = useState(false);
  const [linkTitle, setLinkTitle] = useState("");
  const [linkUrl, setLinkUrl] = useState("");

  const addLinkMutation = useMutation({
    mutationFn: () => materials.addLink(distributorId, { title: linkTitle.trim(), url: linkUrl.trim() }),
    onSuccess: () => {
      toast.success("Link added");
      qc.invalidateQueries({ queryKey: ["materials", distributorId] });
      setLinkTitle(""); setLinkUrl(""); setAddingLink(false);
    },
    onError: (err: Error) => toast.error(err.message || "Failed to add link"),
  });

  const uploadMutation = useMutation({
    mutationFn: (file: File) => materials.uploadFile(distributorId, file),
    onSuccess: () => {
      toast.success("File uploaded");
      qc.invalidateQueries({ queryKey: ["materials", distributorId] });
    },
    onError: (err: Error) => toast.error(err.message || "Upload failed"),
  });

  const removeMutation = useMutation({
    mutationFn: (matId: number) => materials.remove(distributorId, matId),
    onSuccess: () => {
      toast.success("Removed");
      qc.invalidateQueries({ queryKey: ["materials", distributorId] });
    },
    onError: (err: Error) => toast.error(err.message || "Failed to remove"),
  });

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) uploadMutation.mutate(file);
    e.target.value = "";
  }

  const items = matsQ.data ?? [];

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 flex flex-wrap items-center gap-3">
          <Button size="sm" onClick={() => setAddingLink((v) => !v)} variant={addingLink ? "outline" : "default"}>
            <Link2 className="h-3.5 w-3.5 mr-1.5" />
            {addingLink ? "Cancel" : "Add link"}
          </Button>
          <label className="cursor-pointer">
            <input type="file" className="hidden" onChange={onFileChange} disabled={uploadMutation.isPending} />
            <span className="inline-flex items-center justify-center rounded-md text-sm font-medium px-3 h-9 bg-secondary text-secondary-foreground hover:bg-secondary/80 transition">
              {uploadMutation.isPending ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Upload className="h-3.5 w-3.5 mr-1.5" />}
              Upload file
            </span>
          </label>
          <span className="text-xs text-muted-foreground ml-auto">{items.length} item{items.length === 1 ? "" : "s"}</span>
        </CardContent>
      </Card>

      {addingLink ? (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div>
              <label className="text-[10px] uppercase tracking-wide text-muted-foreground/70 font-medium block mb-1">Title</label>
              <input
                type="text"
                value={linkTitle}
                onChange={(ev) => setLinkTitle(ev.target.value)}
                placeholder="e.g. meeting notes"
                className="w-full rounded border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-wide text-muted-foreground/70 font-medium block mb-1">URL</label>
              <input
                type="url"
                value={linkUrl}
                onChange={(ev) => setLinkUrl(ev.target.value)}
                placeholder="https://…"
                className="w-full rounded border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>
            <div className="flex justify-end">
              <Button size="sm" onClick={() => addLinkMutation.mutate()} disabled={!linkTitle.trim() || !linkUrl.trim() || addLinkMutation.isPending}>
                {addLinkMutation.isPending ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Plus className="h-3.5 w-3.5 mr-1.5" />}
                Save link
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {matsQ.isLoading ? (
        <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">Loading…</CardContent></Card>
      ) : items.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center space-y-2">
            <Paperclip className="h-10 w-10 text-muted-foreground/40 mx-auto" />
            <p className="text-sm text-muted-foreground">No materials yet. Add links or upload files above.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0 divide-y divide-border">
            {items.map((m) => <MaterialRow key={m.id} distributorId={distributorId} m={m} onRemove={() => removeMutation.mutate(m.id)} removing={removeMutation.isPending} />)}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function MaterialRow({ distributorId, m, onRemove, removing }: { distributorId: string; m: Material; onRemove: () => void; removing: boolean }) {
  const href = m.kind === "link" ? (m.url ?? "#") : materials.fileUrl(distributorId, m.id);
  const Icon = m.kind === "link" ? Link2 : FileText;
  return (
    <div className="flex items-center gap-4 p-4">
      <div className="shrink-0 h-10 w-10 rounded-lg bg-primary/10 text-primary grid place-items-center">
        <Icon className="h-5 w-5" />
      </div>
      <div className="flex-1 min-w-0">
        <a
          href={href}
          target="_blank"
          rel="noreferrer"
          className="text-sm font-medium hover:underline truncate block"
        >
          {m.title}
        </a>
        <div className="text-xs text-muted-foreground flex flex-wrap items-center gap-2 mt-0.5">
          <Badge variant="outline" className="text-[10px] uppercase">{m.kind}</Badge>
          {m.kind === "link" && m.url ? <span className="truncate max-w-[28rem]">{m.url}</span> : null}
          {m.kind === "file" ? (
            <>
              {m.filename ? <span className="truncate max-w-[18rem]">{m.filename}</span> : null}
              <span>· {fmtBytes(m.sizeBytes)}</span>
            </>
          ) : null}
          <span className="ml-auto">
            by <span className="text-foreground/70">{m.uploadedByName || m.uploadedBy}</span> · {relativeTime(m.uploadedAt)}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <a
          href={href}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center justify-center h-9 w-9 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition"
          title={m.kind === "link" ? "Open" : "Download"}
        >
          {m.kind === "link" ? <ExternalLink className="h-3.5 w-3.5" /> : <Download className="h-3.5 w-3.5" />}
        </a>
        <button
          type="button"
          onClick={() => { if (confirm(`Delete "${m.title}"?`)) onRemove(); }}
          disabled={removing}
          className="inline-flex items-center justify-center h-9 w-9 rounded-md hover:bg-rose-500/10 text-muted-foreground hover:text-rose-400 transition"
          title="Delete"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <Skeleton className="h-4 w-32" />
      <Card><CardContent className="p-6 space-y-3">
        <div className="flex gap-4"><Skeleton className="h-14 w-14 rounded-xl" /><div className="flex-1 space-y-2"><Skeleton className="h-7 w-2/3" /><Skeleton className="h-5 w-1/2" /></div></div>
        <div className="grid sm:grid-cols-3 gap-4">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="space-y-1"><Skeleton className="h-3 w-16" /><Skeleton className="h-4 w-32" /></div>)}</div>
      </CardContent></Card>
      <Skeleton className="h-9 w-72" />
      <Card><CardContent className="p-0 divide-y">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="flex items-center gap-4 p-4"><Skeleton className="h-10 w-10 rounded-full" /><div className="flex-1 space-y-2"><Skeleton className="h-4 w-40" /><Skeleton className="h-3 w-64" /></div></div>)}</CardContent></Card>
    </div>
  );
}
