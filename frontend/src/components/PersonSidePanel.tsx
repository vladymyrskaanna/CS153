import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { X, Mail, Phone, Linkedin, MapPin, GraduationCap, Briefcase, Crown, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { InlineEdit } from "@/components/InlineEdit";
import { research } from "@/lib/api";
import { initials, cn } from "@/lib/utils";

/**
 * Slide-out side panel showing a person's contact card (photo, contact info,
 * LinkedIn, education, career summary). Designed to slot next to the Emails
 * tab so user can review who they're emailing without leaving the page.
 *
 * Does NOT show generated emails — the parent page renders those. This panel
 * is purely the "who is this person" briefing.
 */
export function PersonSidePanel({
  distributorId,
  personId,
  open,
  onClose,
}: {
  distributorId: string;
  personId: number | null;
  open: boolean;
  onClose: () => void;
}) {
  const { data, isLoading } = useQuery({
    queryKey: ["person-dossier", distributorId, personId],
    queryFn: () => research.person(distributorId, personId!),
    enabled: !!(open && personId),
  });

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <aside className="animate-in slide-in-from-right duration-200">
      <Card className="border-primary/20 shadow-xl flex flex-col max-h-[calc(100vh-2rem)] overflow-hidden">
        <CardContent className="p-0 flex flex-col min-h-0">
          {/* Header */}
          <div className="flex items-start justify-between gap-2 px-5 py-3 border-b border-border bg-card/95 shrink-0">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground/70 font-medium">Recipient</span>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center justify-center h-6 w-6 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition"
              title="Close (Esc)"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="overflow-y-auto min-h-0">
            {isLoading || !data ? (
              <div className="p-5 space-y-3">
                <Skeleton className="h-16 w-16 rounded-2xl" />
                <Skeleton className="h-5 w-2/3" />
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-20" />
              </div>
            ) : (
              <PanelBody
                distributorId={distributorId}
                person={data.person}
                parent={data.parent}
                spouse={data.spouse}
                relatedArticles={data.relatedArticles}
              />
            )}
          </div>
        </CardContent>
      </Card>
    </aside>
  );
}

function ContactRow({
  icon, value, onSave, placeholder, hrefPrefix,
}: {
  icon: React.ReactNode;
  value: string | null | undefined;
  onSave: (v: string) => Promise<void>;
  placeholder: string;
  hrefPrefix?: "mailto:" | "tel:" | "url";
}) {
  return (
    <div className="flex items-center gap-2 group min-w-0">
      <span className="text-muted-foreground shrink-0 w-4">{icon}</span>
      <span className="flex-1 min-w-0">
        <InlineEdit value={value} onSave={onSave} placeholder={placeholder} className="text-xs break-all" />
      </span>
      {value && hrefPrefix ? (
        <a
          href={hrefPrefix === "tel:" ? `tel:${value.replace(/[^+0-9]/g, "")}`
              : hrefPrefix === "mailto:" ? `mailto:${value}`
              : value}
          target={hrefPrefix === "url" ? "_blank" : undefined}
          rel="noreferrer"
          className="shrink-0 text-[10px] text-muted-foreground/60 hover:text-primary opacity-0 group-hover:opacity-100 transition"
          title="Open"
          onClick={(e) => e.stopPropagation()}
        >
          ↗
        </a>
      ) : null}
    </div>
  );
}

