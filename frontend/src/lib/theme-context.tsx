import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Mode = "light" | "dark";
export type Palette = "orange" | "violet" | "blue" | "emerald" | "rose" | "mono";

const PALETTE_PRIMARY_HSL: Record<Palette, string> = {
  orange: "21 96% 60%",
  violet: "265 89% 66%",
  blue: "217 91% 60%",
  emerald: "160 84% 45%",
  rose: "346 87% 58%",
  mono: "240 5% 64%",
};

type Ctx = {
  mode: Mode;
  palette: Palette;
  setMode: (m: Mode) => void;
  setPalette: (p: Palette) => void;
  paletteHsl: string;
};

const ThemeCtx = createContext<Ctx | null>(null);

const LS_MODE = "ai-intelligence.theme.mode";
const LS_PAL = "ai-intelligence.theme.palette";

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<Mode>(() => {
    if (typeof window === "undefined") return "dark";
    return (localStorage.getItem(LS_MODE) as Mode | null) ?? "dark";
  });
  const [palette, setPaletteState] = useState<Palette>(() => {
    if (typeof window === "undefined") return "orange";
    return (localStorage.getItem(LS_PAL) as Palette | null) ?? "orange";
  });

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", mode === "dark");
    root.classList.toggle("light", mode === "light");
    localStorage.setItem(LS_MODE, mode);
  }, [mode]);

  useEffect(() => {
    const root = document.documentElement;
    const hsl = PALETTE_PRIMARY_HSL[palette];
    root.style.setProperty("--primary", hsl);
    root.style.setProperty("--accent", hsl);
    root.style.setProperty("--ring", hsl);
    root.style.setProperty("--sidebar-primary", hsl);
    root.style.setProperty("--sidebar-ring", hsl);
    localStorage.setItem(LS_PAL, palette);
  }, [palette]);

  return (
    <ThemeCtx.Provider value={{ mode, palette, setMode: setModeState, setPalette: setPaletteState, paletteHsl: PALETTE_PRIMARY_HSL[palette] }}>
      {children}
    </ThemeCtx.Provider>
  );
}

export function useTheme() {
  const v = useContext(ThemeCtx);
  if (!v) throw new Error("useTheme outside ThemeProvider");
  return v;
}

export const PALETTES: Palette[] = ["orange", "violet", "blue", "emerald", "rose", "mono"];
