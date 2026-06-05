"""DB layer — Postgres-first via DATABASE_URL, falls back to SQLite for dev.

Schema uses real foreign keys for family relations (person.parent_id, person.spouse_id),
so the frontend builds the tree directly from SQL joins instead of inferring from name strings.
"""

from __future__ import annotations

import json
import os
import sqlite3
from contextlib import contextmanager
from datetime import datetime
from pathlib import Path
from typing import Any, Iterator, Optional

from .config import DATA_DIR, DB_PATH
from .models import Company, Email, Person, RedFlag

try:
    import psycopg
    from psycopg.rows import dict_row
    HAS_PSYCOPG = True
except ImportError:
    HAS_PSYCOPG = False


def _is_postgres() -> bool:
    url = os.environ.get("DATABASE_URL", "")
    return HAS_PSYCOPG and (url.startswith("postgresql://") or url.startswith("postgres://"))


def _pg_url() -> str:
    return os.environ.get("DATABASE_URL", "postgresql://localhost:5432/aimerch_outreach")


SCHEMA_PG = """
CREATE TABLE IF NOT EXISTS company (
    slug              TEXT PRIMARY KEY,
    legal_name        TEXT NOT NULL,
    dba               TEXT,
    state             TEXT,
    website           TEXT,
    hq_address        TEXT,
    hq_phone          TEXT,
    founded_year      INTEGER,
    employee_count    INTEGER,
    account_count     INTEGER,
    primary_supplier  TEXT,
    brands_json       JSONB,
    score             INTEGER CHECK (score IS NULL OR (score BETWEEN 0 AND 10)),
    tier              TEXT,
    status            TEXT DEFAULT 'researched',
    red_flag_severity TEXT,
    founding_moment   TEXT,
    summary           TEXT,
    created_at        TIMESTAMPTZ DEFAULT now(),
    updated_at        TIMESTAMPTZ DEFAULT now(),
    last_runtime_seconds REAL,
    last_cost_usd     REAL
);

CREATE TABLE IF NOT EXISTS person (
    id              SERIAL PRIMARY KEY,
    company_slug    TEXT REFERENCES company(slug) ON DELETE CASCADE,
    full_name       TEXT NOT NULL,
    title           TEXT,
    role_category   TEXT,
    generation      INTEGER,
    is_decision_maker BOOLEAN DEFAULT FALSE,
    is_deceased     BOOLEAN DEFAULT FALSE,
    death_year      INTEGER,
    linkedin_url    TEXT,
    photo_url       TEXT,
    email           TEXT,
    phone           TEXT,
    parent_id       INTEGER REFERENCES person(id) ON DELETE SET NULL,
    spouse_id       INTEGER REFERENCES person(id) ON DELETE SET NULL,
    parent_name     TEXT,         -- raw from agent before resolution
    spouse_name     TEXT,
    family_relation_to TEXT,      -- legacy
    bio_short       TEXT,
    key_facts_json  JSONB,
    UNIQUE(company_slug, full_name)
);
ALTER TABLE person ADD COLUMN IF NOT EXISTS photo_url TEXT;
ALTER TABLE person ADD COLUMN IF NOT EXISTS education_json JSONB;
ALTER TABLE person ADD COLUMN IF NOT EXISTS career_summary TEXT;
ALTER TABLE person ADD COLUMN IF NOT EXISTS related_article_urls JSONB;
ALTER TABLE person ADD COLUMN IF NOT EXISTS extra_facts_json JSONB;
CREATE INDEX IF NOT EXISTS idx_person_company ON person(company_slug);
CREATE INDEX IF NOT EXISTS idx_person_parent ON person(parent_id);

CREATE TABLE IF NOT EXISTS red_flag (
    id              SERIAL PRIMARY KEY,
    company_slug    TEXT REFERENCES company(slug) ON DELETE CASCADE,
    flag_type       TEXT,
    severity        TEXT,
    description     TEXT,
    source_url      TEXT,
    detected_at     TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS email (
    id              SERIAL PRIMARY KEY,
    company_slug    TEXT REFERENCES company(slug) ON DELETE CASCADE,
    role_category   TEXT,
    target_person_id INTEGER REFERENCES person(id) ON DELETE SET NULL,
    target_person_name TEXT,
    target_person_email TEXT,
    subject         TEXT,
    body            TEXT,
    safe_mode       BOOLEAN DEFAULT FALSE,
    word_count      INTEGER,
    status          TEXT DEFAULT 'draft',
    created_at      TIMESTAMPTZ DEFAULT now(),
    sent_at         TIMESTAMPTZ,
    subject_edited  TEXT,
    body_edited     TEXT,
    edited_at       TIMESTAMPTZ
);

ALTER TABLE email ADD COLUMN IF NOT EXISTS subject_edited TEXT;
ALTER TABLE email ADD COLUMN IF NOT EXISTS body_edited TEXT;
ALTER TABLE email ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS article (
    id              SERIAL PRIMARY KEY,
    company_slug    TEXT REFERENCES company(slug) ON DELETE CASCADE,
    url             TEXT,
    title           TEXT,
    outlet          TEXT,
    publication_date TEXT,
    article_type    TEXT,
    subject_person  TEXT,
    snippet         TEXT,
    key_quote       TEXT,
    relevance       REAL
);

CREATE TABLE IF NOT EXISTS fact (
    id              SERIAL PRIMARY KEY,
    company_slug    TEXT REFERENCES company(slug) ON DELETE CASCADE,
    fact_type       TEXT,
    subject         TEXT,
    predicate       TEXT,
    object          TEXT,
    verbatim_quote  TEXT,
    article_id      INTEGER REFERENCES article(id) ON DELETE SET NULL,
    confidence      REAL,
    validated       BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS run (
    id              SERIAL PRIMARY KEY,
    company_slug    TEXT REFERENCES company(slug) ON DELETE SET NULL,
    url             TEXT,
    status          TEXT DEFAULT 'queued',
    current_phase   TEXT,
    progress_pct    INTEGER DEFAULT 0,
    started_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now(),
    completed_at    TIMESTAMPTZ,
    runtime_seconds REAL,
    cost_usd        REAL,
    error           TEXT,
    pid             INTEGER,
    input_tokens    BIGINT DEFAULT 0,
    output_tokens   BIGINT DEFAULT 0,
    cache_read_tokens BIGINT DEFAULT 0,
    cache_write_tokens BIGINT DEFAULT 0,
    web_searches    INTEGER DEFAULT 0,
    web_search_cost_usd REAL DEFAULT 0,
    llm_cost_usd    REAL DEFAULT 0,
    backend         TEXT
);

ALTER TABLE run ADD COLUMN IF NOT EXISTS input_tokens BIGINT DEFAULT 0;
ALTER TABLE run ADD COLUMN IF NOT EXISTS output_tokens BIGINT DEFAULT 0;
ALTER TABLE run ADD COLUMN IF NOT EXISTS cache_read_tokens BIGINT DEFAULT 0;
ALTER TABLE run ADD COLUMN IF NOT EXISTS cache_write_tokens BIGINT DEFAULT 0;
ALTER TABLE run ADD COLUMN IF NOT EXISTS web_searches INTEGER DEFAULT 0;
ALTER TABLE run ADD COLUMN IF NOT EXISTS web_search_cost_usd REAL DEFAULT 0;
ALTER TABLE run ADD COLUMN IF NOT EXISTS llm_cost_usd REAL DEFAULT 0;
ALTER TABLE run ADD COLUMN IF NOT EXISTS backend TEXT;
"""


