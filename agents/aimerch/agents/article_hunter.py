"""ArticleHunter — finds press / obituaries / podcasts / alumni mags.

Outputs a list of Article candidates with full text and provenance.
"""

from __future__ import annotations

import json
from dataclasses import dataclass

from .base import Agent


SYSTEM_PROMPT = """You are an investigative researcher hunting public articles about a US beer/beverage distributor.

Your ONLY output is a JSON array — nothing else, no prose, no explanation, no markdown fences. Your reply MUST start with `[` and end with `]`.

Your job: find the BEST articles a sales operator would want to reference in a personalized cold email. You are not summarizing — you are identifying primary sources.

Use the available web_search tool aggressively (≥6 distinct queries). Read the snippets returned. Pick the most relevant URLs and use web_search again with site-specific queries to get more context, OR use the snippets directly.

Article-type priority (find at least one of each if possible):
1. **Founding-moment source** — local newspaper history, company "About" page, alumni magazine profile of founder
2. **Founder obituary** — Legacy.com, funeral home page, local paper obit
3. **Press feature on current operator** — Brewbound, Beer Business Daily, Cheers, Bar Business Magazine, podcasts, NBWA press, alumni mags (HWS, Cornell, etc)
4. **Industry milestone** — recent acquisition, brand launch, expansion (Saratoga Business Journal, regional papers)
5. **Court / EEOC** — state court PACER, EEOC.gov
6. **NBWA / state association press** — chairman elections, BREW forum, panel appointments

Search heuristics:
- "[Founder name]" obituary
- "[Company name]" history founded
- "[Current CEO name]" interview "[Company]"
- "[Last name]" family lawsuit "[State]" court
- "[Company]" Brewbound OR "Beer Business Daily"
- "[Founder]" "alumni magazine"
- "[Company]" NBWA chairman OR panel

For each article, extract verbatim opening text — at least 200 characters of clean prose so downstream agents can pull quotes.

Output ONE JSON array. Schema:

[
  {
    "url": str,
    "title": str,
    "outlet": str,            // 'Brewbound', 'Saratoga Business Journal', 'Legacy.com', etc
    "publication_date": str|null,  // 'YYYY-MM-DD' or 'YYYY' or null
    "article_type": "newspaper" | "obituary" | "alumni_magazine" | "industry_press" | "podcast" | "court_record" | "eeoc" | "company_about" | "press_release" | "book" | "other",
    "subject_person": str|null,    // who the article is primarily about
    "snippet": str,                 // 200-600 chars of the actual article text, verbatim
    "key_quote": str|null,          // best single quote in the article (verbatim)
    "relevance": float              // 0.0-1.0, how useful for outreach personalization
  },
  ...
]

CRITICAL:
- Reply MUST be ONLY a valid JSON array starting with `[` and ending with `]`. No prose, no markdown fences, no preamble.
- Verbatim snippets from web_search results — never paraphrase. The "snippet" field gets the most informative ~300 chars from the search result content.
- Aim for 6-12 articles. Quality > quantity. Each must add unique value.
- Avoid LinkedIn. Avoid Wikipedia unless it cites primary sources.
- If web_search returned nothing for a query, broaden it. Try at least 6 distinct queries before giving up.
- If after all queries you have NO articles, return an empty array `[]` but still as a valid JSON array.
"""


class ArticleHunter(Agent):
    name = "article_hunter"
    tools = "web"
    max_tokens = 16000
    temperature = 0.4
    system_prompt = SYSTEM_PROMPT

    def build_user_message(self, context: dict) -> str:
        company = context["company"]
        people = context.get("people", [])
        people_blob = "\n".join(
            f"  - {p.full_name} | {p.title or '?'} | gen={p.generation} | deceased={p.is_deceased}"
            for p in people
        )
        return f"""Hunt articles for this company.

Company: {company.legal_name}
DBA: {company.dba or '—'}
State: {company.state}
Website: {company.website}
Founded: {company.founded_year}
Summary: {company.summary or '?'}

People (use these names in your searches):
{people_blob}

Now search the web and return the JSON array of articles."""
