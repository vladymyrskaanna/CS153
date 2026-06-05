"""End-to-end orchestrator. Runs DISCOVER → ENRICH → SYNTHESIZE → RENDER."""

from __future__ import annotations

import os
import time
from pathlib import Path
from typing import Iterable, Optional

from rich.console import Console
from rich.progress import Progress, SpinnerColumn, TextColumn, TimeElapsedColumn

from .discover import discover
from .enrich import enrich
from .synthesize import DEFAULT_ROLES, synthesize
from .render import render_to_disk
from .. import db
from ..models import Dossier


def run_pipeline(
    url: str,
    *,
    hint: Optional[str] = None,
    roles: Iterable[str] = DEFAULT_ROLES,
    dossier_number: int = 1,
    quiet: bool = False,
    run_id: Optional[int] = None,
) -> tuple[Dossier, Path]:
    """Run the full pipeline. Returns (Dossier, path_to_dir).

    If run_id is provided, progress is written to the run row in the DB so a
    dashboard can poll status.
    """
    console = Console(quiet=quiet)
    t_start = time.time()
    total_cost = 0.0

    # Ensure DB exists and a run row is in place.
    db.init_db()
    if run_id is None:
        run_id = db.create_run(url, pid=os.getpid())
    else:
        db.update_run_pid(run_id, os.getpid())

    try:
        with Progress(
            SpinnerColumn(),
            TextColumn("[progress.description]{task.description}"),
            TimeElapsedColumn(),
            console=console,
            disable=quiet,
        ) as bar:
            # Phase 1
            db.update_run_phase(run_id, "discover")
            t1 = bar.add_task("[bold cyan]Phase 1 · DISCOVER[/] — crawling site", total=None)
            company, people, c_discover = discover(url, hint=hint)
            db.update_run_phase(run_id, "discover", slug=company.slug)
            bar.update(t1, description=f"[bold green]✓ DISCOVER[/] — {company.legal_name} · {len(people)} people")
            bar.stop_task(t1)
            total_cost += c_discover

            # Phase 2
            db.update_run_phase(run_id, "enrich", slug=company.slug)
            t2 = bar.add_task("[bold cyan]Phase 2 · ENRICH[/] — researching family + press + flags", total=None)
            research_data, people, evidence, red_flags, c_enrich = enrich(company, people)
            bar.update(t2, description=f"[bold green]✓ ENRICH[/] — {len(evidence)} evidence · {len(red_flags)} flags")
            bar.stop_task(t2)
            total_cost += c_enrich

            # Phase 3
            db.update_run_phase(run_id, "synthesize", slug=company.slug)
            t3 = bar.add_task("[bold cyan]Phase 3 · SYNTHESIZE[/] — research.md + dossier.html + emails", total=None)
            research_md, dossier_html, emails, c_synth = synthesize(
                company=company, people=people, evidence=evidence,
                red_flags=red_flags, research_data=research_data,
                roles=roles, dossier_number=dossier_number,
            )
            bar.update(t3, description=f"[bold green]✓ SYNTHESIZE[/] — dossier {len(dossier_html):,} chars · {len(emails)} emails")
            bar.stop_task(t3)
            total_cost += c_synth

            # Phase 4
            db.update_run_phase(run_id, "render", slug=company.slug)
            t4 = bar.add_task("[bold cyan]Phase 4 · RENDER[/] — writing files + DB", total=None)
            runtime = time.time() - t_start
            path = render_to_disk(
                company=company, people=people, evidence=evidence, red_flags=red_flags,
                research_data=research_data, research_md=research_md,
                dossier_html=dossier_html, emails=emails,
                runtime_seconds=runtime, cost_usd=total_cost,
            )
            bar.update(t4, description=f"[bold green]✓ RENDER[/] — {path}")
            bar.stop_task(t4)
    except Exception as e:
        db.fail_run(run_id, f"{type(e).__name__}: {e}")
        raise

    runtime = time.time() - t_start
    db.complete_run(run_id, company.slug, runtime, total_cost)

    if not quiet:
        console.print(f"\n[bold green]Done.[/] {company.legal_name} in {runtime:.1f}s · ${total_cost:.4f}")
        console.print(f"[dim]→ {path}[/]")

    dossier = Dossier(
        company=company, people=people, evidence=evidence, red_flags=red_flags,
        research_md=research_md, dossier_html=dossier_html, emails=emails,
        runtime_seconds=runtime, cost_usd=total_cost,
    )
    return dossier, path
