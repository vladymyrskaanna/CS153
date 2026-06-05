import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Linkedin, Mail, Phone, Crown, Plus, Trash2, Loader2, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { cn, initials } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { InlineEdit } from "@/components/InlineEdit";
import { Button } from "@/components/ui/button";
import { research, type IntelPerson } from "@/lib/api";

/**
 * Editable table view of the org chart. Each cell saves on blur via the
 * PATCH /people/:id endpoint. A "+ Add person" row appends new rows; the
 * trash icon on hover removes a row.
 */
export function OrgChartTable({ people }: { people: IntelPerson[] }) {
  const { id: distributorId } = useParams<{ id: string }>();
  const qc = useQueryClient();

  const updateMut = useMutation({
    mutationFn: ({ personId, field, value }: { personId: number; field: string; value: string | number | boolean | null }) =>
      research.updatePerson(distributorId!, personId, field, value),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["intel", distributorId] });
    },
    onError: (e: Error) => toast.error(e.message || "Save failed"),
  });

  const deleteMut = useMutation({
    mutationFn: (personId: number) => research.deletePerson(distributorId!, personId),
    onSuccess: () => {
      toast.success("Person removed");
      qc.invalidateQueries({ queryKey: ["intel", distributorId] });
    },
    onError: (e: Error) => toast.error(e.message || "Delete failed"),
  });

  // Sort: decision-makers first, then by generation, then alphabetical.
  const sorted = [...people].sort((a, b) => {
    if (a.isDecisionMaker !== b.isDecisionMaker) return a.isDecisionMaker ? -1 : 1;
    const ga = a.generation ?? 99;
    const gb = b.generation ?? 99;
    if (ga !== gb) return ga - gb;
    return a.fullName.localeCompare(b.fullName);
  });

  async function save(personId: number, field: string, value: string | number | boolean | null) {
    await updateMut.mutateAsync({ personId, field, value });
  }

  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/60 bg-muted/30 text-[10px] uppercase tracking-wider text-muted-foreground">
              <th className="text-left font-medium px-3 py-2 w-12"></th>
              <th className="text-left font-medium px-3 py-2">Name</th>
              <th className="text-left font-medium px-3 py-2">Title</th>
              <th className="text-left font-medium px-3 py-2 w-20">Gen</th>
              <th className="text-left font-medium px-3 py-2">LinkedIn</th>
              <th className="text-left font-medium px-3 py-2">Email</th>
              <th className="text-left font-medium px-3 py-2">Phone</th>
              <th className="text-left font-medium px-3 py-2 w-10"></th>
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-3 py-6 text-center text-xs text-muted-foreground italic">
                  No people in this dossier yet. Click "+ Add person" below to add one manually.
                </td>
              </tr>
            ) : (
              sorted.map((p) => (
                <PersonRow
                  key={p.id}
                  person={p}
                  distributorId={distributorId!}
                  onSave={save}
                  onDelete={(id) => {
                    if (confirm(`Remove ${p.fullName}?`)) deleteMut.mutate(id);
                  }}
                />
              ))
            )}
          </tbody>
          <tfoot>
            <tr className="border-t border-border/60">
              <td colSpan={8} className="px-3 py-2">
                <AddPersonRow distributorId={distributorId!} />
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </Card>
  );
}

