import { useState, type FormEvent } from "react";
import { Sparkles, Loader2 } from "lucide-react";
import { motion } from "motion/react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth-context";
import { Spotlight } from "@/components/aceternity/spotlight";
import { GridBackground, AuroraBackground, Meteors } from "@/components/aceternity/backgrounds";
import { ShimmerButton } from "@/components/aceternity/number-ticker";
import { BackgroundBeams } from "@/components/aceternity/background-beams";

export function LoginPage() {
  const { login } = useAuth();
  const [pending, setPending] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErr(null); setPending(true);
    try {
      const fd = new FormData(e.currentTarget);
      await login(String(fd.get("username") ?? ""), String(fd.get("password") ?? ""));
    } catch (x) {
      setErr(x instanceof Error ? x.message : "Login failed");
    } finally { setPending(false); }
  }

  return (
    <main className="relative min-h-svh w-full overflow-hidden bg-background">
      {/* Layered Aceternity background */}
      <AuroraBackground />
      <BackgroundBeams className="opacity-50" />
      <GridBackground />
      <Spotlight className="-top-40 left-0 md:-top-20 md:left-60" fill="hsl(var(--primary))" />
      <Meteors count={14} />

      <div className="relative z-10 grid place-items-center min-h-svh px-4">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="w-full max-w-md space-y-7"
        >
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="relative">
              <div className="absolute inset-0 rounded-2xl bg-primary/30 blur-2xl" />
              <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary via-primary/80 to-primary/60 text-primary-foreground shadow-[0_0_36px_-6px_hsl(var(--primary))]">
                <Sparkles className="h-6 w-6" />
              </div>
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-b from-foreground to-foreground/70">
                AI Intelligence
              </h1>
              <p className="text-sm text-muted-foreground mt-1">Beverage distributor research & outreach</p>
            </div>
          </div>
          <Card className="border-border/60 bg-card/70 backdrop-blur-xl shadow-[0_0_120px_-32px_hsl(var(--primary)/0.4)]">
            <CardHeader>
              <CardTitle className="text-base">Sign in</CardTitle>
              <CardDescription>Enter your credentials to continue</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={onSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="username">Username</Label>
                  <Input id="username" name="username" required autoFocus autoComplete="username" placeholder="admin" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input id="password" name="password" type="password" required autoComplete="current-password" />
                </div>
                {err ? <p className="text-sm text-destructive border border-destructive/30 bg-destructive/5 rounded-md px-3 py-2">{err}</p> : null}
                <ShimmerButton type="submit" className="w-full">
                  {pending ? <><Loader2 className="h-4 w-4 animate-spin" /> Signing in…</> : "Sign in"}
                </ShimmerButton>
              </form>
            </CardContent>
          </Card>
          <p className="text-center text-xs text-muted-foreground">
            Default: <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px]">admin</code> / <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px]">BeerDist2024!</code>
          </p>
        </motion.div>
      </div>
    </main>
  );
}
