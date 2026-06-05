import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth-context";
import { initials } from "@/lib/utils";

export function SettingsPage() {
  const { session } = useAuth();
  if (!session) return null;
  return (
    <div className="space-y-5 max-w-2xl mx-auto">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">Profile and workspace</p>
      </div>
      <Card>
        <CardHeader><CardTitle className="text-base">Profile</CardTitle></CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <Avatar className="h-14 w-14"><AvatarFallback className="text-lg bg-primary/10 text-primary font-semibold">{initials(session.name)}</AvatarFallback></Avatar>
            <div className="space-y-1">
              <div className="font-semibold">{session.name}</div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>@{session.username}</span>
                {session.isAdmin ? <Badge variant="default">Admin</Badge> : <Badge variant="secondary">Sales</Badge>}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-base">Stack</CardTitle><CardDescription>This CRM build</CardDescription></CardHeader>
        <CardContent className="space-y-1 text-sm text-muted-foreground">
          <p>Frontend: <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px]">Vite + React + TanStack Query + shadcn/ui</code></p>
          <p>Backend: <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px]">Express + Drizzle + Postgres</code> on port 4041</p>
          <p>Single command: <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px]">pnpm dev</code> runs both via concurrently.</p>
        </CardContent>
      </Card>
    </div>
  );
}
