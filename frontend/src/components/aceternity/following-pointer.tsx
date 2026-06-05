import { useState, useRef, useEffect, type ReactNode } from "react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "@/lib/utils";

export function FollowingPointer({ children, label, className }: { children: ReactNode; label?: string; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [hovered, setHovered] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onMove = (e: MouseEvent) => {
      const r = el.getBoundingClientRect();
      setPos({ x: e.clientX - r.left, y: e.clientY - r.top });
    };
    const enter = () => setHovered(true);
    const leave = () => setHovered(false);
    el.addEventListener("mousemove", onMove);
    el.addEventListener("mouseenter", enter);
    el.addEventListener("mouseleave", leave);
    return () => {
      el.removeEventListener("mousemove", onMove);
      el.removeEventListener("mouseenter", enter);
      el.removeEventListener("mouseleave", leave);
    };
  }, []);

  return (
    <div ref={ref} className={cn("relative", className)} style={{ cursor: hovered ? "none" : undefined }}>
      <AnimatePresence>
        {hovered && pos ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.6 }}
            className="absolute pointer-events-none z-50"
            style={{ top: pos.y - 16, left: pos.x - 16 }}
          >
            <svg width="20" height="20" viewBox="0 0 16 16" className="text-primary fill-current">
              <path d="M0 0 L16 6 L8 8 L6 16 Z" />
            </svg>
            {label ? (
              <span className="ml-3 mt-1 inline-block rounded-md bg-primary px-2 py-0.5 text-[11px] font-medium text-primary-foreground whitespace-nowrap">
                {label}
              </span>
            ) : null}
          </motion.div>
        ) : null}
      </AnimatePresence>
      {children}
    </div>
  );
}
