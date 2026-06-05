import { useQuery } from "@tanstack/react-query";
import { UserCircle2 } from "lucide-react";
import { cn, initials } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { users, type SystemUser } from "@/lib/api";

/**
 * OwnerChip — avatar (initials) + name. If `onChange` is provided, clicking
 * opens a dropdown of system users (loaded lazily). Null owner → "Unassigned".
 */
export function OwnerChip({
  ownerUsername,
  onChange,
  readonly,
  className,
  size = "sm",
}: {
  ownerUsername: string | null | undefined;
  onChange?: (next: string | null) => void;
  readonly?: boolean;
  className?: string;
  size?: "xs" | "sm";
}) {
  const isUnassigned = !ownerUsername;

  // Lazy-load user list once a chip with onChange is rendered.
  const usersQ = useQuery({
    queryKey: ["system-users"],
    queryFn: () => users.list(),
    enabled: !!onChange && !readonly,
    staleTime: 5 * 60_000,
  });

  // Find pretty name; fall back to the username itself.
  const matched = usersQ.data?.find((u) => u.username === ownerUsername);
  const displayName = matched?.name ?? (ownerUsername ?? "Unassigned");

  const avatarSize = size === "xs" ? "h-4 w-4 text-[8px]" : "h-5 w-5 text-[9px]";
  const padding = size === "xs" ? "h-5 px-1.5 text-[10px] gap-1" : "h-6 px-2 text-xs gap-1.5";

  const body = (
    <span
      className={cn(
        "inline-flex items-center rounded-md border font-medium transition-colors",
        padding,
        isUnassigned
          ? "border-border/40 bg-background/30 text-muted-foreground/70"
          : "border-border/60 bg-background/40 text-foreground/85",
        className,
      )}
    >
      <span
        className={cn(
          "shrink-0 rounded-full grid place-items-center font-semibold",
          avatarSize,
          isUnassigned
            ? "bg-muted text-muted-foreground/60"
            : "bg-primary/15 text-primary",
        )}
      >
        {isUnassigned ? <UserCircle2 className="h-3 w-3" /> : initials(displayName)}
      </span>
      <span className="truncate max-w-[10rem]">{isUnassigned ? "Unassigned" : displayName}</span>
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
        className="min-w-[12rem] max-h-[18rem] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <DropdownMenuItem
          onClick={(e) => {
            e.stopPropagation();
            if (!isUnassigned) onChange(null);
          }}
          className={cn("text-xs", isUnassigned && "bg-accent/40")}
        >
          <span className="h-5 w-5 rounded-full bg-muted grid place-items-center mr-1 text-muted-foreground/60">
            <UserCircle2 className="h-3 w-3" />
          </span>
          Unassigned
        </DropdownMenuItem>
        {usersQ.data?.length ? <DropdownMenuSeparator /> : null}
        {usersQ.isLoading ? (
          <div className="px-2 py-1 text-xs text-muted-foreground">Loading…</div>
        ) : usersQ.data?.length ? (
          usersQ.data.map((u: SystemUser) => (
            <DropdownMenuItem
              key={u.username}
              onClick={(e) => {
                e.stopPropagation();
                if (u.username !== ownerUsername) onChange(u.username);
              }}
              className={cn("text-xs", u.username === ownerUsername && "bg-accent/40")}
            >
              <span className="h-5 w-5 rounded-full bg-primary/15 text-primary grid place-items-center text-[9px] font-semibold mr-1">
                {initials(u.name)}
              </span>
              <span className="truncate">{u.name}</span>
              {u.isAdmin ? <span className="ml-auto text-[9px] uppercase tracking-wider text-muted-foreground">admin</span> : null}
            </DropdownMenuItem>
          ))
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
