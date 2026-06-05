import { useState, useEffect, type ReactNode } from "react";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";

type Direction = "TOP" | "LEFT" | "BOTTOM" | "RIGHT";

export function HoverBorderGradient({
  children,
  className,
  containerClassName,
  duration = 1.4,
  clockwise = true,
}: {
  children: ReactNode;
  className?: string;
  containerClassName?: string;
  duration?: number;
  clockwise?: boolean;
}) {
  const [hovered, setHovered] = useState(false);
  const [direction, setDirection] = useState<Direction>("TOP");

  const moveDirection = (cur: Direction): Direction => {
    const order: Direction[] = clockwise
      ? ["TOP", "LEFT", "BOTTOM", "RIGHT"]
      : ["TOP", "RIGHT", "BOTTOM", "LEFT"];
    const idx = order.indexOf(cur);
    return order[(idx + 1) % order.length];
  };

  const map: Record<Direction, string> = {
    TOP: "radial-gradient(20.7% 50% at 50% 0%, hsl(var(--primary)) 0%, rgba(255,255,255,0) 100%)",
    LEFT: "radial-gradient(16.6% 43.1% at 0% 50%, hsl(var(--primary)) 0%, rgba(255,255,255,0) 100%)",
    BOTTOM: "radial-gradient(20.7% 50% at 50% 100%, hsl(var(--primary)) 0%, rgba(255,255,255,0) 100%)",
    RIGHT: "radial-gradient(16.2% 41.2% at 100% 50%, hsl(var(--primary)) 0%, rgba(255,255,255,0) 100%)",
  };
  const highlight = "radial-gradient(75% 181.16% at 50% 50%, hsl(var(--primary)) 0%, rgba(255,255,255,0) 100%)";

  useEffect(() => {
    if (hovered) return;
    const t = setInterval(() => setDirection((d) => moveDirection(d)), duration * 1000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hovered, duration, clockwise]);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={cn(
        "relative flex rounded-[inherit] content-center bg-transparent items-center transition duration-500 overflow-visible p-px",
        containerClassName,
      )}
    >
      <div className={cn("w-auto z-10 bg-card rounded-[inherit]", className)}>{children}</div>
      <motion.div
        className="absolute inset-0 rounded-[inherit] z-0"
        style={{ filter: "blur(2px)", position: "absolute" }}
        initial={{ background: map[direction] }}
        animate={{ background: hovered ? [map[direction], highlight] : map[direction] }}
        transition={{ ease: "linear", duration }}
      />
      <div className="bg-card absolute z-1 flex-none inset-[2px] rounded-[calc(var(--radius)-2px)]" />
    </div>
  );
}