function PersonRow({
  person,
  distributorId,
  onSave,
  onDelete,
}: {
  person: IntelPerson;
  distributorId: string;
  onSave: (personId: number, field: string, value: string | number | boolean | null) => Promise<void>;
  onDelete: (personId: number) => void;
}) {
  const allEmails = Array.from(
    new Set([person.email, ...(person.emails ?? [])].filter((e): e is string => !!e?.trim()).map((e) => e.toLowerCase())),
  );
  const allPhones = Array.from(
    new Set([person.phone, ...(person.phones ?? [])].filter((s): s is string => !!s?.trim()).map((s) => s.replace(/\s+/g, ""))),
  );

  return (
    <tr className="group border-b border-border/40 hover:bg-accent/10 transition-colors">
      <td className="px-3 py-2 align-middle">
        <PersonAvatar person={person} />
      </td>
      <td className="px-3 py-2 align-middle">
        <div className="flex items-center gap-1.5">
          <Link
            to={`/distributors/${distributorId}/people/${person.id}`}
            className="font-medium text-foreground hover:text-primary transition-colors text-xs"
            title="Open dossier"
          >
            <ExternalLink className="h-3 w-3 inline opacity-50" />
          </Link>
          <InlineEdit
            value={person.fullName}
            onSave={(v) => onSave(person.id, "fullName", v)}
            placeholder="Name"
            className="text-sm font-medium"
          />
          {person.isDecisionMaker ? <Crown className="h-3 w-3 text-amber-400 shrink-0" /> : null}
        </div>
      </td>
      <td className="px-3 py-2 text-foreground/80 align-middle">
        <InlineEdit
          value={person.title}
          onSave={(v) => onSave(person.id, "title", v)}
          placeholder="—"
          className="text-sm"
        />
      </td>
      <td className="px-3 py-2 text-muted-foreground tabular-nums align-middle">
        <InlineEdit
          value={person.generation == null ? "" : `G${person.generation}`}
          onSave={(v) => {
            const m = v.match(/(\d+)/);
            onSave(person.id, "generation", m ? Number(m[1]) : null);
          }}
          placeholder="—"
          className="text-xs"
        />
      </td>
      <td className="px-3 py-2 align-middle min-w-[180px]">
        <InlineLinkEdit
          value={person.linkedinUrl}
          onSave={(v) => onSave(person.id, "linkedinUrl", v)}
          icon={<Linkedin className="h-3.5 w-3.5" />}
          label="LinkedIn"
          colorClass="text-sky-400 hover:text-sky-300"
        />
      </td>
      <td className="px-3 py-2 align-middle min-w-[200px]">
        <div className="flex flex-col gap-0.5">
          <InlineEdit
            value={person.email}
            onSave={(v) => onSave(person.id, "email", v)}
            placeholder="—"
            className="text-xs"
          />
          {allEmails.slice(1).map((e) => (
            <a key={e} href={`mailto:${e}`} className="text-[11px] text-muted-foreground hover:text-primary inline-flex items-center gap-1">
              <Mail className="h-3 w-3 opacity-60" /> {e}
            </a>
          ))}
        </div>
      </td>
      <td className="px-3 py-2 align-middle min-w-[140px]">
        <div className="flex flex-col gap-0.5">
          <InlineEdit
            value={person.phone}
            onSave={(v) => onSave(person.id, "phone", v)}
            placeholder="—"
            className="text-xs tabular-nums"
          />
          {allPhones.slice(1).map((s) => (
            <a key={s} href={`tel:${s.replace(/[^+0-9]/g, "")}`} className="text-[11px] text-muted-foreground hover:text-primary inline-flex items-center gap-1 tabular-nums">
              <Phone className="h-3 w-3 opacity-60" /> {s}
            </a>
          ))}
        </div>
      </td>
      <td className="px-3 py-2 align-middle text-right">
        <button
          type="button"
          onClick={() => onDelete(person.id)}
          className="opacity-0 group-hover:opacity-100 transition text-muted-foreground hover:text-destructive p-1 rounded"
          title="Remove person"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </td>
    </tr>
  );
}

/** Editable URL cell that renders as a clickable link in view mode. */
function InlineLinkEdit({
  value, onSave, icon, label, colorClass,
}: {
  value: string | null | undefined;
  onSave: (v: string) => Promise<void> | void;
  icon: React.ReactNode;
  label: string;
  colorClass: string;
}) {
  const [editing, setEditing] = useState(false);
  if (editing || !value) {
    return (
      <InlineEdit
        value={value}
        onSave={async (v) => { await onSave(v); setEditing(false); }}
        placeholder={`Add ${label} URL`}
        className="text-xs"
      />
    );
  }
  return (
    <div className="flex items-center gap-2">
      <a
        href={value}
        target="_blank"
        rel="noreferrer"
        className={cn("inline-flex items-center gap-1 text-xs transition-colors", colorClass)}
        onClick={(e) => e.stopPropagation()}
      >
        {icon}
        <span>{label}</span>
      </a>
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="text-[10px] text-muted-foreground/60 hover:text-foreground opacity-0 group-hover:opacity-100 transition"
        title="Edit URL"
      >
        edit
      </button>
    </div>
  );
}

function PersonAvatar({ person }: { person: IntelPerson }) {
  const ring = person.isDecisionMaker
    ? "ring-1 ring-inset ring-amber-400/60"
    : "ring-1 ring-inset ring-border";
  return (
    <div className={cn("h-9 w-9 rounded-md overflow-hidden bg-muted grid place-items-center text-[10px] font-semibold text-muted-foreground", ring)}>
      {person.photoUrl ? (
        <img
          src={person.photoUrl}
          alt={person.fullName}
          className="h-full w-full object-cover"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).style.display = "none";
          }}
          loading="lazy"
        />
      ) : (
        <span>{initials(person.fullName)}</span>
      )}
    </div>
  );
}

/** Footer row — type a name and press Enter (or click +). */
function AddPersonRow({ distributorId }: { distributorId: string }) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const addMut = useMutation({
    mutationFn: () => research.addPerson(distributorId, { fullName: name.trim() }),
    onSuccess: () => {
      toast.success("Person added");
      setName("");
      qc.invalidateQueries({ queryKey: ["intel", distributorId] });
    },
    onError: (e: Error) => toast.error(e.message || "Add failed"),
  });

  function submit() {
    if (!name.trim()) return;
    addMut.mutate();
  }

  return (
    <div className="flex items-center gap-2">
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); submit(); } }}
        placeholder="+ Add person — type full name and Enter"
        className="flex-1 bg-transparent text-sm px-2 py-1.5 rounded-md border border-dashed border-border/60 focus:border-primary focus:outline-none placeholder:text-muted-foreground/60"
        disabled={addMut.isPending}
      />
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={submit}
        disabled={!name.trim() || addMut.isPending}
      >
        {addMut.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
        <span className="ml-1">Add</span>
      </Button>
    </div>
  );
}
