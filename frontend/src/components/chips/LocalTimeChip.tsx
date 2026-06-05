import { useEffect, useState } from "react";
import { Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { getStateLocalTime } from "@/lib/us-timezones";

/**
 * Renders `<state> · <localTime>` for a US state code.
 * Updates every 60s. Returns null if state is empty/unknown.
 */
export function LocalTimeChip({
  state,
  className,
  showIcon = true,
  compact = false,
}: {
  state: string | null | undefined;
  className?: string;
  showIcon?: boolean;
  compact?: boolean;
}) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    // Tick on the next minute boundary, then every 60s.
    const ms = (60 - new Date().getSeconds()) * 1000;
    const first = setTimeout(() => setNow(new Date()), ms);
    const interval = setInterval(() => setNow(new Date()), 60_000);
    return () => {
      clearTimeout(first);
      clearInterval(interval);
    };
  }, []);

  if (!state) return null;
  const time = getStateLocalTime(state, now);
  if (!time) return null;

  const code = state.trim().toUpperCase();

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md border border-border/60 bg-background/40 px-1.5 text-[10px] font-medium text-muted-foreground tabular-nums",
        compact ? "h-5" : "h-6 px-2 text-xs",
        className,
      )}
      title={`Local time in ${code}`}
    >
      {showIcon ? <Clock className="h-3 w-3 opacity-70" /> : null}
      <span className="uppercase tracking-wider text-foreground/70">{code}</span>
      <span className="text-muted-foreground/60">·</span>
      <span className="text-foreground/80">{time}</span>
    </span>
  );
}
