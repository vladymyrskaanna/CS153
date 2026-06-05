import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export function GridBackground({ className }: { className?: string }) {
  return <div className={cn("absolute inset-0 grid-pattern gradient-mask-radial pointer-events-none", className)} />;
}

export function DotBackground({ className }: { className?: string }) {
  return <div className={cn("absolute inset-0 dot-pattern gradient-mask-radial pointer-events-none", className)} />;
}

export function Meteors({ count = 20, className }: { count?: number; className?: string }) {
  const [items, setItems] = useState<Array<{ left: string; top: string; delay: string; duration: string }>>([]);
  useEffect(() => {
    setItems(
      Array.from({ length: count }).map(() => ({
        left: `${Math.floor(Math.random() * 100)}%`,
        top: `${Math.floor(Math.random() * 80) - 20}%`,
        delay: `${(Math.random() * 0.6).toFixed(2)}s`,
        duration: `${(Math.random() * 8 + 2).toFixed(2)}s`,
      })),
    );
  }, [count]);
  return (
    <div className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)}>
      {items.map((p, i) => (
        <span
          key={i}
          className="animate-meteor absolute left-0 top-0 h-0.5 w-0.5 rotate-[215deg] rounded-full bg-primary shadow-[0_0_0_1px_#ffffff10]"
          style={{ top: p.top, left: p.left, animationDelay: p.delay, animationDuration: p.duration }}
        >
          <span className="absolute -left-px top-1/2 h-px w-[60px] -translate-y-1/2 bg-gradient-to-r from-primary to-transparent" />
        </span>
      ))}
    </div>
  );
}

export function AuroraBackground({ className }: { className?: string }) {
  return (
    <div className={cn("absolute inset-0 overflow-hidden", className)}>
      <div
        className="absolute -top-1/2 left-1/2 -translate-x-1/2 h-[140%] w-[140%] opacity-50 blur-3xl animate-aurora"
        style={{
          background:
            "linear-gradient(120deg, rgba(250,114,46,0.35) 0%, rgba(99,102,241,0.30) 35%, rgba(250,114,46,0.25) 70%, rgba(168,85,247,0.30) 100%)",
          backgroundSize: "200% 200%",
          maskImage: "radial-gradient(ellipse at center, black 30%, transparent 70%)",
        }}
      />
    </div>
  );
}
