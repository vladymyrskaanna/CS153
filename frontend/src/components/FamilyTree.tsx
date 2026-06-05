import { useMemo, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  type Node,
  type Edge,
  type NodeMouseHandler,
  Handle,
  Position,
  useNodesState,
  useEdgesState,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import dagre from "@dagrejs/dagre";
import { Linkedin, Mail, Heart, Crown } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { cn, initials } from "@/lib/utils";
import { useTheme } from "@/lib/theme-context";
import type { FamilyTree as FamilyTreeData, IntelPerson } from "@/lib/api";

const NODE_W = 240;
const NODE_H = 92;
const COUPLE_W = 380; // wider node when rendering a married pair

type FamilyNodeData = {
  primary: IntelPerson & { isFamilyMember?: boolean };
  spouse: (IntelPerson & { isFamilyMember?: boolean }) | null;
};

function FamilyNode({ data }: { data: FamilyNodeData }) {
  const { primary, spouse } = data;
  const decisionMaker = primary.isDecisionMaker || spouse?.isDecisionMaker;
  const isFamily = primary.isFamilyMember || spouse?.isFamilyMember;

  return (
    <div className={cn(
      "relative rounded-xl border bg-card backdrop-blur-sm transition-all cursor-pointer hover:scale-[1.02] hover:shadow-lg",
      // Family members: distinct amber/gold outline. Non-family: muted.
      isFamily
        ? decisionMaker
          ? "border-amber-400/70 shadow-[0_0_24px_-8px_rgb(251_191_36_/_0.55),inset_0_0_0_1px_rgb(251_191_36_/_0.3)] hover:border-amber-300"
          : "border-amber-400/40 shadow-sm hover:border-amber-300/60"
        : decisionMaker
          ? "border-primary/60 shadow-[0_0_20px_-10px_hsl(var(--primary)/0.6)] hover:border-primary/80"
          : "border-border shadow-sm hover:border-primary/40",
      spouse ? "px-3 py-2" : "px-3 py-2",
    )}>
      {isFamily ? (
        <span className="absolute -top-2 left-3 px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wider bg-amber-400/15 text-amber-300 border border-amber-400/30">
          Family
        </span>
      ) : null}
      <Handle type="target" position={Position.Top} className="!bg-border !border-0 !w-1 !h-1" />
      <Handle type="source" position={Position.Bottom} className="!bg-border !border-0 !w-1 !h-1" />

      <div className={cn("flex items-stretch gap-2", spouse && "divide-x divide-border")}>
        <PersonCell person={primary} highlight={!!decisionMaker} />
        {spouse ? (
          <>
            <div className="flex items-center px-1.5 text-rose-400" aria-hidden>
              <Heart className="h-3 w-3 fill-current" />
            </div>
            <PersonCell person={spouse} highlight={!!decisionMaker} />
          </>
        ) : null}
      </div>
    </div>
  );
}

function PersonCell({ person, highlight }: { person: IntelPerson; highlight: boolean }) {
  return (
    <div className="flex items-center gap-2 min-w-0 flex-1 px-1">
      <div className={cn(
        "relative shrink-0 h-9 w-9 rounded-lg overflow-hidden grid place-items-center text-sm font-semibold ring-1 ring-inset",
        highlight && person.isDecisionMaker
          ? "bg-gradient-to-br from-primary via-primary/80 to-primary/60 text-primary-foreground ring-primary/40"
          : person.isDeceased
            ? "bg-muted text-muted-foreground/70 ring-border opacity-70"
            : "bg-secondary text-secondary-foreground ring-border",
      )}>
        {person.photoUrl ? (
          <img
            src={person.photoUrl}
            alt={person.fullName}
            className="absolute inset-0 h-full w-full object-cover"
            referrerPolicy="no-referrer"
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
          />
        ) : null}
        <span className={cn("relative", person.photoUrl ? "sr-only" : "")}>{initials(person.fullName)}</span>
        {person.isDecisionMaker ? (
          <span className="absolute -top-1 -right-1 h-3.5 w-3.5 rounded-full bg-primary text-primary-foreground grid place-items-center shadow z-10">
            <Crown className="h-2 w-2" />
          </span>
        ) : null}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <div className="text-[12px] font-medium leading-tight truncate text-foreground">{person.fullName}</div>
          {person.isDeceased ? <span className="text-[9px] text-muted-foreground/70 uppercase">{person.deathYear ?? "†"}</span> : null}
        </div>
        <div className="text-[10px] uppercase tracking-wide text-muted-foreground truncate mt-0.5">{person.title || (person.generation ? `Gen ${person.generation}` : "—")}</div>
        {person.linkedinUrl || person.email ? (
          <div className="flex gap-2 mt-0.5 text-muted-foreground/70">
            {person.linkedinUrl ? <Linkedin className="h-2.5 w-2.5" /> : null}
            {person.email ? <Mail className="h-2.5 w-2.5" /> : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

const nodeTypes = { family: FamilyNode };

function layout(nodes: Node[], edges: Edge[]): Node[] {
  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: "TB", ranksep: 80, nodesep: 50, edgesep: 24 });
  g.setDefaultEdgeLabel(() => ({}));
  for (const n of nodes) {
    const data = n.data as { spouse?: IntelPerson | null };
    g.setNode(n.id, { width: data?.spouse ? COUPLE_W : NODE_W, height: NODE_H });
  }
  for (const e of edges) g.setEdge(e.source, e.target);
  dagre.layout(g);
  return nodes.map((n) => {
    const pos = g.node(n.id);
    const data = n.data as { spouse?: IntelPerson | null };
    const w = data?.spouse ? COUPLE_W : NODE_W;
    return { ...n, position: { x: pos.x - w / 2, y: pos.y - NODE_H / 2 }, width: w, height: NODE_H };
  });
}

export function FamilyTreePanel({ tree, loading }: { tree: FamilyTreeData | undefined; loading: boolean }) {
  const navigate = useNavigate();
  const { id: distributorId } = useParams<{ id: string }>();
  const { initialNodes, initialEdges } = useMemo(() => {
    if (!tree?.nodes.length) return { initialNodes: [] as Node[], initialEdges: [] as Edge[] };
    const byId = new Map(tree.nodes.map((p) => [p.id, p]));

    // Pair up spouses — one node per couple, second person hidden if rendered alongside
    const renderedAs = new Map<number, number>(); // personId → groupNodeId (primary's id)
    const groups: Array<{ primary: IntelPerson; spouse: IntelPerson | null }> = [];
    for (const p of tree.nodes) {
      if (renderedAs.has(p.id)) continue;
      const spouse = p.spouseId ? byId.get(p.spouseId) ?? null : null;
      // primary = the one with higher decision-maker priority, then earlier id
      let primary = p;
      let secondary = spouse;
      if (spouse && spouse.isDecisionMaker && !p.isDecisionMaker) {
        primary = spouse;
        secondary = p;
      } else if (spouse && spouse.id < p.id && !p.isDecisionMaker) {
        primary = spouse;
        secondary = p;
      }
      groups.push({ primary, spouse: secondary });
      renderedAs.set(primary.id, primary.id);
      if (secondary) renderedAs.set(secondary.id, primary.id);
    }

    const nodes: Node[] = groups.map((g) => ({
      id: String(g.primary.id),
      type: "family",
      position: { x: 0, y: 0 },
      data: g as unknown as Record<string, unknown>,
      draggable: false,
    }));

    const edges: Edge[] = [];
    for (const link of tree.links) {
      const parentGroupId = renderedAs.get(link.parentId);
      const childGroupId = renderedAs.get(link.childId);
      if (!parentGroupId || !childGroupId || parentGroupId === childGroupId) continue;
      edges.push({
        id: `e-${link.parentId}-${link.childId}`,
        source: String(parentGroupId),
        target: String(childGroupId),
        type: "smoothstep",
        animated: false,
        style: { stroke: "hsl(var(--border))", strokeWidth: 1.5 },
      });
    }

    return { initialNodes: layout(nodes, edges), initialEdges: edges };
  }, [tree]);

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>(initialNodes);
  const [edges, , onEdgesChange] = useEdgesState<Edge>(initialEdges);
  const { mode } = useTheme();

  useEffect(() => { setNodes(initialNodes); }, [initialNodes, setNodes]);

  if (loading) return <Skeleton className="h-[520px]" />;
  if (!tree?.nodes.length) {
    return <Card><CardContent className="p-12 text-center text-sm text-muted-foreground">No org chart data yet.</CardContent></Card>;
  }

  return (
    <Card>
      <CardContent className="p-0">
        <div className="h-[600px] w-full rounded-[inherit] overflow-hidden bg-gradient-to-b from-background to-muted/30">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            nodeTypes={nodeTypes}
            fitView
            fitViewOptions={{ padding: 0.2 }}
            minZoom={0.4}
            maxZoom={1.6}
            proOptions={{ hideAttribution: true }}
            colorMode={mode}
            onNodeClick={((_evt, node) => {
              const data = node.data as { primary?: IntelPerson };
              if (distributorId && data.primary?.id != null) {
                navigate(`/distributors/${distributorId}/people/${data.primary.id}`);
              }
            }) as NodeMouseHandler}
            nodesDraggable={false}
          >
            <Background gap={24} size={1} color="hsl(var(--border))" />
            <Controls className="!bg-card !border !border-border !rounded-md !shadow [&>button]:!bg-card [&>button]:!border-border [&>button:hover]:!bg-muted [&>button>svg]:!fill-muted-foreground" />
            <MiniMap
              pannable zoomable
              className="!bg-card !border !border-border !rounded-md"
              nodeColor={(n) => {
                const d = n.data as { primary?: IntelPerson };
                return d?.primary?.isDecisionMaker ? "hsl(var(--primary))" : "hsl(var(--muted-foreground) / 0.4)";
              }}
            />
          </ReactFlow>
        </div>
      </CardContent>
    </Card>
  );
}
