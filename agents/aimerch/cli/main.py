"""CLI entry point."""

from __future__ import annotations

import json
import sys
import time
from pathlib import Path

import click
from rich.console import Console
from rich.table import Table

from .. import db
from ..config import DOSSIERS_DIR
from ..models import Company, Evidence, Person, RedFlag
from ..pipeline.agentic import run_agentic_pipeline
from ..pipeline.orchestrator import run_pipeline
from ..pipeline.render import render_to_disk
from ..pipeline.synthesize import DEFAULT_ROLES, synthesize


console = Console()


@click.group()
def cli() -> None:
    """AI Intelligence Outreach — research distributors and draft personalized emails."""


@cli.command("research")
@click.argument("url")
@click.option("--hint", help="Extra context (e.g. 'focus on Sales VP')")
@click.option(
    "--roles",
    default=",".join(DEFAULT_ROLES),
    help="Comma-separated roles to draft. Options: ceo_owner, cfo_ops, vp_sales, director, heir.",
)
@click.option("--dossier-number", default=None, type=int, help="Override dossier number for HTML masthead")
@click.option("--run-id", default=None, type=int, help="Existing run row id (used by dashboard)")
@click.option(
    "--mode", type=click.Choice(["agents", "monolith"]), default="agents",
    help="agents = 6-agent pipeline (default, validated). monolith = legacy single-prompt-per-phase.",
)
@click.option("--quiet", is_flag=True)
def research_cmd(
    url: str, hint: str | None, roles: str, dossier_number: int | None,
    run_id: int | None, mode: str, quiet: bool,
) -> None:
    """Research a single distributor URL end-to-end."""
    role_list = [r.strip() for r in roles.split(",") if r.strip()]
    n = dossier_number or _next_dossier_number()
    if mode == "agents":
        dossier, path = run_agentic_pipeline(
            url, hint=hint, roles=role_list, dossier_number=n,
            quiet=quiet, run_id=run_id,
        )
    else:
        dossier, path = run_pipeline(
            url, hint=hint, roles=role_list, dossier_number=n,
            quiet=quiet, run_id=run_id,
        )

    if not quiet:
        console.print(f"\n[bold]Emails generated:[/]")
        for em in dossier.emails:
            console.print(
                f"  · [cyan]{em.role_category}[/] → {em.target_person_name} "
                f"({em.target_person_email or 'no-email'}) — _{em.subject}_"
            )
        console.print(f"\n[bold]Open dossier:[/] file://{path}/dossier.html")
        console.print(f"[bold]Index:[/]        file://{path}/emails/INDEX.md")


@cli.command("submit")
@click.argument("url")
def submit_cmd(url: str) -> None:
    """Queue a research run as a non-blocking background process. Prints run_id.

    Used by the dashboard. The actual pipeline runs detached; status flows
    through the run row in SQLite.
    """
    import subprocess
    db.init_db()
    run_id = db.create_run(url)
    # Spawn detached subprocess that runs the pipeline against this run_id.
    log_path = Path("data") / f"run_{run_id}.log"
    log_path.parent.mkdir(exist_ok=True, parents=True)
    proc = subprocess.Popen(
        [sys.executable, "-m", "aimerch.cli.main", "research", url, "--run-id", str(run_id), "--quiet"],
        stdout=log_path.open("ab"),
        stderr=subprocess.STDOUT,
        start_new_session=True,
    )
    db.update_run_pid(run_id, proc.pid)
    click.echo(str(run_id))


@cli.command("register")
@click.argument("slug")
@click.option("--run-id", default=None, type=int, help="Mark this run row as done after registration.")
def register_cmd(slug: str, run_id: int | None) -> None:
    """Index a pre-built dossier folder into the database.

    Use this when the subagent (or any external process) has produced
    `dossiers/<slug>/{company.json,emails/*.md,dossier.html,research.md,evidence.json}`
    and you want them to appear in the dashboard.
    """
    from ..pipeline import render
    from ..models import Company, Person, Evidence, RedFlag, Email

    folder = DOSSIERS_DIR / slug
    if not folder.exists():
        console.print(f"[red]No folder at {folder}[/]")
        sys.exit(1)
    company_path = folder / "company.json"
    if not company_path.exists():
        console.print(f"[red]No company.json in {folder}[/]")
        sys.exit(1)
    snap = json.loads(company_path.read_text())
    company = Company(**snap["company"])
    people = [Person(**p) for p in snap.get("people", [])]
    red_flags = [RedFlag(**rf) for rf in snap.get("red_flags", [])]

    # Read pre-existing email files in folder/emails/
    emails: list[Email] = []
    emails_dir = folder / "emails"
    if emails_dir.exists():
        for f in sorted(emails_dir.iterdir()):
            if f.suffix != ".md" or f.name == "INDEX.md":
                continue
            text = f.read_text()
            # parse YAML frontmatter
            if text.startswith("---"):
                end = text.index("\n---", 3)
                fm = text[3:end].strip()
                body_section = text[end + 4:].strip()
                meta = {}
                for line in fm.splitlines():
                    if ":" in line:
                        k, v = line.split(":", 1)
                        meta[k.strip()] = v.strip()
                # subject + body
                import re as _re
                m = _re.search(r"\*\*Subject:\*\*\s*(.+?)\n\n(.+)", body_section, _re.DOTALL)
                subject = m.group(1).strip() if m else "(no subject)"
                body = m.group(2).strip() if m else body_section
                emails.append(Email(
                    role_category=meta.get("role", "other"),
                    target_person_name=meta.get("to_name", "Unknown"),
                    target_person_email=meta.get("to_email") or None,
                    subject=subject,
                    body=body,
                    safe_mode=meta.get("safe_mode", "False").lower() == "true",
                    word_count=int(meta.get("word_count", "0") or 0),
                ))

    db.init_db()
    db.upsert_company(company, snap.get("runtime_seconds", 0), snap.get("cost_usd", 0))
    db.upsert_people(slug, people)
    db.upsert_red_flags(slug, red_flags)
    db.upsert_emails(slug, emails)
    if run_id is not None:
        db.complete_run(run_id, slug, snap.get("runtime_seconds", 0) or 0, snap.get("cost_usd", 0) or 0)
    console.print(f"[green]✓[/] registered {company.legal_name} ({len(people)} people, {len(emails)} emails)")


