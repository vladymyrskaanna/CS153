import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export function Sparkles({ className, density = 90, color = "hsl(var(--primary))" }: { className?: string; density?: number; color?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });

  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const observer = new ResizeObserver(([entry]) => {
      setSize({ w: entry.contentRect.width, h: entry.contentRect.height });
    });
    observer.observe(c);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const c = ref.current;
    if (!c || !size.w || !size.h) return;
    c.width = size.w;
    c.height = size.h;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    let raf = 0;
    const stars = Array.from({ length: density }).map(() => ({
      x: Math.random() * size.w,
      y: Math.random() * size.h,
      r: Math.random() * 1.2 + 0.3,
      a: Math.random(),
      da: (Math.random() - 0.5) * 0.02,
    }));
    function loop() {
      if (!ctx || !c) return;
      ctx.clearRect(0, 0, c.width, c.height);
      for (const s of stars) {
        s.a += s.da;
        if (s.a < 0 || s.a > 1) s.da = -s.da;
        ctx.fillStyle = color;
        ctx.globalAlpha = Math.max(0, Math.min(1, s.a));
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      raf = requestAnimationFrame(loop);
    }
    loop();
    return () => cancelAnimationFrame(raf);
  }, [size, density, color]);

  return <canvas ref={ref} className={cn("pointer-events-none w-full h-full", className)} />;
}
