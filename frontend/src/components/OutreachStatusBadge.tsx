import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, ChevronDown, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { research, OUTREACH_STATUSES } from "@/lib/api";
import type { OutreachStatus } from "@/lib/api";

/**
 * Colored pill + dropdown selector for per-person outreach status.
 *
 * Click the pill → choose from `OUTREACH_STATUSES`. On change we call
 * `research.setOutreachStatus` and invalidate the relevant queries so
 * everything reactively updates.
 */
export function OutreachStatusBadge({
  distributorId,
  personId,
  status,
  className,
}: {
  distributorId: string;
  personId: number;
  status: OutreachStatus | undefined | null;
  className?: string;
}) {
  const qc = useQueryClient();
  const current: OutreachStatus = status ?? "new";

  const mut = useMutation({
    mutationFn: (next: OutreachStatus) =>
      research.setOutreachStatus(distributorId, personId, next),
    onSuccess: (res) => {
      toast.success(`Status → ${STATUS_LABELS[res.outreachStatus]}`);
      qc.invalidateQueries({ queryKey: ["person-dossier"] });
      qc.invalidateQueries({ queryKey: ["intel", distributorId] });
    },
    onError: (err: Error) => toast.error(err.message || "Failed to update status"),
  });

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-semibold transition-colors hover:opacity-80 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1 ${STATUS_CLASSES[current]} ${className ?? ""}`}
        disabled={mut.isPending}
      >
        {mut.isPending ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : (
          <span className="h-2 w-2 rounded-full bg-current opacity-80" />
        )}
        <span>{STATUS_LABELS[current]}</span>
        <ChevronDown className="h-3 w-3 opacity-70" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-[170px]">
        <DropdownMenuLabel className="text-[10px] uppercase tracking-wide text-muted-foreground/70">
          Outreach status
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {OUTREACH_STATUSES.map((s) => (
          <DropdownMenuItem
            key={s}
            onSelect={(ev) => {
              ev.preventDefault();
              if (s === current) return;
              mut.mutate(s);
            }}
            className="gap-2 text-sm"
          >
            <span className={`h-2 w-2 rounded-full ${STATUS_DOT[s]}`} />
            <span className="flex-1">{STATUS_LABELS[s]}</span>
            {s === current ? <Check className="h-3.5 w-3.5 text-primary" /> : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

const STATUS_LABELS: Record<OutreachStatus, string> = {
  new: "New",
  contacted: "Contacted",
  replied: "Replied",
  interested: "Interested",
  not_interested: "Not interested",
  bounced: "Bounced",
};

// Pill base classes per status.
const STATUS_CLASSES: Record<OutreachStatus, string> = {
  new: "border-muted-foreground/30 bg-muted/40 text-muted-foreground",
  contacted: "border-blue-400/40 bg-blue-500/10 text-blue-300",
  replied: "border-violet-400/40 bg-violet-500/10 text-violet-300",
  interested: "border-emerald-400/40 bg-emerald-500/10 text-emerald-300",
  not_interested: "border-rose-400/40 bg-rose-500/10 text-rose-300",
  bounced: "border-amber-400/40 bg-amber-500/10 text-amber-300",
};

// Dot color for menu items.
const STATUS_DOT: Record<OutreachStatus, string> = {
  new: "bg-muted-foreground/60",
  contacted: "bg-blue-400",
  replied: "bg-violet-400",
  interested: "bg-emerald-400",
  not_interested: "bg-rose-400",
  bounced: "bg-amber-400",
};
