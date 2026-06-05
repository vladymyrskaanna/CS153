import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export function WavyBackground({
  children,
  className,
  containerClassName,
  colors = ["hsl(21 96% 60% / 0.4)", "hsl(265 89% 66% / 0.35)", "hsl(217 91% 60% / 0.30)", "hsl(160 84% 45% / 0.30)"],
  waveWidth = 50,
  blur = 10,
  speed = "slow",
  waveOpacity = 0.5,
}: {
  children?: ReactNode;
  className?: string;
  containerClassName?: string;
  colors?: string[];
  waveWidth?: number;
  blur?: number;
  speed?: "slow" | "fast";
  waveOpacity?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });

  useEffect(() => {
    const handle = () => setSize({ w: window.innerWidth, h: window.innerHeight });
    handle();
    window.addEventListener("resize", handle);
    return () => window.removeEventListener("resize", handle);
  }, []);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c || !size.w || !size.h) return;
    c.width = size.w;
    c.height = size.h;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.filter = `blur(${blur}px)`;
    let nt = 0;
    let raf = 0;
    const speedMult = speed === "fast" ? 0.002 : 0.001;
    const noise = (x: number, y: number, t: number) => Math.sin(x * 0.01 + t) * 50 + Math.cos(y * 0.01 + t * 1.3) * 50;
    function loop() {
      if (!ctx || !c) return;
      nt += speedMult;
      ctx.fillStyle = "transparent";
      ctx.globalAlpha = waveOpacity;
      ctx.clearRect(0, 0, c.width, c.height);
      for (let i = 0; i < colors.length; i++) {
        ctx.beginPath();
        ctx.lineWidth = waveWidth;
        ctx.strokeStyle = colors[i];
        for (let x = 0; x < c.width; x += 5) {
          const y = noise(x / 800, 0.3 * i, nt) + c.height * 0.5;
          ctx.lineTo(x, y);
        }
        ctx.stroke();
        ctx.closePath();
      }
      raf = requestAnimationFrame(loop);
    }
    loop();
    return () => cancelAnimationFrame(raf);
  }, [size, colors, waveWidth, blur, speed, waveOpacity]);

  return (
    <div className={cn("relative w-full overflow-hidden", containerClassName)}>
      <canvas ref={canvasRef} className="absolute inset-0 z-0 pointer-events-none" />
      <div className={cn("relative z-10", className)}>{children}</div>
    </div>
  );
}
