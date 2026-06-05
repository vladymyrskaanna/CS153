import { motion } from "motion/react";
import { type ReactNode } from "react";
import { cn } from "@/lib/utils";

export function BentoGrid({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className={cn("grid grid-cols-1 md:grid-cols-3 gap-4 auto-rows-[14rem]", className)}>
      {children}
    </div>
  );
}

export function BentoCard({
  className,
  span = 1,
  rowSpan = 1,
  children,
}: {
  className?: string;
  span?: 1 | 2 | 3;
  rowSpan?: 1 | 2;
  children: ReactNode;
}) {
  const colSpan = span === 3 ? "md:col-span-3" : span === 2 ? "md:col-span-2" : "md:col-span-1";
  const rowSpanCls = rowSpan === 2 ? "row-span-2" : "row-span-1";
  return (
    <motion.div
      whileHover={{ y: -2 }}
      transition={{ type: "spring", stiffness: 220, damping: 22 }}
      className={cn(
        "relative overflow-hidden rounded-xl border border-border bg-card p-5 group",
        "before:absolute before:inset-0 before:bg-gradient-to-br before:from-primary/5 before:to-transparent before:pointer-events-none before:opacity-0 hover:before:opacity-100 before:transition-opacity",
        colSpan,
        rowSpanCls,
        className,
      )}
    >
      {children}
    </motion.div>
  );
}