SCHEMA_SQLITE = """
CREATE TABLE IF NOT EXISTS company (
    slug              TEXT PRIMARY KEY,
    legal_name        TEXT NOT NULL,
    dba               TEXT,
    state             TEXT,
    website           TEXT,
    hq_address        TEXT,
    hq_phone          TEXT,
    founded_year      INTEGER,
    employee_count    INTEGER,
    account_count     INTEGER,
    primary_supplier  TEXT,
    brands_json       TEXT,
    score             INTEGER,
    tier              TEXT,
    status            TEXT DEFAULT 'researched',
    red_flag_severity TEXT,
    founding_moment   TEXT,
    summary           TEXT,
    created_at        TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at        TEXT DEFAULT CURRENT_TIMESTAMP,
    last_runtime_seconds REAL,
    last_cost_usd     REAL
);

CREATE TABLE IF NOT EXISTS person (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    company_slug    TEXT REFERENCES company(slug) ON DELETE CASCADE,
    full_name       TEXT NOT NULL,
    title           TEXT,
    role_category   TEXT,
    generation      INTEGER,
    is_decision_maker INTEGER DEFAULT 0,
    is_deceased     INTEGER DEFAULT 0,
    death_year      INTEGER,
    linkedin_url    TEXT,
    photo_url       TEXT,
    email           TEXT,
    phone           TEXT,
    parent_id       INTEGER REFERENCES person(id) ON DELETE SET NULL,
    spouse_id       INTEGER REFERENCES person(id) ON DELETE SET NULL,
    parent_name     TEXT,
    spouse_name     TEXT,
    family_relation_to TEXT,
    bio_short       TEXT,
    key_facts_json  TEXT,
    education_json  TEXT,
    career_summary  TEXT,
    related_article_urls TEXT,
    extra_facts_json TEXT,
    UNIQUE(company_slug, full_name)
);

CREATE TABLE IF NOT EXISTS red_flag (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    company_slug    TEXT,
    flag_type       TEXT,
    severity        TEXT,
    description     TEXT,
    source_url      TEXT,
    detected_at     TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS email (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    company_slug    TEXT,
    role_category   TEXT,
    target_person_id INTEGER,
    target_person_name TEXT,
    target_person_email TEXT,
    subject         TEXT,
    body            TEXT,
    safe_mode       INTEGER DEFAULT 0,
    word_count      INTEGER,
    status          TEXT DEFAULT 'draft',
    created_at      TEXT DEFAULT CURRENT_TIMESTAMP,
    sent_at         TEXT,
    subject_edited  TEXT,
    body_edited     TEXT,
    edited_at       TEXT
);

CREATE TABLE IF NOT EXISTS article (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    company_slug    TEXT,
    url             TEXT,
    title           TEXT,
    outlet          TEXT,
    publication_date TEXT,
    article_type    TEXT,
    subject_person  TEXT,
    snippet         TEXT,
    key_quote       TEXT,
    relevance       REAL
);

CREATE TABLE IF NOT EXISTS fact (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    company_slug    TEXT,
    fact_type       TEXT,
    subject         TEXT,
    predicate       TEXT,
    object          TEXT,
    verbatim_quote  TEXT,
    article_id      INTEGER,
    confidence      REAL,
    validated       INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS run (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    company_slug    TEXT,
    url             TEXT,
    status          TEXT DEFAULT 'queued',
    current_phase   TEXT,
    progress_pct    INTEGER DEFAULT 0,
    started_at      TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at      TEXT DEFAULT CURRENT_TIMESTAMP,
    completed_at    TEXT,
    runtime_seconds REAL,
    cost_usd        REAL,
    error           TEXT,
    pid             INTEGER
);

CREATE INDEX IF NOT EXISTS idx_person_company ON person(company_slug);
CREATE INDEX IF NOT EXISTS idx_person_parent ON person(parent_id);
"""


