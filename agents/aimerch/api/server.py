"""FastAPI app — exposes companies / runs / family-tree / research / SSE.

Run:
    .venv/bin/uvicorn aimerch.api.server:app --reload --port 7800
"""

from __future__ import annotations

import asyncio
import json
import os
import subprocess
import sys
from datetime import datetime
from pathlib import Path
from typing import AsyncIterator, Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel
from sse_starlette.sse import EventSourceResponse

from .. import db
from ..config import DOSSIERS_DIR, ROOT


app = FastAPI(title="AI Intelligence Outreach API", version="0.2.0")

# CORS — allow Next.js dev (web on :3000, web-shadcn on :3002) and same-origin
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000", "http://127.0.0.1:3000",
        "http://localhost:3002", "http://127.0.0.1:3002",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─── Schemas ──────────────────────────────────────────────────────────────

class CompanyListItem(BaseModel):
    slug: str
    legal_name: str
    dba: Optional[str] = None
    state: Optional[str] = None
    founded_year: Optional[int] = None
    founding_moment: Optional[str] = None
    summary: Optional[str] = None
    people_count: int = 0
    email_count: int = 0
    flag_count: int = 0
    red_flag_severity: Optional[str] = None
    score: Optional[int] = None


class ResearchRequest(BaseModel):
    url: str
    hint: Optional[str] = None
    roles: Optional[list[str]] = None
    force: bool = False  # bypass dedup check, re-research even if company exists


class ResearchResponse(BaseModel):
    run_id: int
    url: str
    status: str = "queued"


class EmailEditRequest(BaseModel):
    subject: Optional[str] = None
    body: Optional[str] = None


class EmailResetRequest(BaseModel):
    pass


# ─── Routes ───────────────────────────────────────────────────────────────

@app.get("/api/health")
def health():
    return {"ok": True, "db": "postgres" if db._is_postgres() else "sqlite"}


# ─── Web search proxy (for DO Agent Function Route) ──────────────────────

class SearchRequest(BaseModel):
    query: str
    max_results: int = 8


@app.post("/api/search")
def search_proxy(req: SearchRequest):
    """Proxy to Tavily search. DO Agent calls this as a Function Route so
    Claude can search the web. TAVILY_API_KEY env var required.
    """
    import httpx
    key = os.environ.get("TAVILY_API_KEY", "").strip()
    if not key:
        raise HTTPException(503, "TAVILY_API_KEY not configured")
    try:
        with httpx.Client(timeout=20.0) as client:
            r = client.post(
                "https://api.tavily.com/search",
                json={
                    "api_key": key,
                    "query": req.query,
                    "max_results": req.max_results,
                    "search_depth": "advanced",
                    "include_raw_content": True,
                },
            )
            r.raise_for_status()
            return r.json()
    except Exception as e:
        raise HTTPException(500, f"search failed: {e}")


@app.get("/api/companies", response_model=list[CompanyListItem])
def list_companies():
    db.init_db()
    rows = db.list_companies()
    return [
        {
            "slug": r["slug"],
            "legal_name": r["legal_name"],
            "dba": r.get("dba"),
            "state": r.get("state"),
            "founded_year": r.get("founded_year"),
            "founding_moment": r.get("founding_moment"),
            "summary": r.get("summary"),
            "people_count": r.get("people_count", 0),
            "email_count": r.get("email_count", 0),
            "flag_count": r.get("flag_count", 0),
            "red_flag_severity": r.get("red_flag_severity"),
            "score": r.get("score"),
        }
        for r in rows
    ]


@app.get("/api/companies/{slug}")
def get_company(slug: str):
    db.init_db()
    co = db.get_company(slug)
    if not co:
        raise HTTPException(status_code=404, detail="company not found")
    # Latest done run for this company — for cost breakdown
    with db.connect() as cx:
        cur = cx.cursor()
        cur.execute(db._q(
            "SELECT * FROM run WHERE company_slug=? AND status='done' "
            "ORDER BY completed_at DESC NULLS LAST LIMIT 1"
        ), (slug,))
        r = cur.fetchone()
        if r:
            co["latest_run"] = dict(r)
    return _json_safe(co)


@app.get("/api/companies/{slug}/family-tree")
def family_tree(slug: str):
    db.init_db()
    rels = db.get_family_tree_relations(slug)
    return _json_safe(rels)


