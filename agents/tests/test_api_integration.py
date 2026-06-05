"""Integration tests for the FastAPI server.

Hits the real FastAPI app with TestClient against a temporary SQLite DB +
a temporary dossiers directory. Verifies the contract the Next.js
frontend depends on (response shapes for /companies, /articles, /facts,
/runs/<id>/progress).
"""

from __future__ import annotations

import json
import os
from pathlib import Path

import pytest
from fastapi.testclient import TestClient


pytestmark = pytest.mark.integration


# ─── Fixtures ─────────────────────────────────────────────────────────────


@pytest.fixture(scope="module")
def tmpdb(tmp_path_factory):
    """Spin up an isolated SQLite + dossiers dir for the test suite."""
    root = tmp_path_factory.mktemp("api_int")
    dossiers = root / "dossiers"
    dossiers.mkdir()
    data_dir = root / "data"
    data_dir.mkdir()
    db_path = data_dir / "test.sqlite"

    # Force sqlite (no postgres)
    os.environ["DATABASE_URL"] = ""

    # Seed: write a fake dossier we can query
    slug_dir = dossiers / "test_co_inc"
    slug_dir.mkdir()
    (slug_dir / "company.json").write_text(json.dumps({
        "company": {
            "slug": "test_co_inc",
            "legal_name": "Test Co, Inc.",
            "state": "NY",
            "founded_year": 1950,
            "summary": "A fixture company.",
        },
        "people": [],
        "evidence": [],
        "red_flags": [],
    }))
    (slug_dir / "articles.json").write_text(json.dumps([
        {
            "id": "art_001",
            "url": "https://brewbound.com/news/test-co",
            "title": "Test Co Signs Distribution Agreement",
            "outlet": "Brewbound",
            "article_type": "industry_press",
            "snippet": "Test Co, Inc. signed a major deal in 2024.",
        }
    ]))
    (slug_dir / "facts.json").write_text(json.dumps([
        {
            "id": "fact_001",
            "fact_type": "company_milestone",
            "subject": "Test Co",
            "predicate": "signed",
            "object": "distribution agreement",
            "verbatim_quote": "Test Co signed a major deal in 2024.",
            "article_id": "art_001",
            "confidence": 0.9,
        }
    ]))
    (slug_dir / "research.md").write_text("# Test Co\n\nPer [Brewbound](https://brewbound.com/news/test-co).\n")

    # Override the module-level paths BEFORE init_db (they were bound at import)
    import aimerch.config as cfg
    import aimerch.db as db_mod
    import aimerch.api.server as srv

    cfg.DOSSIERS_DIR = dossiers
    cfg.DATA_DIR = data_dir
    cfg.DB_PATH = db_path
    cfg.ROOT = root
    db_mod.DB_PATH = db_path
    db_mod.DATA_DIR = data_dir
    srv.DOSSIERS_DIR = dossiers
    srv.ROOT = root

    db_mod.init_db()

    # Insert the fixture company so /api/companies returns it
    from aimerch.models import Company
    db_mod.upsert_company(
        Company(
            slug="test_co_inc",
            legal_name="Test Co, Inc.",
            state="NY",
            founded_year=1950,
            summary="A fixture company.",
        ),
        runtime=10.0,
        cost=1.23,
    )

    yield root


@pytest.fixture(scope="module")
def client(tmpdb):
    from aimerch.api.server import app
    return TestClient(app)


# ─── Routes ───────────────────────────────────────────────────────────────


def test_health(client):
    r = client.get("/api/health")
    assert r.status_code == 200
    body = r.json()
    assert body["ok"] is True
    assert "db" in body


def test_companies_list(client):
    r = client.get("/api/companies")
    assert r.status_code == 200
    rows = r.json()
    slugs = [c["slug"] for c in rows]
    assert "test_co_inc" in slugs
    co = next(c for c in rows if c["slug"] == "test_co_inc")
    # Frontend depends on these keys existing (CompanyList.tsx)
    assert co["legal_name"] == "Test Co, Inc."
    assert co["state"] == "NY"
    assert co["founded_year"] == 1950
    assert "people_count" in co
    assert "email_count" in co


def test_company_detail(client):
    r = client.get("/api/companies/test_co_inc")
    assert r.status_code == 200
    co = r.json()
    assert co["slug"] == "test_co_inc"
    assert co["legal_name"] == "Test Co, Inc."
    # CompanyDetail shape — page.tsx depends on these
    assert isinstance(co.get("people"), list)
    assert isinstance(co.get("emails"), list)
    assert isinstance(co.get("red_flags"), list)


def test_company_detail_404(client):
    r = client.get("/api/companies/does-not-exist")
    assert r.status_code == 404


def test_articles_endpoint(client):
    r = client.get("/api/companies/test_co_inc/articles")
    assert r.status_code == 200
    arts = r.json()
    assert len(arts) == 1
    assert arts[0]["url"] == "https://brewbound.com/news/test-co"
    assert arts[0]["outlet"] == "Brewbound"


def test_facts_endpoint(client):
    r = client.get("/api/companies/test_co_inc/facts")
    assert r.status_code == 200
    fs = r.json()
    assert len(fs) == 1
    assert fs[0]["fact_type"] == "company_milestone"


def test_research_md_endpoint(client):
    r = client.get("/api/companies/test_co_inc/research-md")
    assert r.status_code == 200
    body = r.json()
    assert "Test Co" in body["markdown"]


def test_run_progress_unknown_id(client):
    r = client.get("/api/runs/9999/progress")
    assert r.status_code == 404


def test_recent_runs(client):
    r = client.get("/api/runs?limit=5")
    assert r.status_code == 200
    assert isinstance(r.json(), list)


def test_active_runs(client):
    r = client.get("/api/runs/active")
    assert r.status_code == 200
    assert isinstance(r.json(), list)


# ─── Progress endpoint contract ───────────────────────────────────────────


def test_progress_endpoint_phase_mapping(client, tmpdb):
    """The progress endpoint must read `current_phase` from the run row
    and emit the 6 UI steps with proper done/active flags. UI depends
    on the active flag for the spinner."""
    from aimerch import db
    rid = db.create_run("https://fixture.com/")
    # Phase: hooks → discover/articles/facts/validate_facts done; hooks active.
    db.update_run_phase(rid, "hooks", slug="test_co_inc")

    r = client.get(f"/api/runs/{rid}/progress")
    assert r.status_code == 200
    p = r.json()
    assert p["status"] == "running"
    assert p["phase"] == "hooks"

    steps = {s["key"]: s for s in p["steps"]}
    assert steps["discover"]["done"] is True
    assert steps["articles"]["done"] is True
    assert steps["facts"]["done"] is True
    assert steps["hooks"]["done"] is False
    assert steps["hooks"]["active"] is True
    assert steps["emails"]["done"] is False
    assert steps["research"]["done"] is False