@contextmanager
def connect():
    """Yield a connection. Uses Postgres if DATABASE_URL is set, else SQLite at DB_PATH."""
    if _is_postgres():
        cx = psycopg.connect(_pg_url(), row_factory=dict_row)
        try:
            yield cx
            cx.commit()
        except Exception:
            cx.rollback()
            raise
        finally:
            cx.close()
    else:
        DB_PATH.parent.mkdir(exist_ok=True, parents=True)
        cx = sqlite3.connect(DB_PATH)
        cx.row_factory = sqlite3.Row
        try:
            yield cx
        finally:
            cx.close()


def _q(query: str) -> str:
    """Translate ? placeholders to %s for psycopg, leave as-is for sqlite."""
    if _is_postgres():
        return query.replace("?", "%s")
    return query


def init_db() -> None:
    with connect() as cx:
        cur = cx.cursor()
        if _is_postgres():
            cur.execute(SCHEMA_PG)
        else:
            cur.executescript(SCHEMA_SQLITE)
            cx.commit()


def _maybe(value: Any, sql_type: str = "json") -> Any:
    """Normalize value for whichever backend."""
    if value is None:
        return None
    if sql_type == "json":
        if _is_postgres():
            return json.dumps(value)  # JSONB takes string or dict; string is portable
        return json.dumps(value)
    return value


