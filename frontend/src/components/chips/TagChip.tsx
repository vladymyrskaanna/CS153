import { Flame, Snowflake, Tag as TagIcon, Thermometer } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { TAG_OPTIONS, type Tag } from "@/lib/api";

const TAG_STYLE: Record<Tag, string> = {
  hot: "border-rose-500/40 bg-rose-500/10 text-rose-300",
  warm: "border-amber-500/40 bg-amber-500/10 text-amber-300",
  cold: "border-sky-500/40 bg-sky-500/10 text-sky-300",
  none: "border-border/60 bg-background/40 text-muted-foreground",
};

const TAG_LABEL: Record<Tag, string> = {
  hot: "Hot",
  warm: "Warm",
  cold: "Cold",
  none: "No tag",
};

function TagIconFor({ tag, className }: { tag: Tag; className?: string }) {
  if (tag === "hot") return <Flame className={className} />;
  if (tag === "warm") return <Thermometer className={className} />;
  if (tag === "cold") return <Snowflake className={className} />;
  return <TagIcon className={className} />;
}

/**
 * TagChip — color-coded chip for hot/warm/cold/none.
 * If `onChange` is provided → dropdown; otherwise read-only.
 */
export function TagChip({
  tag,
  onChange,
  readonly,
  className,
  size = "sm",
}: {
  tag: Tag | undefined | null;
  onChange?: (next: Tag) => void;
  readonly?: boolean;
  className?: string;
  size?: "xs" | "sm";
}) {
  const t = (tag ?? "none") as Tag;
  const style = TAG_STYLE[t];
  const sizeCls = size === "xs"
    ? "h-5 px-1.5 text-[10px] gap-1"
    : "h-6 px-2 text-xs gap-1.5";

  const body = (
    <span
      className={cn(
        "inline-flex items-center rounded-md border font-medium capitalize transition-colors",
        sizeCls,
        style,
        className,
      )}
    >
      <TagIconFor tag={t} className="h-3 w-3" />
      <span>{TAG_LABEL[t]}</span>
    </span>
  );

  if (readonly || !onChange) return body;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
          className="rounded-md focus:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          {body}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className="min-w-[10rem]"
        onClick={(e) => e.stopPropagation()}
      >
        {TAG_OPTIONS.map((opt) => (
          <DropdownMenuItem
            key={opt}
            onClick={(e) => {
              e.stopPropagation();
              if (opt !== t) onChange(opt);
            }}
            className={cn("text-xs", opt === t && "bg-accent/40")}
          >
            <TagIconFor tag={opt} className="h-3 w-3 mr-1" />
            <span className="capitalize">{TAG_LABEL[opt]}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
