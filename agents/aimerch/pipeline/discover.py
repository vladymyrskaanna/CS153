"""Phase 1 — DISCOVER.

Given a URL, identify the company and a starter list of decision-makers.
Uses Claude with web_fetch to crawl the company site (handles age gates better
than raw httpx).
"""

from __future__ import annotations

import json
import re
from urllib.parse import urlparse

from ..agents.base import extract_json as _robust_extract
from ..llm import agent_loop
from ..config import MODEL_EXTRACT
from ..models import Company, Person


DISCOVER_SYSTEM = """You are a research analyst building a profile of a US beer or beverage distributor.

Your job: take a company URL and produce structured JSON with company basics and a leadership list.

Rules:
- Use web_fetch on the URL itself plus 3-6 likely sub-pages (/about, /our-story, /history, /team, /leadership, /family, /news, /contact, /careers).
- If the homepage is age-gated or blocks, try the same paths on a Google cached version, or try fetching their LinkedIn About page if linked.
- Output ONE valid JSON object only. No prose, no markdown fences. Start with `{` and end with `}`.
- Empty fields → null. Lists with no items → [].
- Generation: 1 = founder, 2 = founder's children, 3 = grandchildren, 4 = great-grandchildren, 5 = next gen.
- role_category one of: ceo, owner, president, cfo, coo, vp_sales, vp_ops, director, heir, board, founder, other.
- Cite source URL for each person if you found their name on a specific page.

DEDUP RULES (critical):
- One physical person = ONE entry. NEVER emit the same person twice with different name forms.
- 'W. Rockwell "Rocky" Wirtz' and 'W. Rockwell Wirtz' and 'Rocky Wirtz' are the SAME person — pick one canonical name (prefer the one with the nickname in quotes for human readability) and merge everything you know.
- 'Jeffrey "Jeff" Vukelic', 'Jeff Vukelic', and 'Jeffrey Vukelic Jr.' → ONE entry.
- Before adding a new person, scan the list-so-far for normalized matches (lowercase, ignore quoted nicknames, ignore middle initials, ignore Jr./Sr./II/III suffixes, ignore honorifics).
- If you see a person on the team page AND on a press article AND in an obituary — they're still ONE person.

PARENT POINTER (for family tree):
- For each family member, set `parent_name` to the CANONICAL full name of their father or mother (whichever is the family-business lineage parent — usually father in this industry).
- Set `parent_name` to null only for: the founder, in-laws/spouses with no descendants in the company, and non-family employees.
- The parent_name MUST exactly match another person's full_name field in this JSON output. Do not invent a parent who isn't in the list.
- Spouses: set `spouse_name` to canonical name of the husband/wife if known.

Schema:
{
  "company": {
    "legal_name": str,
    "dba": str|null,
    "state": str (2-letter),
    "website": str,
    "hq_address": str|null,
    "hq_phone": str|null,
    "founded_year": int|null,
    "employee_count": int|null,
    "primary_supplier": str|null,           // 'Anheuser-Busch', 'MillerCoors', etc.
    "brands": [str, ...],                   // notable beer/beverage brands carried
    "summary": str                           // 2-3 sentences plain-English about the business
  },
  "people": [
    {
      "full_name": str,
      "title": str|null,
      "role_category": str|null,
      "generation": int|null,
      "is_decision_maker": bool,
      "is_deceased": bool,
      "parent_name": str|null,              // exact full_name of father/mother (must be in this list)
      "spouse_name": str|null,              // exact full_name of husband/wife if known
      "family_relation_to": str|null,       // free-text 'son of [Founder]' for back-compat; prefer parent_name
      "bio_short": str|null,
      "key_facts": [str, ...],               // bullet-able facts you can cite
      "source_url": str|null,
      "linkedin_url": str|null,
      "photo_url": str|null                  // headshot URL if you saw one on /team page or LinkedIn; null otherwise (a dedicated photo agent runs after this).
    }
  ]
}
"""


def _slugify(name: str) -> str:
    s = re.sub(r"[^a-zA-Z0-9]+", "_", name).strip("_").lower()
    return s or "company"


# role_category is a strict Literal on Person. The LLM sometimes returns
# off-schema values (vp_finance, principal, managing_director). We coerce
# to the closest allowed value so a single bad role doesn't crash a run.
ALLOWED_ROLES = {
    "ceo", "owner", "president", "cfo", "coo", "vp_sales",
    "vp_ops", "director", "heir", "board", "founder", "other",
}
ROLE_ALIASES = {
    "vp_finance": "cfo", "vp_operations": "vp_ops", "vp_sales_marketing": "vp_sales",
    "vp_sales_and_marketing": "vp_sales", "managing_director": "director",
    "general_manager": "director", "gm": "director",
    "co_owner": "owner", "co-owner": "owner", "co_ceo": "ceo",
    "vice_president": "director", "executive_vp": "director",
    "cmo": "other", "cto": "other", "cio": "other", "chro": "other",
    "principal": "owner", "chairman": "board", "chairperson": "board",
}