def _bool(v: Any) -> Any:
    """Booleans for psycopg, ints for sqlite."""
    if _is_postgres():
        return bool(v)
    return int(bool(v))


def upsert_company(co: Company, runtime: float, cost: float) -> None:
    sql = _q("""
        INSERT INTO company (
            slug, legal_name, dba, state, website, hq_address, hq_phone,
            founded_year, employee_count, account_count, primary_supplier,
            brands_json, score, tier, founding_moment, summary,
            last_runtime_seconds, last_cost_usd
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(slug) DO UPDATE SET
            legal_name=EXCLUDED.legal_name, dba=EXCLUDED.dba, state=EXCLUDED.state,
            website=EXCLUDED.website, hq_address=EXCLUDED.hq_address,
            hq_phone=EXCLUDED.hq_phone, founded_year=EXCLUDED.founded_year,
            employee_count=EXCLUDED.employee_count, account_count=EXCLUDED.account_count,
            primary_supplier=EXCLUDED.primary_supplier, brands_json=EXCLUDED.brands_json,
            score=EXCLUDED.score, tier=EXCLUDED.tier,
            founding_moment=EXCLUDED.founding_moment, summary=EXCLUDED.summary,
            last_runtime_seconds=EXCLUDED.last_runtime_seconds,
            last_cost_usd=EXCLUDED.last_cost_usd
    """)
    with connect() as cx:
        cx.cursor().execute(sql, (
            co.slug, co.legal_name, co.dba, co.state, co.website, co.hq_address,
            co.hq_phone, co.founded_year, co.employee_count, co.account_count,
            co.primary_supplier, _maybe(co.brands or []), co.score, co.tier,
            co.founding_moment, co.summary, runtime, cost,
        ))
        if not _is_postgres():
            cx.commit()


def upsert_people(slug: str, people: list[Person]) -> None:
    """Insert all people, then resolve parent_name/spouse_name → parent_id/spouse_id."""
    with connect() as cx:
        cur = cx.cursor()
        # Wipe existing rows for this company
        cur.execute(_q("DELETE FROM person WHERE company_slug=?"), (slug,))

        # Insert each row
        for p in people:
            cur.execute(_q("""
                INSERT INTO person (
                    company_slug, full_name, title, role_category, generation,
                    is_decision_maker, is_deceased, death_year, linkedin_url, photo_url,
                    email, phone, parent_name, spouse_name, family_relation_to,
                    bio_short, key_facts_json,
                    education_json, career_summary, related_article_urls, extra_facts_json
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """), (
                slug, p.full_name, p.title, p.role_category, p.generation,
                _bool(p.is_decision_maker), _bool(p.is_deceased), p.death_year,
                p.linkedin_url, p.photo_url, p.email, p.phone,
                p.parent_name, p.spouse_name, p.family_relation_to,
                p.bio_short, _maybe(p.key_facts or []),
                _maybe(p.education or []), p.career_summary,
                _maybe(p.related_article_urls or []), _maybe(p.extra_facts or []),
            ))

        # Resolve FK using normalized names
        cur.execute(_q(
            "SELECT id, full_name FROM person WHERE company_slug=?"
        ), (slug,))
        rows = cur.fetchall()
        # rows are dicts (psycopg) or sqlite Row
        from .dedup import normalize_name
        name_to_id = {normalize_name(r["full_name"]): r["id"] for r in rows}

        # Update parent_id and spouse_id, but only if the relation is NOT a self/conflict
        for p in people:
            person_norm = normalize_name(p.full_name)
            person_id = name_to_id.get(person_norm)
            if not person_id:
                continue
            spouse_id = None
            parent_id = None
            if p.spouse_name:
                spouse_id = name_to_id.get(normalize_name(p.spouse_name))
            if p.parent_name:
                # If parent is also the spouse → ignore (agent confusion)
                if normalize_name(p.parent_name) != normalize_name(p.spouse_name or ""):
                    parent_id = name_to_id.get(normalize_name(p.parent_name))
            cur.execute(_q(
                "UPDATE person SET parent_id=?, spouse_id=? WHERE id=?"
            ), (parent_id, spouse_id, person_id))

        if not _is_postgres():
            cx.commit()


