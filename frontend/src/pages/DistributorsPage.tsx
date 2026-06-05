import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Search, Globe, Phone, MapPin, Map, Users, Building2, X } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { distributors as api, type DistributorRow } from "@/lib/api";
import { cn, fmt } from "@/lib/utils";
import { NewDistributorDialog } from "@/components/dialogs/NewDistributorDialog";
import { CardSpotlight } from "@/components/aceternity/card-spotlight";
import { LocalTimeChip } from "@/components/chips/LocalTimeChip";
import { DistributorLogo } from "@/components/DistributorLogo";

export function DistributorsPage() {
  const [sp, setSp] = useSearchParams();
  const [q, setQ] = useState(sp.get("q") ?? "");

  const params = useMemo(() => {
    const p = new URLSearchParams();
    if (sp.get("q")) p.set("q", sp.get("q")!);
    if (sp.get("sort")) p.set("sort", sp.get("sort")!);
    p.set("limit", "50");
    p.set("page", String(Math.max(1, Number(sp.get("page") ?? 1))));
    return p;
  }, [sp]);

  const { data, isLoading } = useQuery({
    queryKey: ["distributors", params.toString()],
    queryFn: () => api.list(params),
  });

  function onSearch(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const next = new URLSearchParams(sp);
    if (q.trim()) next.set("q", q.trim()); else next.delete("q");
    next.delete("page");
    setSp(next);
  }

  function setKey(key: string, value: string | null) {
    const next = new URLSearchParams(sp);
    if (value == null) next.delete(key);
    else next.set(key, value);
    if (key !== "page") next.delete("page");
    setSp(next);
  }

  // Persist current list URL so DistributorDetailPage's "All distributors" back
  // button can restore exactly where the user was.
  useEffect(() => {
    const params = sp.toString();
    const url = params ? `/distributors?${params}` : "/distributors";
    try { localStorage.setItem("distributorsLastUrl", url); } catch {}
  }, [sp]);

  return (
    <div className="space-y-5 max-w-7xl mx-auto">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div className="space-y-1">
          <h1 className="text-3xl font-semibold tracking-tight bg-clip-text text-transparent bg-gradient-to-b from-foreground to-foreground/60">
            Distributors
          </h1>
          <p className="text-sm text-muted-foreground flex items-center gap-2">
            <span className="font-semibold text-foreground tabular-nums">{data ? fmt(data.total) : "…"}</span>
            <span>total</span>
            <span className="text-muted-foreground/40">·</span>
            <span className="inline-flex items-center gap-1 text-xs">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-60 animate-ping" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
              </span>
              live
            </span>
          </p>
        </div>
        <NewDistributorDialog />
      </div>

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <form onSubmit={onSearch} className="relative flex-1 min-w-[14rem]">
              <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name, city, state, website…" className="pl-9 h-10" />
            </form>
            <Select value={sp.get("sort") ?? "name"} onValueChange={(v) => setKey("sort", v === "name" ? null : v)}>
              <SelectTrigger className="w-[190px] h-10"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="name">Sort: Name</SelectItem>
                <SelectItem value="recent">Sort: Recent activity</SelectItem>
                <SelectItem value="contacts">Sort: Org-chart size</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {sp.get("q") ? (
            <div className="flex flex-wrap gap-1.5 items-center pt-2 border-t">
              <Chip onRemove={() => { setQ(""); setKey("q", null); }}>{`"${sp.get("q")}"`}</Chip>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-44" />)}
        </div>
      ) : !data?.rows.length ? (
        <Card><CardContent className="p-12 text-center"><p className="text-muted-foreground">No distributors match your search.</p></CardContent></Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {data.rows.map((r) => <DistributorCard key={r.id} r={r} />)}
        </div>
      )}

      {data && data.total > 50 ? (
        <Pager page={Number(sp.get("page") ?? 1)} total={data.total} onChange={(p) => setKey("page", String(p))} />
      ) : null}
    </div>
  );
}

