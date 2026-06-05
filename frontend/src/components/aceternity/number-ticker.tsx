import { useEffect, useRef, useState } from "react";
import { motion, useInView, useSpring, useTransform } from "motion/react";

export function NumberTicker({
  value,
  decimals = 0,
  className,
  prefix = "",
  suffix = "",
}: {
  value: number;
  decimals?: number;
  className?: string;
  prefix?: string;
  suffix?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-100px" });
  const [shown, setShown] = useState(0);
  const spring = useSpring(0, { mass: 0.8, stiffness: 75, damping: 15 });
  const display = useTransform(spring, (n) => Number(n).toFixed(decimals));

  useEffect(() => {
    if (inView) spring.set(value);
  }, [inView, value, spring]);

  useEffect(() => {
    return display.on("change", (v) => setShown(Number(v)));
  }, [display]);

  return (
    <span ref={ref} className={className}>
      {prefix}
      {shown.toLocaleString("en-US", { maximumFractionDigits: decimals, minimumFractionDigits: decimals })}
      {suffix}
    </span>
  );
}

export function ShimmerButton({
  children,
  onClick,
  className = "",
  type = "button",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
  type?: "button" | "submit";
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      className={`relative overflow-hidden rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition active:scale-[0.97] ${className}`}
    >
      <span className="relative z-10 inline-flex items-center gap-2">{children}</span>
      <span
        className="absolute inset-0 -z-0 animate-shimmer"
        style={{
          background:
            "linear-gradient(110deg, transparent 30%, rgba(255,255,255,0.30) 50%, transparent 70%)",
          backgroundSize: "200% 100%",
        }}
      />
    </button>
  );
}