function PanelBody({
  distributorId,
  person,
  parent,
  spouse,
  relatedArticles,
}: {
  distributorId: string;
  person: NonNullable<ReturnType<typeof research.person> extends Promise<infer R> ? R : never>["person"];
  parent: { id: number; fullName: string; title: string | null } | null;
  spouse: { id: number; fullName: string; title: string | null } | null;
  relatedArticles: Array<{ id: number; url: string; title: string; outlet: string }>;
}) {
  const qc = useQueryClient();
  const extraEmails = (person.emails ?? []).filter((e) => e && e.toLowerCase() !== (person.email ?? "").toLowerCase());
  const extraPhones = (person.phones ?? []).filter((p) => p && p !== person.phone);
  const updateMut = useMutation({
    mutationFn: ({ field, value }: { field: string; value: string }) =>
      research.updatePerson(distributorId, person.id, field, value),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["person-dossier", distributorId, person.id] });
      qc.invalidateQueries({ queryKey: ["intel", distributorId] });
    },
    onError: (e: Error) => toast.error(e.message || "Save failed"),
  });
  const save = (field: string) => async (v: string) => {
    await updateMut.mutateAsync({ field, value: v });
  };

  return (
    <div className="p-5 space-y-4">
      {/* Hero */}
      <div className="flex items-start gap-3">
        <Avatar className="h-16 w-16 rounded-2xl ring-1 ring-border shrink-0">
          {person.photoUrl ? (
            <AvatarImage src={person.photoUrl} alt={person.fullName} className="object-cover" />
          ) : null}
          <AvatarFallback className="rounded-2xl text-lg font-semibold bg-primary/10 text-primary">
            {initials(person.fullName)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1 space-y-1">
          <div className="text-base font-semibold leading-tight truncate">{person.fullName}</div>
          {person.title ? <div className="text-xs text-muted-foreground truncate">{person.title}</div> : null}
          <div className="flex flex-wrap gap-1 pt-1">
            {person.isDecisionMaker ? (
              <Badge className="bg-primary/15 text-primary border-primary/30 text-[9px] h-4 px-1.5">
                <Crown className="h-2.5 w-2.5 mr-0.5" /> Decision
              </Badge>
            ) : null}
            {person.generation ? <Badge variant="secondary" className="text-[9px] h-4 px-1.5">Gen {person.generation}</Badge> : null}
            {person.roleCategory ? (
              <Badge variant="outline" className="text-[9px] h-4 px-1.5 uppercase tracking-wider">
                {person.roleCategory.replace(/_/g, " ")}
              </Badge>
            ) : null}
          </div>
        </div>
      </div>

      {/* Contacts — always visible + inline-editable */}
      <div className="space-y-2 text-sm">
        <ContactRow
          icon={<Mail className="h-3.5 w-3.5" />}
          value={person.email}
          onSave={save("email")}
          placeholder="Add email…"
          hrefPrefix="mailto:"
        />
        {extraEmails.length > 0 ? (
          <div className="pl-6 space-y-0.5">
            {extraEmails.map((e) => (
              <a key={e} href={`mailto:${e}`} className="block text-[11px] text-muted-foreground hover:text-primary truncate">+ {e}</a>
            ))}
          </div>
        ) : null}
        <ContactRow
          icon={<Phone className="h-3.5 w-3.5" />}
          value={person.phone}
          onSave={save("phone")}
          placeholder="Add phone…"
          hrefPrefix="tel:"
        />
        {extraPhones.length > 0 ? (
          <div className="pl-6 space-y-0.5">
            {extraPhones.map((p) => (
              <a key={p} href={`tel:${p}`} className="block text-[11px] text-muted-foreground hover:text-primary truncate">+ {p}</a>
            ))}
          </div>
        ) : null}
        <ContactRow
          icon={<Linkedin className="h-3.5 w-3.5" />}
          value={person.linkedinUrl}
          onSave={save("linkedinUrl")}
          placeholder="Add LinkedIn URL…"
          hrefPrefix="url"
        />
        {person.locationText ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <MapPin className="h-3.5 w-3.5" />
            <span className="text-xs truncate">{person.locationText}</span>
          </div>
        ) : null}
      </div>

      {/* About / career */}
      {person.careerSummary ? (
        <section className="space-y-1.5">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground/70 font-medium flex items-center gap-1">
            <Briefcase className="h-3 w-3" /> About
          </div>
          <p className="text-xs leading-relaxed text-foreground/90 line-clamp-6">{person.careerSummary}</p>
        </section>
      ) : person.bioShort ? (
        <section className="space-y-1.5">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground/70 font-medium flex items-center gap-1">
            <Briefcase className="h-3 w-3" /> About
          </div>
          <p className="text-xs leading-relaxed text-foreground/80 italic line-clamp-6">{person.bioShort}</p>
        </section>
      ) : null}

      {/* Education */}
      {person.education && person.education.length > 0 ? (
        <section className="space-y-1.5">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground/70 font-medium flex items-center gap-1">
            <GraduationCap className="h-3 w-3" /> Education
          </div>
          <ul className="space-y-1">
            {person.education.map((e, i) => (
              <li key={i} className="text-xs">
                <div className="font-medium">{e.school}</div>
                <div className="text-muted-foreground">{[e.degree, e.year].filter(Boolean).join(" · ") || "—"}</div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* Family connections */}
      {parent || spouse ? (
        <section className="space-y-1.5">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground/70 font-medium">Family</div>
          {parent ? <div className="text-xs"><span className="text-muted-foreground">parent: </span><span className="font-medium">{parent.fullName}</span>{parent.title ? <span className="text-muted-foreground"> · {parent.title}</span> : null}</div> : null}
          {spouse ? <div className="text-xs"><span className="text-muted-foreground">spouse: </span><span className="font-medium">{spouse.fullName}</span>{spouse.title ? <span className="text-muted-foreground"> · {spouse.title}</span> : null}</div> : null}
        </section>
      ) : null}

      {/* Related articles (count only) */}
      {relatedArticles.length > 0 ? (
        <section className="space-y-1">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground/70 font-medium">Articles</div>
          <div className="text-xs text-muted-foreground">{relatedArticles.length} related article{relatedArticles.length === 1 ? "" : "s"}</div>
        </section>
      ) : null}

      {/* Open full dossier */}
      <Link
        to={`/distributors/${distributorId}/people/${person.id}`}
        className={cn(
          "flex items-center justify-center gap-1.5 w-full rounded-md border border-primary/40 bg-primary/10",
          "text-primary text-xs font-medium px-3 py-2 hover:bg-primary/15 transition",
        )}
      >
        Open full dossier <ArrowRight className="h-3 w-3" />
      </Link>
    </div>
  );
}

