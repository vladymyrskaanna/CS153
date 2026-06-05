import { useState, type ReactNode } from "react";
import { motion, AnimatePresence, useMotionValue, useSpring, useTransform } from "motion/react";

export function AnimatedTooltip({ children, label }: { children: ReactNode; label: string }) {
  const [hovered, setHovered] = useState(false);
  const x = useMotionValue(0);
  const rotate = useSpring(useTransform(x, [-100, 100], [-15, 15]), { stiffness: 100, damping: 5 });
  const translateX = useSpring(useTransform(x, [-100, 100], [-30, 30]), { stiffness: 100, damping: 5 });

  return (
    <span
      className="relative inline-flex"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onMouseMove={(e) => x.set((e.nativeEvent as MouseEvent).offsetX - 50)}
    >
      <AnimatePresence>
        {hovered && (
          <motion.span
            initial={{ opacity: 0, y: 6, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1, transition: { type: "spring", stiffness: 260, damping: 16 } }}
            exit={{ opacity: 0, y: 4, scale: 0.95 }}
            style={{ rotate, x: translateX }}
            className="absolute -top-9 left-1/2 -translate-x-1/2 z-50 flex items-center justify-center rounded-md bg-foreground text-background px-2.5 py-1 text-[11px] font-medium shadow-md whitespace-nowrap"
          >
            <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 h-2 w-2 rotate-45 bg-foreground" />
            {label}
          </motion.span>
        )}
      </AnimatePresence>
      {children}
    </span>
  );
}
