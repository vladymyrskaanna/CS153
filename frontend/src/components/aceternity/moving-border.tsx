import { useRef, type ReactNode } from "react";
import { motion, useAnimationFrame, useMotionTemplate, useMotionValue, useTransform } from "motion/react";
import { cn } from "@/lib/utils";

export function MovingBorder({
  children,
  duration = 3000,
  rx = "30%",
  ry = "30%",
  className,
}: {
  children: ReactNode;
  duration?: number;
  rx?: string;
  ry?: string;
  className?: string;
}) {
  const pathRef = useRef<SVGRectElement>(null);
  const progress = useMotionValue(0);

  useAnimationFrame((t) => {
    const length = pathRef.current?.getTotalLength?.() ?? 1;
    const pxPerMillisecond = length / duration;
    progress.set((t * pxPerMillisecond) % length);
  });

  const x = useTransform(progress, (v) => pathRef.current?.getPointAtLength(v).x ?? 0);
  const y = useTransform(progress, (v) => pathRef.current?.getPointAtLength(v).y ?? 0);
  const transform = useMotionTemplate`translateX(${x}px) translateY(${y}px) translateX(-50%) translateY(-50%)`;

  return (
    <>
      <svg className="absolute h-full w-full" width="100%" height="100%" preserveAspectRatio="none">
        <rect fill="none" width="100%" height="100%" rx={rx} ry={ry} ref={pathRef} />
      </svg>
      <motion.div className={cn("absolute top-0 left-0 inline-block h-20 w-20", className)} style={{ transform }}>
        {children}
      </motion.div>
    </>
  );
}

export function MovingBorderButton({
  children,
  className,
  containerClassName,
  borderRadius = "0.75rem",
  duration = 3000,
  onClick,
  type = "button",
  disabled,
}: {
  children: ReactNode;
  className?: string;
  containerClassName?: string;
  borderRadius?: string;
  duration?: number;
  onClick?: () => void;
  type?: "button" | "submit";
  disabled?: boolean;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "relative overflow-hidden bg-transparent p-px text-sm disabled:opacity-50",
        containerClassName,
      )}
      style={{ borderRadius }}
    >
      <div className="absolute inset-0">
        <MovingBorder duration={duration} rx="30%" ry="30%">
          <div className="h-20 w-20 opacity-90 bg-[radial-gradient(hsl(var(--primary))_40%,transparent_60%)]" />
        </MovingBorder>
      </div>
      <div
        className={cn(
          "relative flex h-full w-full items-center justify-center backdrop-blur-xl bg-card/70 text-foreground antialiased px-4 py-2",
          className,
        )}
        style={{ borderRadius: `calc(${borderRadius} * 0.96)` }}
      >
        {children}
      </div>
    </button>
  );
}