def upsert_red_flags(slug: str, flags: list[RedFlag]) -> None:
    with connect() as cx:
        cur = cx.cursor()
        cur.execute(_q("DELETE FROM red_flag WHERE company_slug=?"), (slug,))
        for rf in flags:
            cur.execute(_q(
                "INSERT INTO red_flag (company_slug, flag_type, severity, description, source_url) VALUES (?,?,?,?,?)"
            ), (slug, rf.flag_type, rf.severity, rf.description, rf.source_url))
        sev = "high" if any(rf.severity == "high" for rf in flags) else \
              "medium" if any(rf.severity == "medium" for rf in flags) else \
              "low" if flags else None
        cur.execute(_q("UPDATE company SET red_flag_severity=? WHERE slug=?"), (sev, slug))
        if not _is_postgres():
            cx.commit()


def upsert_emails(slug: str, emails: list[Email]) -> None:
    with connect() as cx:
        cur = cx.cursor()
        cur.execute(_q("DELETE FROM email WHERE company_slug=? AND status='draft'"), (slug,))
        # Resolve target_person_id by name
        cur.execute(_q("SELECT id, full_name FROM person WHERE company_slug=?"), (slug,))
        rows = cur.fetchall()
        from .dedup import normalize_name
        name_to_id = {normalize_name(r["full_name"]): r["id"] for r in rows}

        for em in emails:
            tid = name_to_id.get(normalize_name(em.target_person_name or ""))
            cur.execute(_q("""
                INSERT INTO email (
                    company_slug, role_category, target_person_id, target_person_name,
                    target_person_email, subject, body, safe_mode, word_count, status
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft')
            """), (
                slug, em.role_category, tid, em.target_person_name,
                em.target_person_email, em.subject, em.body,
                _bool(em.safe_mode), em.word_count,
            ))
        if not _is_postgres():
            cx.commit()


def list_companies() -> list[dict]:
    sql = """
        SELECT c.*,
            (SELECT COUNT(*) FROM email WHERE company_slug=c.slug) AS email_count,
            (SELECT COUNT(*) FROM person WHERE company_slug=c.slug) AS people_count,
            (SELECT COUNT(*) FROM red_flag WHERE company_slug=c.slug) AS flag_count
        FROM company c ORDER BY updated_at DESC
    """
    with connect() as cx:
        cur = cx.cursor()
        cur.execute(sql)
        return [dict(r) for r in cur.fetchall()]


def get_company(slug: str) -> Optional[dict]:
    with connect() as cx:
        cur = cx.cursor()
        cur.execute(_q("SELECT * FROM company WHERE slug=?"), (slug,))
        row = cur.fetchone()
        if not row:
            return None
        co = dict(row)
        cur.execute(_q(
            "SELECT * FROM person WHERE company_slug=? "
            "ORDER BY (CASE WHEN generation IS NULL THEN 99 ELSE generation END), full_name"
        ), (slug,))
        co["people"] = [dict(r) for r in cur.fetchall()]
        cur.execute(_q("SELECT * FROM email WHERE company_slug=? ORDER BY id"), (slug,))
        co["emails"] = [dict(r) for r in cur.fetchall()]
        cur.execute(_q("SELECT * FROM red_flag WHERE company_slug=?"), (slug,))
        co["red_flags"] = [dict(r) for r in cur.fetchall()]
        return co


