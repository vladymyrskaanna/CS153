import { useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { initials, cn } from "@/lib/utils";

/**
 * Company logo avatar for a distributor.
 *
 * Resolves a real brand mark from the distributor's website domain, trying
 * progressively more reliable sources, and finally falling back to the
 * company initials if none load:
 *   1. Google favicon (128px)  — reliably returns the company's icon for a live domain
 *   2. Clearbit Logo API       — higher-res mark when available
 *   3. initials chip           — offline / unknown domain
 *
 * Logos sit on a white rounded tile so colored marks read on the dark theme.
 */
function domainFrom(website?: string | null): string | null {
  if (!website) return null;
  try {
    const u = new URL(website.startsWith("http") ? website : `https://${website}`);
    return u.hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

export function DistributorLogo({
  name,
  website,
  className,
}: {
  name: string;
  website?: string | null;
  className?: string;
}) {
  const domain = domainFrom(website);
  const sources = domain
    ? [
        `https://www.google.com/s2/favicons?domain=${domain}&sz=128`,
        `https://logo.clearbit.com/${domain}?size=128`,
      ]
    : [];
  const [idx, setIdx] = useState(0);
  const src = sources[idx];

  return (
    <Avatar className={cn("rounded-xl ring-1 ring-border/60", className)}>
      {src ? (
        <AvatarImage
          src={src}
          alt={name}
          className="object-contain bg-white p-1"
          onError={() => setIdx((i) => i + 1)}
        />
      ) : null}
      <AvatarFallback className="rounded-xl bg-primary/10 text-primary font-semibold">
        {initials(name)}
      </AvatarFallback>
    </Avatar>
  );
}
