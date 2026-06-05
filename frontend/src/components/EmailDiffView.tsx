import { useMemo, useState, useRef, useEffect } from "react";
import { diffWords } from "diff";
import { Button } from "@/components/ui/button";
import { ArrowLeftRight, Rows3 } from "lucide-react";

/**
 * Word-level diff between the original LLM-generated email body and the current (edited) body.
 *
 * Two display modes:
 *   - Inline (default): deletes shown red strikethrough, inserts green; flows like prose.
 *   - Side-by-side:    two columns, original left, edited right; scroll-synced.
 *
 * Empty/null sides are tolerated — falls back to the other side as identical.
 */
export function EmailDiffView({
  originalBody,
  editedBody,
  originalSubject,
  editedSubject,
}: {
  originalBody: string | null;
  editedBody: string | null;
  originalSubject?: string | null;
  editedSubject?: string | null;
}) {
  const [mode, setMode] = useState<"inline" | "side">("inline");
  const orig = originalBody ?? "";
  const edit = editedBody ?? "";

  const parts = useMemo(() => diffWords(orig, edit), [orig, edit]);

  return (
    <div className="rounded-md border border-border/60 bg-background/50 overflow-hidden">
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-border/40 bg-muted/30">
        <div className="text-[10px] uppercase tracking-wide text-muted-foreground/70 font-medium">
          Diff · original ↔ edited
        </div>
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant={mode === "inline" ? "secondary" : "ghost"}
            onClick={() => setMode("inline")}
            className="h-7 px-2"
          >
            <Rows3 className="h-3.5 w-3.5" />
            <span className="ml-1.5 text-xs">Inline</span>
          </Button>
          <Button
            size="sm"
            variant={mode === "side" ? "secondary" : "ghost"}
            onClick={() => setMode("side")}
            className="h-7 px-2"
          >
            <ArrowLeftRight className="h-3.5 w-3.5" />
            <span className="ml-1.5 text-xs">Side-by-side</span>
          </Button>
        </div>
      </div>
      {(originalSubject !== undefined || editedSubject !== undefined) && (originalSubject !== editedSubject) ? (
        <div className="px-4 py-3 border-b border-border/40 bg-muted/10">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground/70 mb-1 font-medium">Subject</div>
          {mode === "inline" ? (
            <InlineDiff parts={diffWords(originalSubject ?? "", editedSubject ?? "")} />
          ) : (
            <SideBySide
              original={originalSubject ?? ""}
              edited={editedSubject ?? ""}
              parts={diffWords(originalSubject ?? "", editedSubject ?? "")}
            />
          )}
        </div>
      ) : null}
      <div className="px-4 py-4">
        {mode === "inline" ? (
          <InlineDiff parts={parts} />
        ) : (
          <SideBySide original={orig} edited={edit} parts={parts} />
        )}
      </div>
    </div>
  );
}

function InlineDiff({ parts }: { parts: ReturnType<typeof diffWords> }) {
  return (
    <div className="text-sm leading-relaxed whitespace-pre-wrap font-sans">
      {parts.map((p, i) => {
        if (p.added) {
          return (
            <span
              key={i}
              className="bg-emerald-500/15 text-emerald-300 rounded px-0.5"
            >
              {p.value}
            </span>
          );
        }
        if (p.removed) {
          return (
            <span
              key={i}
              className="bg-rose-500/15 text-rose-300 line-through decoration-rose-400/60 rounded px-0.5"
            >
              {p.value}
            </span>
          );
        }
        return <span key={i} className="text-foreground/80">{p.value}</span>;
      })}
    </div>
  );
}

function SideBySide({
  parts,
}: {
  original: string;
  edited: string;
  parts: ReturnType<typeof diffWords>;
}) {
  const leftRef = useRef<HTMLDivElement>(null);
  const rightRef = useRef<HTMLDivElement>(null);
  const syncing = useRef(false);

  // Scroll-sync both columns.
  useEffect(() => {
    const left = leftRef.current;
    const right = rightRef.current;
    if (!left || !right) return;
    function onL() {
      if (syncing.current || !left || !right) return;
      syncing.current = true;
      right.scrollTop = left.scrollTop;
      requestAnimationFrame(() => { syncing.current = false; });
    }
    function onR() {
      if (syncing.current || !left || !right) return;
      syncing.current = true;
      left.scrollTop = right.scrollTop;
      requestAnimationFrame(() => { syncing.current = false; });
    }
    left.addEventListener("scroll", onL);
    right.addEventListener("scroll", onR);
    return () => {
      left.removeEventListener("scroll", onL);
      right.removeEventListener("scroll", onR);
    };
  }, []);

  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="space-y-1">
        <div className="text-[10px] uppercase tracking-wide text-muted-foreground/70 font-medium">Original</div>
        <div
          ref={leftRef}
          className="rounded border border-border/40 bg-muted/10 p-3 text-sm leading-relaxed whitespace-pre-wrap font-sans max-h-[60vh] overflow-auto"
        >
          {parts.map((p, i) => {
            if (p.added) return null; // hide insertions on left
            if (p.removed) {
              return (
                <span key={i} className="bg-rose-500/15 text-rose-300 line-through decoration-rose-400/60 rounded px-0.5">
                  {p.value}
                </span>
              );
            }
            return <span key={i} className="text-foreground/80">{p.value}</span>;
          })}
        </div>
      </div>
      <div className="space-y-1">
        <div className="text-[10px] uppercase tracking-wide text-muted-foreground/70 font-medium">Edited</div>
        <div
          ref={rightRef}
          className="rounded border border-border/40 bg-muted/10 p-3 text-sm leading-relaxed whitespace-pre-wrap font-sans max-h-[60vh] overflow-auto"
        >
          {parts.map((p, i) => {
            if (p.removed) return null; // hide deletions on right
            if (p.added) {
              return (
                <span key={i} className="bg-emerald-500/15 text-emerald-300 rounded px-0.5">
                  {p.value}
                </span>
              );
            }
            return <span key={i} className="text-foreground/80">{p.value}</span>;
          })}
        </div>
      </div>
    </div>
  );
}
