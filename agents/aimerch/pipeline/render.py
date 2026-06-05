"""Phase 4 — RENDER: write artifacts to disk + index in SQLite."""

from __future__ import annotations

import json
import re
from datetime import datetime
from pathlib import Path

from .. import db
from ..config import DOSSIERS_DIR
from ..models import Company, Dossier, Email, Evidence, Person, RedFlag


def _email_filename(em: Email, idx: int) -> str:
    safe_role = re.sub(r"[^a-z0-9]+", "_", (em.role_category or "other").lower())
    safe_name = re.sub(r"[^a-zA-Z0-9]+", "_", em.target_person_name or "unknown").strip("_").lower()
    return f"{idx:02d}_{safe_role}__{safe_name}.md"


def render_to_disk(
    *,
    company: Company,
    people: list[Person],
    evidence: list[Evidence],
    red_flags: list[RedFlag],
    research_data: dict,
    research_md: str,
    dossier_html: str,
    emails: list[Email],
    runtime_seconds: float,
    cost_usd: float,
) -> Path:
    """Write all artifacts to dossiers/<slug>/. Return the directory path."""
    slug = company.slug
    out = DOSSIERS_DIR / slug
    out.mkdir(exist_ok=True, parents=True)
    emails_dir = out / "emails"
    emails_dir.mkdir(exist_ok=True)
    # Clear stale email files from prior runs so the folder always reflects the latest set.
    for f in emails_dir.iterdir():
        if f.is_file():
            f.unlink()

    # research markdown
    (out / "research.md").write_text(research_md, encoding="utf-8")
    # dossier html
    (out / "dossier.html").write_text(dossier_html, encoding="utf-8")
    # raw evidence JSON
    (out / "evidence.json").write_text(
        json.dumps(research_data, indent=2, default=str),
        encoding="utf-8",
    )
    # company snapshot
    (out / "company.json").write_text(
        json.dumps({
            "company": company.model_dump(),
            "people": [p.model_dump() for p in people],
            "evidence": [e.model_dump() for e in evidence],
            "red_flags": [rf.model_dump() for rf in red_flags],
            "runtime_seconds": runtime_seconds,
            "cost_usd": cost_usd,
        }, indent=2, default=str),
        encoding="utf-8",
    )

    # emails
    index_lines = [f"# Outreach drafts for {company.legal_name}\n"]
    for i, em in enumerate(emails, 1):
        fname = _email_filename(em, i)
        body = (
            f"---\n"
            f"role: {em.role_category}\n"
            f"to_name: {em.target_person_name}\n"
            f"to_email: {em.target_person_email or ''}\n"
            f"safe_mode: {em.safe_mode}\n"
            f"word_count: {em.word_count}\n"
            f"---\n\n"
            f"**Subject:** {em.subject}\n\n"
            f"{em.body}\n"
        )
        (out / "emails" / fname).write_text(body, encoding="utf-8")
        index_lines.append(
            f"- [{em.role_category} → {em.target_person_name}](emails/{fname}) · "
            f"_{em.subject}_ · {em.word_count}w"
        )
    (out / "emails" / "INDEX.md").write_text("\n".join(index_lines), encoding="utf-8")

    # Persist to DB. Note: run row is managed by orchestrator.run_pipeline now —
    # we don't write a separate one here.
    db.init_db()
    db.upsert_company(company, runtime_seconds, cost_usd)
    db.upsert_people(slug, people)
    db.upsert_red_flags(slug, red_flags)
    db.upsert_emails(slug, emails)

    return out
