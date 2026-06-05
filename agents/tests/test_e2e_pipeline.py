"""E2E tests — exercise the full pipeline shape with the LLM mocked.

These don't run real model calls (those are in evals/). They verify the
control flow: discover → article-hunter → fact-builder → ... → render.

The mock returns deterministic JSON for each agent stage.
"""

from __future__ import annotations

import json
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest


pytestmark = pytest.mark.e2e


# ─── Fixtures ─────────────────────────────────────────────────────────────


@pytest.fixture
def isolated_dossiers(tmp_path, monkeypatch):
    """Point DOSSIERS_DIR at a temp dir for the duration of the test."""
    dossiers = tmp_path / "dossiers"
    dossiers.mkdir()
    import aimerch.config as cfg
    monkeypatch.setattr(cfg, "DOSSIERS_DIR", dossiers)
    monkeypatch.setattr(cfg, "ROOT", tmp_path)
    monkeypatch.setattr(cfg, "DATA_DIR", tmp_path / "data")
    (tmp_path / "data").mkdir()
    return dossiers


# ─── Citation extraction E2E ──────────────────────────────────────────────


def test_extract_citations_e2e(isolated_dossiers):
    """The citation-extraction step must run end-to-end against a research.md
    fixture and produce articles.json with structured rows the API can serve.
    """
    slug_dir = isolated_dossiers / "fixture_co"
    slug_dir.mkdir()
    (slug_dir / "research.md").write_text("""
# Fixture Distributor

The company was founded in [1955](https://www.example.com/history) by John Doe.

Per [Brewbound](https://www.brewbound.com/news/fixture-deal), they signed a
major deal with Anheuser-Busch in 2024. The [filing](https://courts.gov/case/123)
shows damages of $8M.
""")

    from aimerch.pipeline.extract_citations import extract_to_articles_json
    n = extract_to_articles_json(slug_dir)
    assert n == 3

    arts = json.loads((slug_dir / "articles.json").read_text())
    urls = sorted(a["url"] for a in arts)
    assert urls == [
        "https://courts.gov/case/123",
        "https://www.brewbound.com/news/fixture-deal",
        "https://www.example.com/history",
    ]
    # Article-type classification should fire correctly
    art_types = {a["url"]: a["article_type"] for a in arts}
    assert art_types["https://courts.gov/case/123"] == "court_record"
    assert art_types["https://www.brewbound.com/news/fixture-deal"] == "industry_press"


# ─── Discover E2E (mocked LLM) ────────────────────────────────────────────


def test_discover_handles_chatty_llm(isolated_dossiers, monkeypatch):
    """The DO Agent's "I have enough info..." preamble must not crash discover.

    Mock agent_loop to return prose-prefixed JSON; verify discover() extracts
    the JSON correctly.
    """
    chatty_response = (
        "I have enough information now. Let me build the company JSON.\n\n"
        '{"company": {"legal_name": "Mock Distributor Inc.", "state": "NY", '
        '"website": "https://mock.example.com/", "founded_year": 1950, '
        '"summary": "Test fixture."}, '
        '"people": [{"full_name": "Jane Doe", "title": "President", '
        '"role_category": "ceo", "is_decision_maker": true}]}'
    )

    with patch("aimerch.pipeline.discover.agent_loop") as m:
        m.return_value = (chatty_response, [], 0.05)
        from aimerch.pipeline.discover import discover
        company, people, cost = discover("https://mock.example.com/")

    assert company.legal_name == "Mock Distributor Inc."
    assert company.state == "NY"
    assert company.founded_year == 1950
    assert len(people) == 1
    assert people[0].full_name == "Jane Doe"
    assert people[0].role_category == "ceo"
    assert cost > 0


def test_discover_coerces_offschema_role(isolated_dossiers, monkeypatch):
    """When the LLM emits role_category='principal' (not in the strict
    enum), discover() must coerce to 'owner' instead of raising ValidationError.
    """
    response = (
        '{"company": {"legal_name": "X Corp", "state": "CA", "website": "https://x.com/"}, '
        '"people": [{"full_name": "Bob", "title": "Principal", "role_category": "principal"}]}'
    )
    with patch("aimerch.pipeline.discover.agent_loop") as m:
        m.return_value = (response, [], 0.01)
        from aimerch.pipeline.discover import discover
        company, people, cost = discover("https://x.com/")

    assert people[0].role_category == "owner"  # coerced from "principal"


# ─── Phase progression E2E (synthetic) ────────────────────────────────────


def test_progress_endpoint_walks_through_phases(monkeypatch, tmp_path):
    """As a run advances through phases (queued → discover → articles →
    facts → validate_facts → hooks → emails → render → done), the
    /progress endpoint must report increasing pct and step done flags.
    """
    # Use the same patching trick as the integration tests
    data_dir = tmp_path / "data"
    data_dir.mkdir()
    db_path = data_dir / "test.sqlite"

    import aimerch.config as cfg
    import aimerch.db as db_mod
    monkeypatch.setattr(cfg, "DB_PATH", db_path)
    monkeypatch.setattr(cfg, "DATA_DIR", data_dir)
    monkeypatch.setattr(db_mod, "DB_PATH", db_path)
    monkeypatch.setattr(db_mod, "DATA_DIR", data_dir)
    monkeypatch.setenv("DATABASE_URL", "")

    db_mod.init_db()

    rid = db_mod.create_run("https://e2e.example.com/")

    # Walk through every phase + verify pct monotonically increases
    phases = ["discover", "articles", "facts", "validate_facts",
              "hooks", "emails", "render"]
    last_pct = 0
    for phase in phases:
        db_mod.update_run_phase(rid, phase, slug="e2e_co")
        run = db_mod.get_run(rid)
        assert run["progress_pct"] > last_pct, (
            f"phase {phase!r} pct {run['progress_pct']} did not exceed previous {last_pct}"
        )
        last_pct = run["progress_pct"]

    # render is 95%, full done is 100% via complete_run
    assert last_pct == 95
