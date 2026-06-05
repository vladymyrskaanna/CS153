import { useRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export function GlowingEffect({ children, className, glowClassName }: { children: ReactNode; className?: string; glowClassName?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <div
      ref={ref}
      onMouseMove={(e) => {
        if (!ref.current) return;
        const r = ref.current.getBoundingClientRect();
        ref.current.style.setProperty("--mouse-x", `${e.clientX - r.left}px`);
        ref.current.style.setProperty("--mouse-y", `${e.clientY - r.top}px`);
      }}
      className={cn("relative group rounded-[inherit]", className)}
    >
      <div
        className={cn(
          "pointer-events-none absolute -inset-px rounded-[inherit] opacity-0 group-hover:opacity-100 transition-opacity duration-500",
          glowClassName,
        )}
        style={{
          background: "radial-gradient(600px circle at var(--mouse-x) var(--mouse-y), hsl(var(--primary) / 0.45), transparent 40%)",
        }}
      />
      {children}
    </div>
  );
}
