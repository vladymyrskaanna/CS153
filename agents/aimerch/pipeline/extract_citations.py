"""Extract `[text](URL)` citations from research.md → articles.json.

Used as a fallback / enrichment step: even when article-hunter returns an
empty list, the synthesize phase still writes a research.md packed with
inline source links (DO Agent calls Tavily MCP automatically). We harvest
those links so the dashboard's Evidence tab and the user can audit every
factual claim by clicking through to the source.
"""

from __future__ import annotations

import json
import re
from pathlib import Path
from urllib.parse import urlparse


# Match [link text](url) — supports nested brackets via lazy [^]] match.
LINK_RE = re.compile(r"\[([^\]\n]{1,300})\]\((https?://[^\s\)]+)\)")


def _outlet_from_url(url: str) -> str:
    try:
        host = urlparse(url).hostname or ""
    except Exception:
        return "—"
    host = host.lower().replace("www.", "")
    return {
        "brewbound.com": "Brewbound",
        "bevnet.com": "BevNET",
        "newsletter.bevnet.com": "BevNET",
        "beernet.com": "Beer Business Daily",
        "kenworth.com": "Kenworth News",
        "linkedin.com": "LinkedIn",
        "datanyze.com": "Datanyze",
        "rocketreach.co": "RocketReach",
        "legacy.com": "Legacy.com",
        "prospect.org": "The American Prospect",
        "saratogabusinessjournal.com": "Saratoga Business Journal",
        "hws.edu": "Hobart and William Smith Colleges",
        "hwsalumninews.com": "HWS Alumni News",
        "drinksinternational.com": "Drinks International",
        "wsj.com": "The Wall Street Journal",
        "nytimes.com": "The New York Times",
        "courts.ca.gov": "California Courts",
        "ny.gov": "New York State",
        "eeoc.gov": "EEOC",
    }.get(host, host or "—")


def _article_type_from_url(url: str) -> str:
    h = (urlparse(url).hostname or "").lower()
    if "obit" in url.lower() or "legacy.com" in h or "funeral" in h:
        return "obituary"
    if "linkedin.com" in h:
        return "linkedin"
    if "court" in h or "pacer" in h or "case" in url.lower():
        return "court_record"
    if "eeoc" in h:
        return "eeoc"
    if any(k in h for k in ("brewbound.com", "bevnet.com", "beernet.com", "drinksinternational.com")):
        return "industry_press"
    if "kenworth.com" in h or "vendor" in url.lower():
        return "press_release"
    if any(edu in h for edu in (".edu", "alumni")):
        return "alumni_magazine"
    if "datanyze.com" in h or "rocketreach.co" in h:
        return "data_aggregator"
    if "wikipedia.org" in h:
        return "wikipedia"
    return "newspaper" if "news" in h or "journal" in h or "times" in h else "other"


def extract_articles_from_markdown(md_text: str) -> list[dict]:
    """Return a deduplicated list of articles found as `[text](url)` in markdown.

    For each unique URL we keep the FIRST link text encountered (usually the
    most descriptive) and accumulate up to 3 distinct quote variants from
    that URL across the document (used as snippets).
    """
    if not md_text:
        return []
    seen: dict[str, dict] = {}
    for m in LINK_RE.finditer(md_text):
        text = m.group(1).strip()
        url = m.group(2).rstrip(".,;:)")  # strip trailing punctuation
        if url not in seen:
            seen[url] = {
                "id": f"art_{len(seen)+1:03d}",
                "url": url,
                "title": text[:240],
                "outlet": _outlet_from_url(url),
                "publication_date": None,
                "article_type": _article_type_from_url(url),
                "snippet": text,
                "key_quote": text if len(text) > 40 else None,
                "relevance": 0.7,
                "quotes": [text],
            }
        elif text and text not in seen[url]["quotes"] and len(seen[url]["quotes"]) < 3:
            seen[url]["quotes"].append(text)
            # If we got a longer / more useful link text, prefer it as the title
            if len(text) > len(seen[url]["title"]):
                seen[url]["title"] = text[:240]
            seen[url]["snippet"] = " · ".join(seen[url]["quotes"])
    return list(seen.values())


def extract_to_articles_json(folder: Path) -> int:
    """Read folder/research.md, write folder/articles.json. Returns count.

    If articles.json already has content, MERGE — never overwrite existing
    article-hunter output. Add only new URLs.
    """
    md_path = folder / "research.md"
    if not md_path.exists():
        return 0
    md = md_path.read_text(encoding="utf-8")
    extracted = extract_articles_from_markdown(md)

    existing_path = folder / "articles.json"
    existing: list[dict] = []
    if existing_path.exists():
        try:
            existing = json.loads(existing_path.read_text(encoding="utf-8"))
            if not isinstance(existing, list):
                existing = []
        except Exception:
            existing = []

    # Merge: keep existing entries, append new URLs only
    existing_urls = {a.get("url") for a in existing if isinstance(a, dict)}
    merged = list(existing)
    for art in extracted:
        if art["url"] not in existing_urls:
            merged.append(art)
            existing_urls.add(art["url"])

    existing_path.write_text(json.dumps(merged, indent=2, default=str))
    return len(merged)
