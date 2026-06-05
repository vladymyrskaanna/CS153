"""Unit tests for aimerch.pipeline.extract_citations.

Covers every branch of the citation extractor: link parsing, dedup,
URL normalization, outlet/article-type classification, JSON merge with
existing articles.json.
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from aimerch.pipeline.extract_citations import (
    LINK_RE,
    _article_type_from_url,
    _outlet_from_url,
    extract_articles_from_markdown,
    extract_to_articles_json,
)


pytestmark = pytest.mark.unit


# ─── LINK_RE ──────────────────────────────────────────────────────────────

class TestLinkRegex:
    def test_simple_link(self):
        m = LINK_RE.search("see [Brewbound article](https://brewbound.com/x)")
        assert m is not None
        assert m.group(1) == "Brewbound article"
        assert m.group(2) == "https://brewbound.com/x"

    def test_link_inside_prose(self):
        text = "The deal was signed [in 2024](https://example.com/news/2024) per the report."
        m = LINK_RE.search(text)
        assert m.group(1) == "in 2024"

    def test_multiple_links(self):
        text = "[A](https://a.com) and [B](https://b.com)"
        matches = list(LINK_RE.finditer(text))
        assert len(matches) == 2

    def test_no_match_for_plain_url(self):
        # Plain URLs without [text](...) must not match
        m = LINK_RE.search("Visit https://example.com directly")
        assert m is None

    def test_no_match_for_reference_style(self):
        # `[text][ref]` reference-style links should not match
        m = LINK_RE.search("see [the article][ref1]")
        assert m is None

    def test_does_not_span_newlines(self):
        # Link text should not span newlines (would be malformed markdown)
        m = LINK_RE.search("[broken\nline](https://x.com)")
        assert m is None


# ─── _outlet_from_url ─────────────────────────────────────────────────────

class TestOutletFromUrl:
    @pytest.mark.parametrize("url, expected", [
        ("https://www.brewbound.com/news/x", "Brewbound"),
        ("https://brewbound.com/x", "Brewbound"),
        ("https://www.bevnet.com/x", "BevNET"),
        ("https://newsletter.bevnet.com/x", "BevNET"),
        ("https://beernet.com/x", "Beer Business Daily"),
        ("https://www.kenworth.com/about/x", "Kenworth News"),
        ("https://www.linkedin.com/company/x", "LinkedIn"),
        ("https://prospect.org/2022/x", "The American Prospect"),
        ("https://www.eeoc.gov/x", "EEOC"),
    ])
    def test_known_hosts(self, url, expected):
        assert _outlet_from_url(url) == expected

    def test_unknown_host_returns_hostname(self):
        # Unknown hosts fall through to the bare hostname
        assert _outlet_from_url("https://random-publisher.io/x") == "random-publisher.io"

    def test_malformed_url_returns_dash(self):
        assert _outlet_from_url("not-a-url") == "—"


# ─── _article_type_from_url ───────────────────────────────────────────────

class TestArticleType:
    @pytest.mark.parametrize("url, expected", [
        ("https://legacy.com/obit/john-smith", "obituary"),
        ("https://www.linkedin.com/in/x", "linkedin"),
        ("https://courts.ca.gov/case/12345", "court_record"),
        ("https://www.eeoc.gov/x", "eeoc"),
        ("https://www.brewbound.com/news/x", "industry_press"),
        ("https://www.bevnet.com/x", "industry_press"),
        ("https://www.kenworth.com/news/x", "press_release"),
        ("https://hws.edu/alumni/x", "alumni_magazine"),
        ("https://www.datanyze.com/companies/x", "data_aggregator"),
        ("https://en.wikipedia.org/wiki/x", "wikipedia"),
    ])
    def test_classification(self, url, expected):
        assert _article_type_from_url(url) == expected

    def test_default_other(self):
        assert _article_type_from_url("https://random-blog.com/post") == "other"

    def test_news_keyword_promotes_to_newspaper(self):
        assert _article_type_from_url("https://localnews.com/x") == "newspaper"


# ─── extract_articles_from_markdown ───────────────────────────────────────

class TestExtractArticles:
    def test_empty_string(self):
        assert extract_articles_from_markdown("") == []
        assert extract_articles_from_markdown(None) == []  # type: ignore

    def test_no_links(self):
        assert extract_articles_from_markdown("Plain text with no links.") == []

    def test_single_link(self):
        md = "See [the article](https://brewbound.com/news/x) for details."
        arts = extract_articles_from_markdown(md)
        assert len(arts) == 1
        assert arts[0]["url"] == "https://brewbound.com/news/x"
        assert arts[0]["title"] == "the article"
        assert arts[0]["outlet"] == "Brewbound"
        assert arts[0]["article_type"] == "industry_press"

    def test_dedup_same_url(self):
        # Same URL referenced twice should produce ONE article
        md = (
            "First [mention](https://brewbound.com/x) here.\n"
            "Second [different anchor text](https://brewbound.com/x) there."
        )
        arts = extract_articles_from_markdown(md)
        assert len(arts) == 1
        # We accumulate distinct quotes
        assert "different anchor text" in arts[0]["quotes"]

    def test_dedup_keeps_longer_title(self):
        md = (
            "[short](https://x.com)\n"
            "[a much more descriptive link text for the same source](https://x.com)"
        )
        arts = extract_articles_from_markdown(md)
        assert len(arts) == 1
        assert "descriptive" in arts[0]["title"]

    def test_strips_trailing_punctuation(self):
        # URLs ending with .,;:) should have those stripped
        md = "See [it](https://example.com/x.)."
        arts = extract_articles_from_markdown(md)
        assert arts[0]["url"] == "https://example.com/x"

    def test_assigns_stable_ids(self):
        md = "[a](https://a.com) [b](https://b.com) [c](https://c.com)"
        arts = extract_articles_from_markdown(md)
        ids = [a["id"] for a in arts]
        assert ids == ["art_001", "art_002", "art_003"]

    def test_quotes_capped_at_three(self):
        # Same URL referenced 5+ times — only first 3 distinct quotes kept
        md = "\n".join(f"[anchor{i}](https://x.com)" for i in range(5))
        arts = extract_articles_from_markdown(md)
        assert len(arts) == 1
        assert len(arts[0]["quotes"]) == 3


# ─── extract_to_articles_json (filesystem) ────────────────────────────────

class TestExtractToFile:
    def test_no_research_md_returns_zero(self, tmp_path):
        # If research.md doesn't exist, the function silently returns 0.
        assert extract_to_articles_json(tmp_path) == 0
        assert not (tmp_path / "articles.json").exists()

    def test_creates_articles_json(self, tmp_path):
        (tmp_path / "research.md").write_text(
            "Per [Brewbound](https://brewbound.com/x), the deal closed in 2024.",
            encoding="utf-8",
        )
        n = extract_to_articles_json(tmp_path)
        assert n == 1
        data = json.loads((tmp_path / "articles.json").read_text())
        assert data[0]["url"] == "https://brewbound.com/x"

    def test_merges_with_existing(self, tmp_path):
        # Pre-existing articles.json from article-hunter must be preserved
        existing = [
            {"id": "art_001", "url": "https://existing.com/x", "title": "kept"},
        ]
        (tmp_path / "articles.json").write_text(json.dumps(existing))
        (tmp_path / "research.md").write_text(
            "Also see [a new source](https://new-source.com/y).",
            encoding="utf-8",
        )
        n = extract_to_articles_json(tmp_path)
        assert n == 2
        data = json.loads((tmp_path / "articles.json").read_text())
        urls = [a["url"] for a in data]
        assert "https://existing.com/x" in urls
        assert "https://new-source.com/y" in urls

    def test_does_not_duplicate_existing_url(self, tmp_path):
        existing = [{"url": "https://x.com/a", "title": "kept"}]
        (tmp_path / "articles.json").write_text(json.dumps(existing))
        (tmp_path / "research.md").write_text(
            "[same source](https://x.com/a) appears in research.md too.",
            encoding="utf-8",
        )
        n = extract_to_articles_json(tmp_path)
        assert n == 1  # not 2 — dedup by URL

    def test_corrupt_existing_articles_json_recovers(self, tmp_path):
        # Garbage existing file shouldn't crash; we silently start fresh
        (tmp_path / "articles.json").write_text("garbage{not json")
        (tmp_path / "research.md").write_text("[x](https://y.com/z)")
        n = extract_to_articles_json(tmp_path)
        assert n == 1