@app.get("/api/companies/{slug}/research-md")
def research_md(slug: str):
    p = DOSSIERS_DIR / slug / "research.md"
    if not p.exists():
        raise HTTPException(404, "no research.md")
    return {"markdown": p.read_text(encoding="utf-8")}


@app.get("/api/companies/{slug}/evidence")
def evidence(slug: str):
    p = DOSSIERS_DIR / slug / "evidence.json"
    if not p.exists():
        raise HTTPException(404, "no evidence")
    return json.loads(p.read_text(encoding="utf-8"))


@app.get("/api/companies/{slug}/articles")
def articles(slug: str):
    p = DOSSIERS_DIR / slug / "articles.json"
    if not p.exists():
        return []
    return json.loads(p.read_text(encoding="utf-8"))


@app.get("/api/companies/{slug}/facts")
def facts(slug: str):
    p = DOSSIERS_DIR / slug / "facts.json"
    if not p.exists():
        return []
    return json.loads(p.read_text(encoding="utf-8"))


@app.get("/api/companies/{slug}/emails")
def emails(slug: str):
    """Return generated outreach emails for the company.

    Reads the markdown files in dossiers/<slug>/emails/, parses YAML
    frontmatter + extracts the Subject line, body, and Sources section so
    the CRM can store/display them as structured rows.
    """
    edir = DOSSIERS_DIR / slug / "emails"
    if not edir.exists():
        return []
    out = []
    for path in sorted(edir.glob("*.md")):
        # Skip the auto-generated table-of-contents file — it's not an email,
        # just an index linking to all the role-specific drafts. Importing it
        # creates a phantom "Unnamed" email row in the CRM.
        if path.name.upper().startswith("INDEX"):
            continue
        text = path.read_text(encoding="utf-8")
        meta: dict = {}
        body = text
        # YAML-ish frontmatter
        if text.startswith("---\n"):
            end = text.find("\n---\n", 4)
            if end != -1:
                fm = text[4:end].strip()
                body = text[end + 5:].lstrip()
                for line in fm.splitlines():
                    if ":" in line:
                        k, v = line.split(":", 1)
                        meta[k.strip()] = v.strip()
        # Pull Subject + body + sources
        subject = None
        body_lines: list[str] = []
        sources_md = ""
        in_sources = False
        for raw in body.splitlines():
            if not subject and raw.startswith("**Subject:**"):
                subject = raw.replace("**Subject:**", "").strip()
                continue
            if raw.strip().startswith("**Sources**"):
                in_sources = True
                sources_md = raw + "\n"
                continue
            if in_sources:
                sources_md += raw + "\n"
            else:
                body_lines.append(raw)
        body_clean = "\n".join(body_lines).strip()
        # strip trailing horizontal rule
        if body_clean.endswith("---"):
            body_clean = body_clean[:-3].rstrip()
        out.append({
            "filename": path.name,
            "role": meta.get("role"),
            "to_name": meta.get("to_name"),
            "to_email": meta.get("to_email") or None,
            "safe_mode": meta.get("safe_mode") == "True",
            "word_count": int(meta.get("word_count") or 0),
            "subject": subject,
            "body": body_clean,
            "sources_md": sources_md.strip() or None,
        })
    return out


def _normalize_host(url: str) -> str:
    """Pull the canonical host from a URL: 'https://www.foo.com/x' → 'foo.com'."""
    s = (url or "").lower().strip()
    if s.startswith("http://"):
        s = s[7:]
    elif s.startswith("https://"):
        s = s[8:]
    s = s.split("/")[0].split("?")[0]
    if s.startswith("www."):
        s = s[4:]
    return s


@app.get("/api/research/check")
def research_check(url: str):
    """Pre-flight: does a company with this URL already exist?

    Returns {exists: bool, slug, legal_name, founded_year} so the UI can
    warn before triggering a new ~$3 / 10-min run.
    """
    db.init_db()
    host = _normalize_host(url)
    if not host:
        return {"exists": False}
    with db.connect() as cx:
        cur = cx.cursor()
        cur.execute(
            db._q(
                "SELECT slug, legal_name, founded_year, state, website FROM company "
                "WHERE LOWER(website) LIKE ? OR slug=? LIMIT 1"
            ),
            (f"%{host}%", host.replace(".", "_").replace("-", "_")),
        )
        row = cur.fetchone()
    if not row:
        return {"exists": False, "host": host}
    d = dict(row)
    d["exists"] = True
    d["host"] = host
    return _json_safe(d)


