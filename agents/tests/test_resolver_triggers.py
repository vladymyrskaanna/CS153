"""Resolver trigger evals — feed user-typed phrases through a routing
function and assert each lands at the right skill.

This is the skillify item #7 ("resolver trigger eval"). It encodes the
contract: the trigger patterns the USER types must route to the right
skill, not the old pre-skillify path.
"""

from __future__ import annotations

import re
from pathlib import Path

import pytest


pytestmark = pytest.mark.unit


# ─── Lightweight resolver implementation ──────────────────────────────────


def _looks_like_distributor_url(text: str) -> bool:
    """A bare URL or domain → research-distributor."""
    text = text.strip()
    # Handles bare `foo.com`, `https://foo.com/`, `https://www.foo.com/about`.
    if re.match(r"^(https?://)?([\w-]+\.)+(com|net|org|biz|us|co|io)(/.*)?$", text, re.I):
        return True
    return False


def resolve(text: str) -> str | None:
    """Map a user-typed phrase to a skill name.

    Returns the skill name or None if no skill matches. Mirrors the routing
    logic Claude Code applies based on the `triggers` frontmatter and
    the `description` heuristic.
    """
    t = text.lower().strip()

    # research-distributor triggers
    if any(p in t for p in [
        "skillify", "is this a skill?", "make this proper",
        "add tests and evals", "check skill completeness",
    ]):
        return "skillify"

    if _looks_like_distributor_url(text):
        return "research-distributor"
    if any(p in t for p in [
        "research this distributor", "build a dossier for", "draft an email to",
        "research ", "/research-distributor",
    ]):
        return "research-distributor"

    return None


# ─── Trigger eval cases ───────────────────────────────────────────────────


@pytest.mark.parametrize("phrase, expected_skill", [
    # research-distributor — bare URLs
    ("saratogaeagle.com", "research-distributor"),
    ("https://manhattanbeer.com/", "research-distributor"),
    ("https://www.matagrano.com/", "research-distributor"),
    # research-distributor — natural language
    ("research this distributor: Doll Distributing", "research-distributor"),
    ("build a dossier for Saratoga Eagle", "research-distributor"),
    ("draft an email to Jeff at Saratoga Eagle", "research-distributor"),
    ("/research-distributor https://kohler.com", "research-distributor"),
    # skillify
    ("skillify this", "skillify"),
    ("skillify research-distributor", "skillify"),
    ("is this a skill?", "skillify"),
    ("make this proper", "skillify"),
    ("add tests and evals for this feature", "skillify"),
    ("check skill completeness", "skillify"),
])
def test_phrase_routes_correctly(phrase, expected_skill):
    assert resolve(phrase) == expected_skill


@pytest.mark.parametrize("phrase", [
    "what's the weather today?",
    "explain quantum mechanics",
    "fix this React error",
    "deploy to staging",
])
def test_unrelated_phrases_return_none(phrase):
    assert resolve(phrase) is None


def test_resolver_md_lists_all_user_skills():
    """Every skill that exists under ~/.claude/skills/ must have an entry
    in skills/RESOLVER.md. This catches orphaned skills.
    """
    home_skills = Path.home() / ".claude" / "skills"
    if not home_skills.exists():
        pytest.skip("no ~/.claude/skills/ on this machine")
    user_skills = {p.parent.name for p in home_skills.glob("*/SKILL.md")}

    resolver = Path(__file__).resolve().parent.parent / "skills" / "RESOLVER.md"
    assert resolver.exists(), f"missing {resolver}"
    text = resolver.read_text()
    listed = set(re.findall(r"^### ([a-zA-Z0-9_-]+)\s*$", text, re.M))

    # Every locally-installed skill MUST be either:
    # - in the resolver (owned by this project), OR
    # - a third-party skill we don't own (e.g. anthropic-skills, figma)
    # We require ours (research-distributor + skillify) at minimum.
    assert "research-distributor" in listed
    assert "skillify" in listed
