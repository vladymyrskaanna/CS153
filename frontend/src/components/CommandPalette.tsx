import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Building2, BarChart3, Settings } from "lucide-react";
import {
  CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator,
} from "@/components/ui/command";

export function CommandPalette({ open, onOpenChange }: { open: boolean; onOpenChange: (b: boolean) => void }) {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") { e.preventDefault(); onOpenChange(!open); }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  function go(path: string) { onOpenChange(false); navigate(path); }

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Search distributors, pages…" value={search} onValueChange={setSearch} />
      <CommandList>
        <CommandEmpty>No results.</CommandEmpty>
        <CommandGroup heading="Navigate">
          <CommandItem onSelect={() => go("/distributors")}><Building2 className="mr-2 h-4 w-4" /> Distributors</CommandItem>
          <CommandItem onSelect={() => go("/dashboard")}><BarChart3 className="mr-2 h-4 w-4" /> Dashboard</CommandItem>
          <CommandItem onSelect={() => go("/settings")}><Settings className="mr-2 h-4 w-4" /> Settings</CommandItem>
        </CommandGroup>
        {search.length >= 2 ? (
          <>
            <CommandSeparator />
            <CommandGroup heading="Quick search">
              <CommandItem onSelect={() => go(`/distributors?q=${encodeURIComponent(search)}`)}>
                <Building2 className="mr-2 h-4 w-4" /> Search distributors for &quot;{search}&quot;
              </CommandItem>
            </CommandGroup>
          </>
        ) : null}
      </CommandList>
    </CommandDialog>
  );
}