def coerce_role(raw):
    """Map any LLM-emitted role string to one of ALLOWED_ROLES, defaulting to 'other'.

    None passes through unchanged (role_category is Optional).
    """
    if raw is None:
        return None
    s = str(raw).strip().lower().replace(" ", "_").replace("-", "_")
    if s in ALLOWED_ROLES:
        return s
    if s in ROLE_ALIASES:
        return ROLE_ALIASES[s]
    return "other"


def _normalize_url(url: str) -> str:
    if not url.startswith(("http://", "https://")):
        url = "https://" + url
    return url


def _extract_json(text: str) -> dict:
    """Find the largest {...} JSON object in text using the string-aware
    extractor from base.py. Tolerant of conversational preamble like
    'I have enough info...' that DO Agent occasionally emits.
    """
    parsed = _robust_extract(text)
    if isinstance(parsed, dict):
        return parsed
    raise ValueError(f"Expected JSON object, got {type(parsed).__name__}: {str(parsed)[:300]}")


def discover(url: str, hint: str | None = None) -> tuple[Company, list[Person], float]:
    """Return (Company, list[Person], cost_usd)."""
    url = _normalize_url(url)
    user_msg = (
        f"Research this distributor: {url}\n\n"
        + (f"Additional hint from user: {hint}\n\n" if hint else "")
        + "Fetch the homepage and key sub-pages. Build the JSON per the schema.\n"
        "If the site is age-gated, try fetching with `web_fetch` anyway — Anthropic's "
        "fetcher often gets through. As a fallback, fetch the company's LinkedIn 'About' "
        "or a CompanyTrue/Indeed mirror.\n\n"
        "Be thorough on people — find every named family member, every C-level, every "
        "VP, even ones whose role is unclear. Better to over-include than miss someone. "
        "(A dedicated photo agent runs after you — `photo_url` is optional here.)\n\n"
        "RESPONSE FORMAT (CRITICAL):\n"
        "Your ENTIRE response must be a single JSON object, nothing else.\n"
        "DO NOT prefix with 'I have enough info', 'Let me check', 'Here is', or any other prose.\n"
        "DO NOT wrap in ```json fences. The very first character of your response must be `{`."
    )

    text, _blocks, cost = agent_loop(
        model=MODEL_EXTRACT,
        system=DISCOVER_SYSTEM,
        user_message=user_msg,
        max_tokens=16000,
        enable_web_search=True,
        enable_web_fetch=True,
        temperature=0.2,
    )

    # First parse attempt with the robust extractor. If it fails, do ONE
    # retry telling the model its previous output had no JSON and asking
    # it to convert. This handles the DO Agent's occasional habit of
    # narrating instead of producing structured output.
    try:
        data = _extract_json(text)
    except ValueError:
        from ..llm import chat as _chat
        retry_text, _b, retry_cost = _chat(
            model=MODEL_EXTRACT,
            system="You convert prose research notes into the exact JSON schema requested. "
                   "Output ONLY the JSON object. No prose. First character must be `{`.",
            messages=[{
                "role": "user",
                "content": (
                    f"Below is research about {url}. Convert it to a single JSON object "
                    f"that matches this schema:\n\n{DISCOVER_SYSTEM[DISCOVER_SYSTEM.find('Schema:'):]}\n\n"
                    f"--- RESEARCH NOTES ---\n{text[:12000]}\n\n"
                    "Output the JSON object only."
                ),
            }],
            max_tokens=16000,
            temperature=0.1,
        )
        cost += retry_cost
        data = _extract_json(retry_text)
    co = data.get("company", {})
    legal_name = co.get("legal_name") or urlparse(url).netloc
    company = Company(
        slug=_slugify(legal_name),
        legal_name=legal_name,
        dba=co.get("dba"),
        state=co.get("state"),
        website=co.get("website") or url,
        hq_address=co.get("hq_address"),
        hq_phone=co.get("hq_phone"),
        founded_year=co.get("founded_year"),
        employee_count=co.get("employee_count"),
        primary_supplier=co.get("primary_supplier"),
        brands=co.get("brands") or [],
        summary=co.get("summary"),
    )

    people: list[Person] = []
    for p in data.get("people") or []:
        people.append(
            Person(
                full_name=p.get("full_name") or "Unknown",
                title=p.get("title"),
                role_category=coerce_role(p.get("role_category")),
                generation=p.get("generation"),
                is_decision_maker=bool(p.get("is_decision_maker")),
                is_deceased=bool(p.get("is_deceased")),
                family_relation_to=p.get("family_relation_to"),
                parent_name=p.get("parent_name"),
                spouse_name=p.get("spouse_name"),
                bio_short=p.get("bio_short"),
                key_facts=p.get("key_facts") or [],
                linkedin_url=p.get("linkedin_url"),
                photo_url=p.get("photo_url"),
            )
        )

    return company, people, cost
