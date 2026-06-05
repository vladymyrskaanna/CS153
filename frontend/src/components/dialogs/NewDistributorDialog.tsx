import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Loader2, Sparkles } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { distributors as api, research } from "@/lib/api";

// Normalize a pasted website into a proper URL + a readable display name.
function normalizeUrl(raw: string): string {
  const t = raw.trim();
  if (!t) return "";
  return /^https?:\/\//i.test(t) ? t : `https://${t}`;
}
function nameFromUrl(url: string): string {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    const label = host.split(".")[0] || host;
    return label.charAt(0).toUpperCase() + label.slice(1);
  } catch {
    return url.replace(/^https?:\/\//, "").replace(/^www\./, "").split(/[./]/)[0] || "New distributor";
  }
}

export function NewDistributorDialog() {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const navigate = useNavigate();
  const qc = useQueryClient();

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    try {
      const fd = new FormData(e.currentTarget);
      const url = normalizeUrl(String(fd.get("website") ?? ""));
      if (!url) {
        toast.error("Paste a website URL");
        return;
      }
      // 1) Create the distributor shell keyed on the website.
      const { id } = await api.create({ name: nameFromUrl(url), website: url });
      // 2) Kick off the AI research pipeline — it fills the dossier, org chart,
      //    sources, facts, flags and drafts the outreach emails.
      try {
        await research.enqueue(url, id);
        toast.success("Researching — the AI is building the dossier…");
      } catch {
        toast.success("Distributor added (start research from its page)");
      }
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["distributors"] });
      navigate(`/distributors/${id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm"><Plus className="h-4 w-4" /> New distributor</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Research a distributor</DialogTitle>
          <DialogDescription>
            Paste a website — the AI agent researches the company and fills in the dossier,
            org chart, sources and outreach emails automatically.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="d-website">Company website</Label>
            <Input id="d-website" name="website" autoFocus required placeholder="saratogaeagle.com" inputMode="url" />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={pending}>Cancel</Button>
            <Button type="submit" disabled={pending}>
              {pending ? <><Loader2 className="h-4 w-4 animate-spin" /> Starting…</> : <><Sparkles className="h-4 w-4" /> Research</>}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