@cli.command("ls")
def list_cmd() -> None:
    """List all researched companies."""
    db.init_db()
    rows = db.list_companies()
    if not rows:
        console.print("[dim]No companies yet. Run `aimerch-research research <url>` first.[/]")
        return
    t = Table(title="Researched companies")
    for col in ("slug", "legal_name", "state", "founded", "people", "emails", "flags", "score"):
        t.add_column(col)
    for r in rows:
        t.add_row(
            r["slug"],
            r["legal_name"][:40],
            r.get("state") or "—",
            str(r.get("founded_year") or "—"),
            str(r.get("people_count", 0)),
            str(r.get("email_count", 0)),
            ("⚠ " + (r.get("red_flag_severity") or "")) if r.get("flag_count") else "—",
            str(r.get("score") or "—"),
        )
    console.print(t)


@cli.command("regenerate")
@click.argument("slug")
@click.option(
    "--roles", default=",".join(DEFAULT_ROLES),
    help="Comma-separated roles to draft.",
)
def regenerate_cmd(slug: str, roles: str) -> None:
    """Re-run SYNTHESIZE only on cached evidence (skip web research). ~30s and $0.05."""
    folder = DOSSIERS_DIR / slug
    company_json = folder / "company.json"
    evidence_json = folder / "evidence.json"
    if not company_json.exists() or not evidence_json.exists():
        console.print(f"[red]No cached research at {folder}. Run `research <url>` first.[/]")
        sys.exit(1)

    snap = json.loads(company_json.read_text())
    research_data = json.loads(evidence_json.read_text())

    company = Company(**snap["company"])
    people = [Person(**p) for p in snap["people"]]
    evidence = [Evidence(**e) for e in snap["evidence"]]
    red_flags = [RedFlag(**rf) for rf in snap["red_flags"]]

    console.print(f"[bold]Regenerating[/] {company.legal_name} ({len(people)} people)…")
    t0 = time.time()
    research_md, dossier_html, emails, cost = synthesize(
        company=company, people=people, evidence=evidence,
        red_flags=red_flags, research_data=research_data,
        roles=[r.strip() for r in roles.split(",") if r.strip()],
        dossier_number=1,
    )
    dt = time.time() - t0

    out = render_to_disk(
        company=company, people=people, evidence=evidence, red_flags=red_flags,
        research_data=research_data, research_md=research_md,
        dossier_html=dossier_html, emails=emails,
        runtime_seconds=dt, cost_usd=cost,
    )
    console.print(f"[green]✓[/] {dt:.1f}s · ${cost:.4f}")
    for em in emails:
        console.print(
            f"  · [cyan]{em.role_category}[/] → {em.target_person_name} — _{em.subject}_"
        )
    console.print(f"[dim]→ {out}[/]")


@cli.command("show")
@click.argument("slug")
def show_cmd(slug: str) -> None:
    """Show one company's people + emails."""
    db.init_db()
    co = db.get_company(slug)
    if not co:
        console.print(f"[red]No such slug:[/] {slug}")
        sys.exit(1)
    console.print(f"[bold]{co['legal_name']}[/] ({co['state']})")
    console.print(f"  Founded: {co['founded_year']}")
    console.print(f"  Web: {co['website']}")
    if co.get("founding_moment"):
        console.print(f"  Hook: {co['founding_moment']}")
    if co.get("red_flags"):
        for rf in co["red_flags"]:
            console.print(f"  [yellow]⚠ {rf['severity']} {rf['flag_type']}:[/] {rf['description'][:160]}")

    console.print("\n[bold]People[/]")
    for p in co["people"]:
        line = f"  · {p['full_name']} | {p.get('title') or '—'}"
        if p.get("generation"): line += f" | gen {p['generation']}"
        if p.get("linkedin_url"): line += f" | LI"
        if p.get("email"): line += f" | {p['email']}"
        if p.get("is_deceased"): line += " | [dim]deceased[/]"
        console.print(line)

    console.print("\n[bold]Emails[/]")
    for em in co["emails"]:
        console.print(
            f"  · [{em['role_category']}] → {em['target_person_name']} ({em.get('target_person_email') or 'no-email'})"
        )
        console.print(f"    Subject: {em['subject']}")
        console.print(f"    [dim]{em['body'][:200]}…[/]\n")


def _next_dossier_number() -> int:
    db.init_db()
    rows = db.list_companies()
    return len(rows) + 1


if __name__ == "__main__":
    cli()
