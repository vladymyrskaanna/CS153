import { useState, type ReactNode, type MouseEvent } from "react";
import { motion, useMotionValue, useMotionTemplate } from "motion/react";
import { cn } from "@/lib/utils";

export function CardSpotlight({
  children,
  className,
  radius = 350,
}: {
  children: ReactNode;
  className?: string;
  radius?: number;
}) {
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const [hovering, setHovering] = useState(false);

  // IMPORTANT: hooks must be called unconditionally on every render.
  // Build the templates once; toggle visibility via opacity below.
  const outerBg = useMotionTemplate`radial-gradient(${radius}px circle at ${mouseX}px ${mouseY}px, hsl(var(--primary) / 0.15), transparent 80%)`;
  const innerBg = useMotionTemplate`radial-gradient(${radius / 2}px circle at ${mouseX}px ${mouseY}px, hsl(var(--primary) / 0.08), transparent 60%)`;

  function onMouseMove({ currentTarget, clientX, clientY }: MouseEvent<HTMLDivElement>) {
    const { left, top } = currentTarget.getBoundingClientRect();
    mouseX.set(clientX - left);
    mouseY.set(clientY - top);
  }

  return (
    <div
      onMouseMove={onMouseMove}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
      className={cn("group relative overflow-hidden rounded-xl border border-border bg-card", className)}
    >
      <motion.div
        className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
        style={{ background: outerBg }}
      />
      <motion.div
        className="pointer-events-none absolute inset-0 transition-opacity duration-200"
        style={{ background: innerBg, opacity: hovering ? 1 : 0 }}
      />
      <div className="relative z-10">{children}</div>
    </div>
  );
}