@app.post("/api/research", response_model=ResearchResponse)
def submit_research(req: ResearchRequest):
    """Spawn the DO Gradient multi-agent pipeline (Opus 4.7) for this URL.

    Runs Phase 0 (discover) → article-hunter → fact-builder → fact-validator
    → hook-specialist → email-writer × N → email-validator × N, all via the
    DO Gradient API with Tavily MCP for web search. Token usage and cost
    (LLM + web-search) are tracked per-run on the dashboard.
    """
    db.init_db()

    # Dedup guard — skip if a company with this URL already exists, unless
    # caller passed force=True. Saves the user from spending ~$3 + 10 min
    # accidentally re-researching the same distributor.
    if not req.force:
        check = research_check(req.url)
        if check.get("exists"):
            raise HTTPException(
                status_code=409,
                detail={
                    "message": "Company already researched",
                    "existing": check,
                    "hint": "Pass force=true to re-research",
                },
            )

    run_id = db.create_run(req.url)
    db.update_run_phase(run_id, "discover")

    log_path = ROOT / "data" / f"run_{run_id}.log"
    log_path.parent.mkdir(exist_ok=True, parents=True)

    roles = req.roles or ["ceo_owner", "cfo_ops", "vp_sales"]
    cmd = [
        sys.executable, "-m", "aimerch.cli.main", "research",
        req.url,
        "--run-id", str(run_id),
        "--roles", ",".join(roles),
        "--quiet",
    ]
    if req.hint:
        cmd += ["--hint", req.hint]

    proc = subprocess.Popen(
        cmd,
        cwd=str(ROOT),
        stdout=log_path.open("ab"),
        stderr=subprocess.STDOUT,
        start_new_session=True,
        env={**os.environ},
    )
    db.update_run_pid(run_id, proc.pid)
    return ResearchResponse(run_id=run_id, url=req.url, status="running")


@app.get("/api/runs/active")
def active_runs():
    db.init_db()
    return [_json_safe(r) for r in db.get_active_runs()]


@app.get("/api/runs/{run_id}")
def get_run(run_id: int):
    db.init_db()
    r = db.get_run(run_id)
    if not r:
        raise HTTPException(404, "run not found")
    return _json_safe(r)


@app.get("/api/runs")
def list_runs(limit: int = 20):
    db.init_db()
    return [_json_safe(r) for r in db.get_recent_runs(limit=limit)]


@app.get("/api/runs/{run_id}/log")
def run_log(run_id: int, tail: int = 200):
    p = ROOT / "data" / f"run_{run_id}.log"
    if not p.exists():
        return {"log": ""}
    text = p.read_text(encoding="utf-8", errors="replace")
    if tail and tail > 0:
        lines = text.splitlines()
        text = "\n".join(lines[-tail:])
    return {"log": text}


@app.get("/api/runs/{run_id}/progress")
def run_progress(run_id: int):
    """Live progress derived from the run row's `current_phase`. Each agent
    updates the phase as it starts, so the UI gets per-stage feedback instead
    of waiting for filesystem artifacts at the end of the run."""
    db.init_db()
    r = db.get_run(run_id)
    if not r:
        raise HTTPException(404, "run not found")

    slug = r.get("company_slug")
    phase = (r.get("current_phase") or "queued").lower()
    status = r.get("status") or "queued"
    db_pct = r.get("progress_pct") or 0

    # Phase ordering: a phase is "done" if the current phase is past it
    # (or the run reached a terminal state with done=true).
    PHASE_ORDER = [
        "queued", "discover", "articles", "facts", "validate_facts",
        "hooks", "emails", "synthesize", "render", "done",
    ]

    def phase_idx(p: str) -> int:
        try:
            return PHASE_ORDER.index(p)
        except ValueError:
            return 0

    cur_idx = phase_idx(phase)
    if status == "done":
        cur_idx = phase_idx("done")

    def reached(p: str) -> bool:
        return cur_idx > phase_idx(p) or status == "done"

    steps = [
        {"key": "discover", "label": "Phase 0 · Discover (company + people)",
         "done": reached("discover"), "icon": "🔍"},
        {"key": "articles", "label": "article-hunter",
         "done": reached("articles"), "icon": "📰"},
        {"key": "facts", "label": "fact-builder + validator",
         "done": reached("validate_facts"), "icon": "🧾"},
        {"key": "hooks", "label": "hook-specialist",
         "done": reached("hooks"), "icon": "🪝"},
        {"key": "emails", "label": "email-writer + validator",
         "done": reached("emails") and (cur_idx >= phase_idx("render") or status == "done"),
         "icon": "✉"},
        {"key": "research", "label": "Final research.md + dossier.html",
         "done": status == "done", "icon": "📋"},
    ]
    completed = sum(1 for s in steps if s["done"])

    # Currently-running step (first not-done) gets the "active" flag for UI spinner
    for s in steps:
        s["active"] = False
    if status == "running":
        for s in steps:
            if not s["done"]:
                s["active"] = True
                break

    return {
        "run_id": run_id,
        "slug": slug,
        "status": status,
        "phase": phase,
        "steps": steps,
        "completed_steps": completed,
        "total_steps": len(steps),
        "pct": db_pct,
    }


