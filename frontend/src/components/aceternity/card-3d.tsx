import { createContext, useContext, useRef, useState, type ReactNode, type MouseEvent } from "react";
import { cn } from "@/lib/utils";

const Card3DCtx = createContext<{ mouseEntered: boolean }>({ mouseEntered: false });

export function Card3D({ children, className, containerClassName }: { children: ReactNode; className?: string; containerClassName?: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [mouseEntered, setMouseEntered] = useState(false);

  function handleMouseMove(e: MouseEvent<HTMLDivElement>) {
    if (!containerRef.current) return;
    const { left, top, width, height } = containerRef.current.getBoundingClientRect();
    const x = (e.clientX - left - width / 2) / 25;
    const y = (e.clientY - top - height / 2) / 25;
    containerRef.current.style.transform = `rotateY(${x}deg) rotateX(${-y}deg)`;
  }
  function handleMouseEnter() { setMouseEntered(true); }
  function handleMouseLeave() {
    setMouseEntered(false);
    if (containerRef.current) containerRef.current.style.transform = "rotateY(0deg) rotateX(0deg)";
  }

  return (
    <Card3DCtx.Provider value={{ mouseEntered }}>
      <div className={cn("flex items-center justify-center", containerClassName)} style={{ perspective: "1000px" }}>
        <div
          ref={containerRef}
          onMouseEnter={handleMouseEnter}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          className={cn("relative transition-all duration-200 ease-linear", className)}
          style={{ transformStyle: "preserve-3d" }}
        >
          {children}
        </div>
      </div>
    </Card3DCtx.Provider>
  );
}

export function Card3DBody({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("[transform-style:preserve-3d] [&>*]:[transform-style:preserve-3d]", className)}>{children}</div>;
}

export function Card3DItem({
  as: Tag = "div",
  children,
  className,
  translateZ = 0,
}: {
  as?: "div" | "p" | "span" | "h1" | "h2" | "h3";
  children: ReactNode;
  className?: string;
  translateZ?: number | string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const { mouseEntered } = useContext(Card3DCtx);
  const tz = `translateZ(${typeof translateZ === "number" ? translateZ + "px" : translateZ})`;
  const Component = Tag as React.ElementType;
  return (
    <Component
      ref={ref}
      className={cn("w-fit transition duration-200 ease-linear", className)}
      style={{ transform: mouseEntered ? tz : "translateZ(0)" }}
    >
      {children}
    </Component>
  );
}
