import { useEffect } from "react";
import { motion, stagger, useAnimate } from "motion/react";
import { cn } from "@/lib/utils";

export function TextGenerate({ words, className, duration = 0.5, filter = true }: { words: string; className?: string; duration?: number; filter?: boolean }) {
  const [scope, animate] = useAnimate();
  const list = words.split(" ");

  useEffect(() => {
    animate(
      "span",
      { opacity: 1, filter: filter ? "blur(0px)" : "none" },
      { duration, delay: stagger(0.07) },
    );
  }, [animate, duration, filter]);

  return (
    <motion.span ref={scope} className={cn("inline-block", className)}>
      {list.map((w, i) => (
        <motion.span
          key={`${w}-${i}`}
          className="opacity-0 inline-block"
          style={{ filter: filter ? "blur(8px)" : "none" }}
        >
          {w}{" "}
        </motion.span>
      ))}
    </motion.span>
  );
}