def get_family_tree_relations(slug: str) -> dict:
    """Return tree data via SQL FK joins. Auto-attaches orphans (no parent_id but
    generation > 1) to a same-lastname Gen N-1 person as a fallback so they
    don't float at the top of the tree.

    Returns {nodes: [...], links: [{parent_id, child_id}], spouses: [{a_id, b_id}]}
    """
    with connect() as cx:
        cur = cx.cursor()
        cur.execute(_q(
            "SELECT * FROM person WHERE company_slug=? AND generation IS NOT NULL "
            "ORDER BY generation, full_name"
        ), (slug,))
        people = [dict(r) for r in cur.fetchall()]

    if not people:
        return {"nodes": [], "links": [], "spouses": []}

    # Orphan repair: any Gen >= 2 person with parent_id IS NULL — try to attach
    # to a Gen N-1 same-lastname person.
    from .dedup import first_last
    by_gen: dict[int, list[dict]] = {}
    for p in people:
        if p.get("generation") is not None:
            by_gen.setdefault(int(p["generation"]), []).append(p)

    repairs: list[tuple[int, int]] = []  # (orphan_id, parent_id)
    for p in people:
        if p.get("parent_id") or not p.get("generation"):
            continue
        gen = int(p["generation"])
        if gen <= 1:
            continue
        _, last = first_last(p["full_name"])
        candidates = [
            c for c in by_gen.get(gen - 1, [])
            if first_last(c["full_name"])[1] == last
        ]
        if not candidates:
            continue
        # Pick the candidate with most existing children (likely the more central parent)
        def childcount(parent_dict):
            return sum(1 for q in people if q.get("parent_id") == parent_dict["id"])
        candidates.sort(key=lambda c: (-childcount(c), c["full_name"]))
        repairs.append((p["id"], candidates[0]["id"]))

    if repairs:
        with connect() as cx:
            cur = cx.cursor()
            for orphan_id, parent_id in repairs:
                cur.execute(_q("UPDATE person SET parent_id=? WHERE id=?"),
                            (parent_id, orphan_id))
            if not _is_postgres():
                cx.commit()
        # Refresh people list
        with connect() as cx:
            cur = cx.cursor()
            cur.execute(_q(
                "SELECT * FROM person WHERE company_slug=? AND generation IS NOT NULL "
                "ORDER BY generation, full_name"
            ), (slug,))
            people = [dict(r) for r in cur.fetchall()]

    nodes = people
    links = [{"parent_id": p["parent_id"], "child_id": p["id"]} for p in people if p.get("parent_id")]
    seen_pairs: set[frozenset] = set()
    spouses: list[dict] = []
    for p in people:
        if p.get("spouse_id"):
            pair = frozenset({p["id"], p["spouse_id"]})
            if pair in seen_pairs:
                continue
            seen_pairs.add(pair)
            spouses.append({"a_id": p["id"], "b_id": p["spouse_id"]})
    return {"nodes": nodes, "links": links, "spouses": spouses}


# ─── run progress ─────────────────────────────────────────────────────────

PHASE_PROGRESS = {
    "queued": 0,
    "discover": 10,
    "enrich": 25,           # legacy alias for "articles"
    "articles": 25,
    "facts": 40,
    "validate_facts": 50,
    "hooks": 60,
    "emails": 75,
    "synthesize": 80,       # legacy alias
    "render": 95,
    "done": 100,
    "failed": 100,
}


def create_run(url: str, pid: int | None = None) -> int:
    sql_returning = _q(
        "INSERT INTO run (url, status, current_phase, progress_pct, pid) "
        "VALUES (?, 'queued', 'queued', 0, ?)"
    )
    with connect() as cx:
        cur = cx.cursor()
        if _is_postgres():
            cur.execute(sql_returning + " RETURNING id", (url, pid))
            return cur.fetchone()["id"]
        cur.execute(sql_returning, (url, pid))
        cx.commit()
        return cur.lastrowid