@app.get("/api/runs/{run_id}/stream")
async def run_stream(run_id: int):
    """SSE stream — emits the run row every 1s while it's not done/failed."""
    async def event_generator() -> AsyncIterator[dict]:
        last_status = None
        while True:
            r = db.get_run(run_id)
            if not r:
                yield {"event": "error", "data": json.dumps({"error": "not found"})}
                return
            data = _json_safe(r)
            current = (data.get("status"), data.get("current_phase"), data.get("progress_pct"))
            if current != last_status:
                yield {"event": "update", "data": json.dumps(data)}
                last_status = current
            if r.get("status") in ("done", "failed"):
                yield {"event": "done", "data": json.dumps(data)}
                return
            await asyncio.sleep(1.0)

    return EventSourceResponse(event_generator())


# ─── Static dossier serving (HTML for download/email-attach) ──────────────

# ─── Email edit ───────────────────────────────────────────────────────────


@app.put("/api/emails/{email_id}")
def update_email(email_id: int, req: EmailEditRequest):
    """Save user edits to an email. Original `subject`/`body` columns stay
    immutable — edits land in `subject_edited`/`body_edited` so the user can
    always toggle back to the AI draft.
    """
    db.init_db()
    if req.subject is None and req.body is None:
        raise HTTPException(400, "subject or body required")
    with db.connect() as cx:
        cur = cx.cursor()
        cur.execute(db._q("SELECT id FROM email WHERE id=?"), (email_id,))
        if not cur.fetchone():
            raise HTTPException(404, "email not found")
        cur.execute(db._q(
            "UPDATE email SET subject_edited=COALESCE(?, subject_edited), "
            "body_edited=COALESCE(?, body_edited), edited_at="
            + ("now()" if db._is_postgres() else "CURRENT_TIMESTAMP")
            + " WHERE id=?"
        ), (req.subject, req.body, email_id))
        if not db._is_postgres():
            cx.commit()
        cur.execute(db._q("SELECT * FROM email WHERE id=?"), (email_id,))
        row = cur.fetchone()
    return _json_safe(dict(row))


@app.delete("/api/emails/{email_id}/edit")
def reset_email_edit(email_id: int):
    """Discard the edited version — revert to the original AI draft."""
    db.init_db()
    with db.connect() as cx:
        cur = cx.cursor()
        cur.execute(db._q(
            "UPDATE email SET subject_edited=NULL, body_edited=NULL, edited_at=NULL "
            "WHERE id=?"
        ), (email_id,))
        if not db._is_postgres():
            cx.commit()
        cur.execute(db._q("SELECT * FROM email WHERE id=?"), (email_id,))
        row = cur.fetchone()
        if not row:
            raise HTTPException(404, "email not found")
    return _json_safe(dict(row))


@app.get("/api/companies/{slug}/dossier.html")
def dossier_html(slug: str):
    p = DOSSIERS_DIR / slug / "dossier.html"
    if not p.exists():
        raise HTTPException(404, "no dossier")
    return FileResponse(p, media_type="text/html")


# ─── Helpers ──────────────────────────────────────────────────────────────

def _json_safe(value):
    """Recursively convert datetime, Decimal, etc. to JSON-friendly types."""
    if isinstance(value, dict):
        return {k: _json_safe(v) for k, v in value.items()}
    if isinstance(value, list):
        return [_json_safe(v) for v in value]
    if isinstance(value, datetime):
        return value.isoformat()
    return value