function DistributorCard({ r }: { r: DistributorRow }) {
  const states = r.states ?? [];
  const phones = (r.phone ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const cleanWeb = r.website?.replace(/^https?:\/\//, "").replace(/\/$/, "");

  return (
    <Link to={`/distributors/${r.id}`} className="group block h-full">
      <CardSpotlight className="h-full flex flex-col transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-[0_0_0_1px_hsl(var(--primary)/0.2),0_8px_24px_-12px_hsl(var(--primary)/0.4)]">
        <div className="p-5 space-y-4">
          {/* Header: avatar + title */}
          <div className="flex items-start gap-3">
            <div className="relative shrink-0">
              <div className="absolute inset-0 rounded-lg bg-primary/30 blur-md opacity-0 group-hover:opacity-100 transition-opacity" />
              <DistributorLogo name={r.name} website={r.website} className="relative h-10 w-10 rounded-lg" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-medium text-[14px] tracking-tight leading-snug line-clamp-2 uppercase group-hover:text-primary transition-colors">
                {r.name}
              </h3>
            </div>
          </div>

          {/* Stat row: states · people (org chart) · branches */}
          <div className="grid grid-cols-3 gap-1.5">
            <Metric icon={<Map className="h-3 w-3" />} value={fmt(states.length)} label={states.length === 1 ? "state" : "states"} active={states.length > 0} />
            <Metric icon={<Users className="h-3 w-3" />} value={fmt(r.contactCount)} label={r.contactCount === 1 ? "person" : "people"} active={r.contactCount > 0} highlight={r.contactCount > 0} />
            <Metric icon={<Building2 className="h-3 w-3" />} value={fmt(r.branchCount)} label={r.branchCount === 1 ? "branch" : "branches"} active={r.branchCount > 0} />
          </div>

          {/* Distributor contact details */}
          {phones.length || cleanWeb || r.city || r.state ? (
            <div className="space-y-1.5 text-xs">
              {phones.length ? (
                <div className="flex items-start gap-2 text-muted-foreground">
                  <Phone className="h-3.5 w-3.5 shrink-0 mt-0.5 opacity-60" />
                  <span className="text-foreground/80 line-clamp-1 font-medium tabular-nums">
                    {phones[0]}{phones.length > 1 ? <span className="text-muted-foreground/60 font-normal"> · +{phones.length - 1} more</span> : null}
                  </span>
                </div>
              ) : null}
              {cleanWeb ? (
                <div className="flex items-center gap-2 truncate text-muted-foreground">
                  <Globe className="h-3.5 w-3.5 shrink-0 opacity-60" />
                  <span className="text-foreground/80 truncate">{cleanWeb}</span>
                </div>
              ) : null}
              {r.city || r.state ? (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <MapPin className="h-3.5 w-3.5 shrink-0 opacity-60" />
                  <span className="text-foreground/70">{[r.city, r.state].filter(Boolean).join(", ")}</span>
                </div>
              ) : null}
            </div>
          ) : null}

          {/* Local time + AI chips */}
          {r.state || r.aiProcessed ? (
            <div className="flex flex-wrap items-center gap-1.5">
              {r.state ? <LocalTimeChip state={r.state} compact /> : null}
              {r.aiProcessed ? (
                <span
                  className="inline-flex items-center gap-1 rounded-md border border-violet-500/40 bg-violet-500/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-violet-300"
                  title="AI dossier generated"
                >
                  AI
                </span>
              ) : null}
            </div>
          ) : null}

          {/* States — subtle outline tags */}
          {states.length > 0 ? (
            <div className="flex flex-wrap gap-1 pt-1">
              {states.slice(0, 5).map((s) => (
                <span key={s} className="inline-flex items-center rounded-md border border-border/80 bg-background/60 px-1.5 py-0.5 text-[10px] font-medium text-foreground/80 tracking-wider uppercase">{s}</span>
              ))}
              {states.length > 5 ? <span className="inline-flex items-center rounded-md border border-border/80 bg-background/60 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground tracking-wider">+{states.length - 5}</span> : null}
            </div>
          ) : null}
        </div>
      </CardSpotlight>
    </Link>
  );
}

function Metric({ icon, value, label, active, highlight }: { icon: React.ReactNode; value: string; label: string; active: boolean; highlight?: boolean }) {
  return (
    <div
      className={cn(
        "rounded-md border px-2 py-1.5 min-w-0 overflow-hidden transition-colors",
        active
          ? highlight
            ? "border-primary/30 bg-primary/5"
            : "border-border bg-background/40"
          : "border-border/40 bg-background/20",
      )}
    >
      <div className="flex items-baseline gap-1.5">
        <span className={cn("shrink-0", highlight ? "text-primary" : active ? "text-muted-foreground" : "text-muted-foreground/50")}>{icon}</span>
        <span className={cn("text-[15px] font-semibold tabular-nums leading-tight truncate", active ? (highlight ? "text-primary" : "text-foreground") : "text-muted-foreground/40")}>
          {value}
        </span>
      </div>
      <div className={cn("text-[9px] uppercase tracking-wide truncate mt-0.5", active ? "text-muted-foreground" : "text-muted-foreground/50")}>
        {label}
      </div>
    </div>
  );
}

function Chip({ children, onRemove }: { children: React.ReactNode; onRemove: () => void }) {
  return (
    <button onClick={onRemove} className="inline-flex items-center gap-1 rounded-full bg-secondary text-secondary-foreground px-2 py-0.5 text-xs hover:bg-secondary/80">
      {children}<X className="h-3 w-3" />
    </button>
  );
}

function Pager({ page, total, onChange }: { page: number; total: number; onChange: (p: number) => void }) {
  const totalPages = Math.max(1, Math.ceil(total / 50));
  return (
    <div className="flex justify-between items-center text-sm text-muted-foreground">
      <span>Page {fmt(page)} of {fmt(totalPages)}</span>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onChange(page - 1)}>Previous</Button>
        <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => onChange(page + 1)}>Next</Button>
      </div>
    </div>
  );
}