def update_run_phase(run_id: int, phase: str, *, slug: str | None = None) -> None:
    pct = PHASE_PROGRESS.get(phase, 0)
    with connect() as cx:
        cur = cx.cursor()
        cur.execute(_q(
            "UPDATE run SET status='running', current_phase=?, progress_pct=?, "
            "company_slug=COALESCE(?, company_slug), updated_at="
            + ("now()" if _is_postgres() else "CURRENT_TIMESTAMP")
            + " WHERE id=?"
        ), (phase, pct, slug, run_id))
        if not _is_postgres():
            cx.commit()


def update_run_pid(run_id: int, pid: int) -> None:
    with connect() as cx:
        cur = cx.cursor()
        cur.execute(_q(
            "UPDATE run SET pid=?, updated_at="
            + ("now()" if _is_postgres() else "CURRENT_TIMESTAMP")
            + " WHERE id=?"
        ), (pid, run_id))
        if not _is_postgres():
            cx.commit()


def complete_run(
    run_id: int, slug: str, runtime: float, cost: float,
    *, usage: dict | None = None, backend: str | None = None,
) -> None:
    """Mark a run done. Optionally accept a usage dict with token + search counts:

        {
          "input_tokens": int,
          "output_tokens": int,
          "cache_read_tokens": int,
          "cache_write_tokens": int,
          "web_searches": int,
          "web_search_cost_usd": float,
          "llm_cost_usd": float,
        }
    """
    u = usage or {}
    with connect() as cx:
        cur = cx.cursor()
        ts = "now()" if _is_postgres() else "CURRENT_TIMESTAMP"
        cur.execute(_q(
            f"UPDATE run SET status='done', current_phase='done', progress_pct=100, "
            f"company_slug=?, completed_at={ts}, updated_at={ts}, "
            f"runtime_seconds=?, cost_usd=?, "
            f"input_tokens=?, output_tokens=?, "
            f"cache_read_tokens=?, cache_write_tokens=?, "
            f"web_searches=?, web_search_cost_usd=?, "
            f"llm_cost_usd=?, backend=? "
            f"WHERE id=?"
        ), (
            slug, runtime, cost,
            u.get("input_tokens", 0), u.get("output_tokens", 0),
            u.get("cache_read_tokens", 0), u.get("cache_write_tokens", 0),
            u.get("web_searches", 0), u.get("web_search_cost_usd", 0.0),
            u.get("llm_cost_usd", cost), backend,
            run_id,
        ))
        if not _is_postgres():
            cx.commit()


def fail_run(run_id: int, error: str) -> None:
    with connect() as cx:
        cur = cx.cursor()
        ts = "now()" if _is_postgres() else "CURRENT_TIMESTAMP"
        cur.execute(_q(
            f"UPDATE run SET status='failed', current_phase='failed', progress_pct=100, "
            f"error=?, completed_at={ts}, updated_at={ts} WHERE id=?"
        ), (error[:1000], run_id))
        if not _is_postgres():
            cx.commit()


def get_active_runs() -> list[dict]:
    with connect() as cx:
        cur = cx.cursor()
        cur.execute("SELECT * FROM run WHERE status IN ('queued', 'running') ORDER BY started_at DESC")
        return [dict(r) for r in cur.fetchall()]


def get_recent_runs(limit: int = 20) -> list[dict]:
    with connect() as cx:
        cur = cx.cursor()
        cur.execute(_q("SELECT * FROM run ORDER BY started_at DESC LIMIT ?"), (limit,))
        return [dict(r) for r in cur.fetchall()]


def get_run(run_id: int) -> dict | None:
    with connect() as cx:
        cur = cx.cursor()
        cur.execute(_q("SELECT * FROM run WHERE id=?"), (run_id,))
        r = cur.fetchone()
        return dict(r) if r else None


def record_run(*args, **kwargs) -> None:
    """Legacy noop — orchestrator manages runs through create_run/complete_run now."""
    pass


def maybe_migrate() -> None:
    """No-op for prod. SQLite ALTER TABLE migrations were temporary."""
    pass
