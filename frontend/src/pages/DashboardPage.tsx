import { useQuery } from "@tanstack/react-query";
import { TrendingUp, Building2, Users, Brain, Network } from "lucide-react";
import { motion } from "motion/react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { dashboard } from "@/lib/api";
import { BentoGrid, BentoCard } from "@/components/aceternity/bento-grid";
import { NumberTicker } from "@/components/aceternity/number-ticker";
import { Meteors } from "@/components/aceternity/backgrounds";
import { Sparkles } from "@/components/aceternity/sparkles";
import { TextGenerate } from "@/components/aceternity/text-generate";

export function DashboardPage() {
  const { data, isLoading } = useQuery({ queryKey: ["dashboard"], queryFn: dashboard.stats });

  if (isLoading || !data) {
    return (
      <div className="space-y-6 max-w-7xl mx-auto">
        <div><Skeleton className="h-7 w-44" /><Skeleton className="h-4 w-32 mt-2" /></div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-40" />)}</div>
      </div>
    );
  }

  const coverage = Math.round((data.researched / Math.max(data.distributors, 1)) * 100);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="relative isolate overflow-hidden rounded-xl border border-border bg-card p-6">
        <div className="absolute inset-0 -z-10 opacity-60"><Sparkles density={70} /></div>
        <h1 className="text-3xl font-semibold tracking-tight bg-clip-text text-transparent bg-gradient-to-b from-foreground to-foreground/70">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1"><TextGenerate words="Research overview · live data" /></p>
      </motion.div>

      <BentoGrid className="md:grid-cols-4">
        <BentoCard span={2} className="overflow-hidden relative">
          <Meteors count={6} className="opacity-50" />
          <div className="relative">
            <div className="text-xs uppercase tracking-wider text-muted-foreground/80 font-medium">Total distributors</div>
            <div className="text-5xl font-bold tabular-nums tracking-tight mt-2 text-gradient-primary animate-shimmer">
              <NumberTicker value={data.distributors} />
            </div>
            <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
              <Building2 className="h-4 w-4" />
              <span>Across the database</span>
              <Badge variant="outline" className="ml-auto gap-1 text-xs"><TrendingUp className="size-3" /> live</Badge>
            </div>
          </div>
        </BentoCard>

        <BentoCard span={2}>
          <div className="text-xs uppercase tracking-wider text-muted-foreground/80 font-medium">AI-researched</div>
          <div className="text-3xl font-bold tabular-nums mt-2"><NumberTicker value={data.researched} /></div>
          <div className="text-sm text-muted-foreground mt-1 flex items-center gap-1.5">
            <Brain className="h-3.5 w-3.5" /> <NumberTicker value={coverage} suffix="%" /> have a generated dossier
          </div>
          <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <motion.div className="h-full bg-gradient-to-r from-primary to-primary/60" initial={{ width: 0 }} animate={{ width: `${coverage}%` }} transition={{ duration: 1.2, ease: "easeOut" }} />
          </div>
        </BentoCard>

        <BentoCard span={2}>
          <div className="text-xs uppercase tracking-wider text-muted-foreground/80 font-medium">People in org charts</div>
          <div className="text-3xl font-bold tabular-nums mt-2 text-gradient-primary animate-shimmer"><NumberTicker value={data.contacts} /></div>
          <div className="text-sm text-muted-foreground mt-1 flex items-center gap-1.5"><Users className="h-3.5 w-3.5" /> decision-makers mapped across distributors</div>
        </BentoCard>

        <BentoCard span={2}>
          <div className="text-xs uppercase tracking-wider text-muted-foreground/80 font-medium">With an org chart</div>
          <div className="text-3xl font-bold tabular-nums mt-2"><NumberTicker value={data.withContacts} /></div>
          <div className="text-sm text-muted-foreground mt-1 flex items-center gap-1.5"><Network className="h-3.5 w-3.5" /> distributors with mapped people</div>
        </BentoCard>
      </BentoGrid>
    </div>
  );
}
