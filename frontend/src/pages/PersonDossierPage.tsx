import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft, Mail, Phone, Linkedin, ExternalLink, Copy, Check, MapPin,
  GraduationCap, Briefcase, Building2, ScrollText, Users, Heart, Crown, Sparkles,
  Pencil, X, History, Save, Loader2, Eye, Code, GitCompare, ShieldCheck,
  MessagesSquare,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { EmailRenderer } from "@/components/EmailRenderer";
import { EmailDiffView } from "@/components/EmailDiffView";
import { OutreachStatusBadge } from "@/components/OutreachStatusBadge";
import { research } from "@/lib/api";
import { initials } from "@/lib/utils";

export function PersonDossierPage() {
  const { id, personId } = useParams<{ id: string; personId: string }>();
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["person-dossier", id, personId],
    queryFn: () => research.person(id!, personId!),
    enabled: !!(id && personId),
  });

  if (isLoading) return <DossierSkeleton />;
  if (isError) return (
    <div className="space-y-5 max-w-7xl mx-auto">
      <BackLink id={id!} />
      <Card><CardContent className="p-8 text-sm text-rose-400">{(error as Error).message}</CardContent></Card>
    </div>
  );
  if (!data) return null;

  const { person, relatedArticles, parent, spouse, children, personalizedEmail } = data;
  const hasDeepProfile =
    !!person.careerSummary ||
    (person.education && person.education.length > 0) ||
    relatedArticles.length > 0 ||
    (person.extraFacts && person.extraFacts.length > 0);

  return (
    <div className="space-y-5 max-w-7xl mx-auto">
      <BackLink id={id!} />

      <div className="grid lg:grid-cols-3 gap-5">
        {/* ─── Left main column ─────────────────────────────────────── */}
        <div className="lg:col-span-2 space-y-5">
          {/* Hero card */}
          <Card className="relative overflow-hidden">
            <div
              aria-hidden
              className="absolute inset-0 -z-10 bg-gradient-to-br from-primary/15 via-primary/5 to-transparent opacity-60"
            />
            <CardContent className="p-6">
              <div className="flex items-start gap-5">
                <Avatar className="h-20 w-20 rounded-2xl ring-1 ring-border">
                  {person.photoUrl ? (
                    <AvatarImage src={person.photoUrl} alt={person.fullName} className="object-cover" />
                  ) : null}
                  <AvatarFallback className="rounded-2xl text-xl font-semibold bg-primary/10 text-primary">
                    {initials(person.fullName)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0 space-y-2">
                  <h1 className="text-2xl font-semibold tracking-tight">{person.fullName}</h1>
                  <div className="text-muted-foreground">{person.title || "—"}</div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {person.isDecisionMaker ? (
                      <Badge className="bg-primary/15 text-primary border-primary/30">
                        <Crown className="h-3 w-3 mr-1" /> Decision maker
                      </Badge>
                    ) : null}
                    {person.isDeceased ? (
                      <Badge variant="outline" className="text-muted-foreground">
                        † {person.deathYear ?? "deceased"}
                      </Badge>
                    ) : null}
                    {person.generation ? <Badge variant="secondary">Gen {person.generation}</Badge> : null}
                    {person.roleCategory ? (
                      <Badge variant="outline" className="text-[10px] uppercase tracking-wider">
                        {person.roleCategory.replace(/_/g, " ")}
                      </Badge>
                    ) : null}
                    <OutreachStatusBadge
                      distributorId={id!}
                      personId={person.id}
                      status={person.outreachStatus ?? "new"}
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* About / career */}
          {(person.careerSummary || person.bioShort) ? (
            <Section icon={<Briefcase className="h-3.5 w-3.5" />} title="About">
              <div className="space-y-3 text-sm leading-relaxed text-foreground/90">
                {person.careerSummary ? <p>{person.careerSummary}</p> : null}
                {person.bioShort && person.bioShort !== person.careerSummary ? (
                  <p className="text-foreground/80 italic">{person.bioShort}</p>
                ) : null}
              </div>
            </Section>
          ) : null}

          {/* Experience */}
          {person.experience && person.experience.length > 0 ? (
            <Section icon={<Building2 className="h-3.5 w-3.5" />} title="Experience">
              <ul className="space-y-3">
                {person.experience.map((x, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <div className="h-2 w-2 rounded-full bg-primary/60 mt-2 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm">{x.title}</div>
                      <div className="text-xs text-foreground/70">
                        {[x.company, x.dates].filter(Boolean).join(" · ") || "—"}
                      </div>
                      {x.description ? (
                        <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{x.description}</p>
                      ) : null}
                      {x.source_url ? (
                        <a
                          href={x.source_url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs text-primary hover:underline inline-flex items-center gap-1 mt-1"
                        >
                          source <ExternalLink className="h-2.5 w-2.5" />
                        </a>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            </Section>
          ) : null}

          {/* Education */}
          {person.education && person.education.length > 0 ? (
            <Section icon={<GraduationCap className="h-3.5 w-3.5" />} title="Education">
              <ul className="space-y-2.5">
                {person.education.map((e, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <div className="h-2 w-2 rounded-full bg-primary/60 mt-2 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm">{e.school}</div>
                      <div className="text-xs text-muted-foreground">
                        {[e.degree, e.year].filter(Boolean).join(" · ") || "—"}
                      </div>
                      {e.activities ? (
                        <div className="text-xs text-muted-foreground/80 mt-0.5">
                          Activities and societies: {e.activities}
                        </div>
                      ) : null}
                      {e.source_url ? (
                        <a
                          href={e.source_url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs text-primary hover:underline inline-flex items-center gap-1 mt-1"
                        >
                          source <ExternalLink className="h-2.5 w-2.5" />
                        </a>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            </Section>
          ) : null}

          {/* Personalized email (collapsed by default) */}
          {personalizedEmail ? <PersonalizedEmailCard email={personalizedEmail} distributorId={id!} /> : null}

          {/* Related articles */}
          <Section
            icon={<ScrollText className="h-3.5 w-3.5" />}
            title={`Related Articles · interviews · news${relatedArticles.length > 0 ? ` (${relatedArticles.length})` : ""}`}
          >
            {relatedArticles.length === 0 ? (
              <div className="text-sm text-muted-foreground">
                <p>No articles linked to this person yet.</p>
                <p className="text-xs mt-1">
                  Re-run Intelligence to populate via the PersonProfileBuilder agent.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {relatedArticles.map((a) => (
                  <a
                    key={a.id}
                    href={a.url}
                    target="_blank"
                    rel="noreferrer"
                    className="block p-3 -mx-1 rounded-md border border-border bg-card/50 hover:border-primary/50 hover:bg-card transition group"
                  >
                    <div className="font-medium text-sm group-hover:text-primary transition flex items-center gap-1.5">
                      {a.title}
                      <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 transition" />
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {a.outlet} · {a.publicationDate ?? "—"} · {a.articleType}
                    </div>
                    {a.snippet ? (
                      <p className="text-xs text-foreground/80 mt-2">{a.snippet}</p>
                    ) : null}
                    {a.keyQuote ? (
                      <blockquote className="border-l-2 border-primary/40 pl-2.5 mt-2 text-xs italic text-foreground/70">
                        “{a.keyQuote}”
                      </blockquote>
                    ) : null}
                  </a>
                ))}
              </div>
            )}
          </Section>

          {/* Extra facts (awards / boards / quotes) */}
          {person.extraFacts && person.extraFacts.length > 0 ? (
            <Section icon={<Sparkles className="h-3.5 w-3.5" />} title="Other public facts">
              <ul className="space-y-2">
                {person.extraFacts.map((f, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-sm">
                    <Badge variant="outline" className="text-[10px] uppercase tracking-wider mt-0.5">
                      {f.type}
                    </Badge>
                    <div className="flex-1">
                      <span className="text-foreground/90">{f.fact}</span>
                      {f.source_url ? (
                        <a
                          href={f.source_url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs text-primary hover:underline ml-2 inline-flex items-center gap-0.5"
                        >
                          <ExternalLink className="h-2.5 w-2.5" />
                        </a>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            </Section>
          ) : null}

          {/* Empty-state hint */}
          {!hasDeepProfile ? (
            <Card>
              <CardContent className="p-8 text-center text-sm text-muted-foreground space-y-1">
                <p>No deep profile yet for this person.</p>
                <p className="text-xs">
                  Re-run the Intelligence pipeline on the distributor — the
                  PersonProfileBuilder agent will fill in education, career, and related articles.
                </p>
              </CardContent>
            </Card>
          ) : null}
        </div>

        {/* ─── Right sidebar (sticky to viewport) ─────────────────── */}
        <aside className="space-y-3 lg:sticky lg:top-6 lg:self-start pr-1">
          {/* Contact card */}
          <Card>
            <CardContent className="p-5 space-y-4">
              <ContactInfo label="Email" icon={<Mail className="h-4 w-4" />} value={person.email} type="email" />
              {(() => {
                const extras = (person.emails ?? []).filter((e) => e && e.toLowerCase() !== (person.email ?? "").toLowerCase());
                if (extras.length === 0) return null;
                return (
                  <div className="pl-7 space-y-1 -mt-2">
                    {extras.map((e) => (
                      <a key={e} href={`mailto:${e}`} className="block text-xs text-muted-foreground hover:text-primary truncate">
                        + {e}
                      </a>
                    ))}
                  </div>
                );
              })()}
              {person.personalEmail && person.personalEmail !== person.email ? (
                <div className="pl-7 -mt-2">
                  <a href={`mailto:${person.personalEmail}`} className="block text-xs text-muted-foreground hover:text-primary truncate">
                    personal: {person.personalEmail}
                  </a>
                </div>
              ) : null}
              <Separator />
              <ContactInfo label="Phone" icon={<Phone className="h-4 w-4" />} value={person.phone} type="tel" />
              {(() => {
                const extras = (person.phones ?? []).filter((p) => p && p !== person.phone);
                if (extras.length === 0) return null;
                return (
                  <div className="pl-7 space-y-1 -mt-2">
                    {extras.map((p) => (
                      <a key={p} href={`tel:${p}`} className="block text-xs text-muted-foreground hover:text-primary truncate">
                        + {p}
                      </a>
                    ))}
                  </div>
                );
              })()}
              <Separator />
              <ContactInfo label="LinkedIn" icon={<Linkedin className="h-4 w-4" />} value={person.linkedinUrl} type="url" />
              {person.twitterUrl ? (
                <>
                  <Separator />
                  <ContactInfo label="Twitter" icon={<ExternalLink className="h-4 w-4" />} value={person.twitterUrl} type="url" />
                </>
              ) : null}
              {person.githubUrl ? (
                <>
                  <Separator />
                  <ContactInfo label="GitHub" icon={<ExternalLink className="h-4 w-4" />} value={person.githubUrl} type="url" />
                </>
              ) : null}
              {person.locationText ? (
                <>
                  <Separator />
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground/70 font-medium">Location</span>
                    </div>
                    <div className="text-sm truncate">{person.locationText}</div>
                  </div>
                </>
              ) : null}
              <Separator />
              <div className="grid grid-cols-2 gap-3">
                <Stat label="Generation" value={person.generation ? `Gen ${person.generation}` : "—"} />
                <Stat label="Role" value={person.roleCategory?.replace(/_/g, " ") ?? "—"} />
                <Stat label="Status" value={person.isDeceased ? "Deceased" : "Active"} />
                <Stat label="Decision maker" value={person.isDecisionMaker ? "Yes" : "No"} />
              </div>
            </CardContent>
          </Card>

          {/* Family connections */}
          {(parent || spouse || children.length > 0) ? (
            <Card>
              <CardContent className="p-5 space-y-3">
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground/70 flex items-center gap-1.5 font-medium">
                  <Users className="h-3.5 w-3.5" /> Family
                </div>
                <div className="space-y-1.5">
                  {parent ? <FamilyLink id={id!} relation="Parent" person={parent} icon={null} /> : null}
                  {spouse ? (
                    <FamilyLink id={id!} relation="Spouse" person={spouse} icon={<Heart className="h-3 w-3 fill-current text-rose-400" />} />
                  ) : null}
                  {children.map((c) => (
                    <FamilyLink
                      key={c.id}
                      id={id!}
                      relation={`Child${c.generation ? ` · Gen ${c.generation}` : ""}`}
                      person={c}
                      icon={null}
                    />
                  ))}
                </div>
              </CardContent>
            </Card>
          ) : null}
        </aside>
      </div>
    </div>
  );
}

function BackLink({ id }: { id: string }) {
  // Restore the exact distributor URL (with active tab + orgView) the user
  // came from. Falls back to /distributors/:id if nothing was saved
  // (e.g. deep-link arrival without visiting the parent page first).
  const saved = typeof localStorage !== "undefined" ? localStorage.getItem(`distributorLastUrl:${id}`) : null;
  const target = saved && saved.startsWith(`/distributors/${id}`) ? saved : `/distributors/${id}`;
  return (
    <Link
      to={target}
      className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition"
    >
      <ArrowLeft className="h-3.5 w-3.5" /> Back to distributor
    </Link>
  );
}

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="p-5">
        <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80 mb-3 flex items-center gap-1.5">
          {icon}{title}
        </h2>
        {children}
      </CardContent>
    </Card>
  );
}

function ContactInfo({
  label,
  icon,
  value,
  type,
}: {
  label: string;
  icon: React.ReactNode;
  value: string | null | undefined;
  type: "email" | "tel" | "url";
}) {
  const v = value ?? null;
  const href = v
    ? type === "email"
      ? `mailto:${v}`
      : type === "tel"
        ? `tel:${v}`
        : v.startsWith("http")
          ? v
          : `https://${v}`
    : null;
  return (
    <div className="group">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground/70 mb-1.5 flex items-center gap-1.5 font-medium">
        {icon}{label}
      </div>
      <div className="flex items-center gap-1.5 text-sm">
        {v ? (
          <span className="flex-1 min-w-0 truncate">{v}</span>
        ) : (
          <span className="flex-1 min-w-0 truncate text-muted-foreground/60 italic">Not found</span>
        )}
        {v && href ? (
          <>
            <a
              href={href}
              target={type === "url" ? "_blank" : undefined}
              rel="noreferrer"
              className="text-muted-foreground/60 hover:text-primary opacity-0 group-hover:opacity-100 transition shrink-0"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
            <CopyBtn text={v} />
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
      onClick={() => {
        navigator.clipboard.writeText(text).then(() => {
          setCopied(true);
          toast.success("Copied");
          setTimeout(() => setCopied(false), 1200);
        });
      }}
      className="text-muted-foreground/60 hover:text-primary opacity-0 group-hover:opacity-100 transition"
    >
      {copied ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground/70 mb-0.5 font-medium">{label}</div>
      <div className="text-sm font-medium truncate" title={value}>{value}</div>
    </div>
  );
}

function FamilyLink({
  id,
  relation,
  person,
  icon,
}: {
  id: string;
  relation: string;
  person: { id: number; fullName: string; title: string | null; photoUrl: string | null; generation: number | null };
  icon: React.ReactNode;
}) {
  return (
    <Link
      to={`/distributors/${id}/people/${person.id}`}
      className="flex items-center gap-2.5 p-2 -mx-1 rounded-md hover:bg-muted/50 transition group"
    >
      <Avatar className="h-9 w-9">
        {person.photoUrl ? <AvatarImage src={person.photoUrl} alt={person.fullName} /> : null}
        <AvatarFallback className="bg-secondary text-xs">{initials(person.fullName)}</AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate group-hover:text-primary transition flex items-center gap-1">
          {icon} {person.fullName}
        </div>
        <div className="text-[11px] text-muted-foreground truncate">
          {relation}{person.title ? ` · ${person.title}` : ""}
        </div>
      </div>
    </Link>
  );
}

function PersonalizedEmailCard({ email, distributorId }: { email: import("@/lib/api").ResearchEmail; distributorId: string }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
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
      qc.invalidateQueries({ queryKey: ["person-dossier"] });
      qc.invalidateQueries({ queryKey: ["emails", distributorId] });
      setEditing(false);
    },
    onError: (err: Error) => toast.error(err.message || "Failed to save"),
  });

  function copy(ev: React.MouseEvent) {
    ev.stopPropagation();
    const text = `Subject: ${visibleSubject}\n\n${visibleBody}`;
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      toast.success("Email copied");
      setTimeout(() => setCopied(false), 1500);
    });
  }
  function startEdit(ev: React.MouseEvent) {
    ev.stopPropagation();
    setDraftSubject(email.subject ?? "");
    setDraftBody(email.body ?? "");
    setViewOriginal(false);
    setShowDiff(false);
    setEditing(true);
    setOpen(true);
  }
  function cancelEdit() {
    setEditing(false);
    setDraftSubject(email.subject ?? "");
    setDraftBody(email.body ?? "");
  }
  const canShowDiff = email.isEdited && !editing && !showOriginal;

  return (
    <Card className="overflow-hidden border-primary/30">
      <CardContent className="p-0">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="w-full flex items-center justify-between gap-3 px-5 py-3 bg-primary/5 border-b border-primary/20 hover:bg-primary/10 transition text-left"
        >
          <div className="flex items-center gap-2 min-w-0 flex-1 flex-wrap">
            <Mail className="h-3.5 w-3.5 text-primary shrink-0" />
            <span className="text-sm font-semibold text-primary">Personalized email</span>
            {email.role ? <Badge variant="outline" className="text-[10px] uppercase">{email.role}</Badge> : null}
            {email.isEdited ? (
              <Badge variant="outline" className="text-[10px] uppercase border-amber-400/40 text-amber-300 bg-amber-400/10">
                edited
              </Badge>
            ) : null}
            {email.subject ? (
              <span className="text-xs text-muted-foreground truncate ml-1">— {email.subject}</span>
            ) : null}
            <span className="text-xs text-muted-foreground ml-1 shrink-0">· {email.wordCount ?? 0} words</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span
              role="button"
              tabIndex={0}
              onClick={copy}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") copy(e as unknown as React.MouseEvent); }}
              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition px-2 py-0.5 rounded cursor-pointer"
            >
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? "Copied" : "Copy"}
            </span>
            <span className="text-xs text-muted-foreground">{open ? "Hide" : "Show"}</span>
          </div>
        </button>
        {open ? (
          <div className="px-5 py-4 space-y-3">
            <div className="flex items-center justify-end gap-1 flex-wrap">
              {!editing ? (
                <div className="inline-flex rounded-md border border-border bg-background/40 p-0.5 mr-1">
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
                <Button size="sm" variant="ghost" onClick={() => setViewOriginal((v) => !v)}>
                  <History className="h-3.5 w-3.5" />
                  <span className="ml-1.5 text-xs">{viewOriginal ? "Edited" : "Original"}</span>
                </Button>
              ) : null}
              {editing ? (
                <>
                  <Button size="sm" variant="ghost" onClick={cancelEdit} disabled={saveMutation.isPending}>
                    <X className="h-3.5 w-3.5" /><span className="ml-1.5 text-xs">Cancel</span>
                  </Button>
                  <Button size="sm" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
                    {saveMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                    <span className="ml-1.5 text-xs">Save</span>
                  </Button>
                </>
              ) : (
                <Button size="sm" variant="ghost" onClick={startEdit} disabled={viewOriginal}>
                  <Pencil className="h-3.5 w-3.5" /><span className="ml-1.5 text-xs">Edit</span>
                </Button>
              )}
            </div>
            {editing ? (
              <>
                <div>
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground/70 mb-1 font-medium">Subject</div>
                  <input type="text" value={draftSubject} onChange={(ev) => setDraftSubject(ev.target.value)}
                    className="w-full rounded border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40" />
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground/70 mb-1 font-medium">Body</div>
                  <textarea value={draftBody} onChange={(ev) => setDraftBody(ev.target.value)}
                    rows={Math.min(28, Math.max(10, draftBody.split("\n").length + 2))}
                    className="w-full rounded border border-border bg-background px-3 py-2 text-sm font-sans leading-relaxed focus:outline-none focus:ring-2 focus:ring-primary/40" />
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
                    {visibleBody ? (
                      <div>
                        <div className="text-[10px] uppercase tracking-wide text-muted-foreground/70 mb-0.5 font-medium">Body</div>
                        <pre className="text-sm whitespace-pre-wrap font-sans leading-relaxed text-foreground/90">{visibleBody}</pre>
                      </div>
                    ) : null}
                  </>
                )}
              </>
            )}
            {email.sourcesMd ? (
              <details className="rounded border border-border/60 bg-muted/20 p-3">
                <summary className="text-xs text-muted-foreground cursor-pointer select-none flex items-center gap-1.5">
                  <ScrollText className="h-3 w-3" /> Source citations
                </summary>
                <pre className="text-xs whitespace-pre-wrap font-sans mt-2 text-muted-foreground/80 leading-relaxed">{email.sourcesMd}</pre>
              </details>
            ) : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function DossierSkeleton() {
  return (
    <div className="space-y-5 max-w-7xl mx-auto">
      <Skeleton className="h-4 w-40" />
      <div className="grid lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-5">
          <Card>
            <CardContent className="p-6">
              <div className="flex gap-5">
                <Skeleton className="h-20 w-20 rounded-2xl" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-7 w-2/3" />
                  <Skeleton className="h-5 w-1/3" />
                  <Skeleton className="h-5 w-32" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Skeleton className="h-32" />
          <Skeleton className="h-40" />
        </div>
        <Skeleton className="h-72" />
      </div>
    </div>
  );
}
