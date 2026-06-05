import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export function InlineEdit({
  value, onSave, placeholder = "—", multiline = false, className,
}: {
  value: string | null | undefined;
  onSave: (v: string) => Promise<void> | void;
  placeholder?: string;
  multiline?: boolean;
  className?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? "");
  const [pending, setPending] = useState(false);
  const ref = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  useEffect(() => setDraft(value ?? ""), [value]);
  useEffect(() => { if (editing) ref.current?.focus(); }, [editing]);

  async function commit() {
    if (draft === (value ?? "")) { setEditing(false); return; }
    setPending(true);
    try { await onSave(draft); } finally { setPending(false); setEditing(false); }
  }
  function onKey(e: KeyboardEvent) {
    if (e.key === "Escape") { setDraft(value ?? ""); setEditing(false); }
    else if (e.key === "Enter" && !multiline) { e.preventDefault(); commit(); }
  }

  if (editing) {
    const props = {
      value: draft,
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setDraft(e.target.value),
      onBlur: commit,
      onKeyDown: onKey,
      disabled: pending,
      className: cn("border-primary focus-visible:ring-primary/30", className),
    };
    return multiline ? <Textarea ref={ref as React.RefObject<HTMLTextAreaElement>} rows={4} {...props} /> : <Input ref={ref as React.RefObject<HTMLInputElement>} {...props} />;
  }

  return (
    <span
      tabIndex={0}
      onClick={() => setEditing(true)}
      onFocus={() => setEditing(true)}
      className={cn(
        "cursor-text rounded-md px-1.5 py-0.5 -mx-1.5 hover:bg-muted/60 focus:bg-muted/60 focus:outline-none transition inline-block",
        !value && "text-muted-foreground/60 italic",
        className,
      )}
    >
      {value || placeholder}
    </span>
  );
}
