import { Sun, Moon, Palette as PaletteIcon } from "lucide-react";
import { useTheme, PALETTES, type Palette } from "@/lib/theme-context";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const SWATCH: Record<Palette, string> = {
  orange: "hsl(21 96% 60%)",
  violet: "hsl(265 89% 66%)",
  blue: "hsl(217 91% 60%)",
  emerald: "hsl(160 84% 45%)",
  rose: "hsl(346 87% 58%)",
  mono: "hsl(240 5% 64%)",
};

export function ThemeSwitcher({ compact = false }: { compact?: boolean }) {
  const { mode, setMode, palette, setPalette } = useTheme();

  return (
    <div className={cn("flex items-center gap-1", compact && "gap-0.5")}>
      <Button variant="ghost" size="icon" onClick={() => setMode(mode === "dark" ? "light" : "dark")} title="Toggle theme">
        {mode === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      </Button>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="icon" title="Color palette">
            <PaletteIcon className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-auto p-2">
          <div className="grid grid-cols-6 gap-1.5">
            {PALETTES.map((p) => (
              <button
                key={p}
                title={p}
                onClick={() => setPalette(p)}
                className={cn(
                  "h-7 w-7 rounded-full border-2 transition-transform hover:scale-110",
                  p === palette ? "border-foreground ring-2 ring-foreground/20" : "border-border",
                )}
                style={{ background: SWATCH[p] }}
              />
            ))}
          </div>
          <div className="text-[10px] text-muted-foreground mt-2 text-center capitalize">{palette}</div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
