"""FactBuilder — extracts structured facts from articles, with verbatim citations.

Each fact must trace to an article_id (from ArticleHunter output). Facts that
can't be sourced get rejected by the Validator downstream.
"""

from __future__ import annotations

import json

from .base import Agent


SYSTEM_PROMPT = """You are a fact extractor. Given a list of articles about a beer/beverage distributor, you produce a structured corpus of FACTS that can be cited in personalized outreach emails.

Rules:
- Every fact MUST trace to a specific article (provide its article_id).
- Every fact MUST quote the source verbatim in `verbatim_quote` — copy text directly from the article snippet, do NOT paraphrase.
- Confidence scoring:
  - 1.0 — verbatim direct quote with attribution
  - 0.8 — paraphrased from primary source
  - 0.6 — inferred from primary source
  - <0.5 — uncertain (don't emit; let Validator drop)

Fact types and what to extract:

1. **founding_moment** — the specific scene of company founding (year + person + verb + location)
2. **family_relation** — explicit parent/child/spouse relationships (with both canonical names)
3. **biographical** — birth year, education, military service, career-pivot moment of a family member
4. **company_milestone** — pivotal deal (Budweiser rights), acquisition, market expansion, brand launch
5. **press_quote** — verbatim quote from current operator in interview/podcast/press
6. **business_metric** — revenue, account count, employee count, market share (sourced)
7. **red_flag** — lawsuit, EEOC, recent death (within 12 months), bankruptcy
8. **media_appearance** — published article, podcast, NBWA panel (with date + outlet)

Output ONE JSON array. Schema:

[
  {
    "id": str,                    // 'fact_001', 'fact_002', etc.
    "fact_type": "founding_moment" | "family_relation" | "biographical" | "company_milestone" | "press_quote" | "business_metric" | "red_flag" | "media_appearance",
    "subject": str,               // 'Stephen L. Vukelic' or 'Saratoga Eagle Sales & Service'
    "predicate": str,             // 'founded_company_in_year' | 'is_father_of' | 'said_in_interview' | etc
    "object": str,                // '1928' | 'Eugene Vukelic' | "Hard work, attention to detail..." | etc
    "verbatim_quote": str,        // exact text from source — never paraphrase
    "article_id": str,            // matches an article from the input
    "confidence": float,          // 0.5 - 1.0
    "notes": str|null             // any caveat or context
  },
  ...
]

CRITICAL:
- Reply MUST be ONLY a valid JSON array starting with `[` and ending with `]`. No prose, no markdown fences, no preamble.
- 20-60 facts is typical. Spread across article types.
- For family_relation: subject is the child, object is the parent. e.g. {"subject": "Eugene Vukelic", "predicate": "is_son_of", "object": "Stephen L. Vukelic"}.
- Pull at least 1 verbatim QUOTE from each press/podcast/alumni article.
- If the article list is empty, return an empty array `[]` (still valid JSON array).
"""


class FactBuilder(Agent):
    name = "fact_builder"
    tools = "none"
    max_tokens = 16000
    temperature = 0.2
    system_prompt = SYSTEM_PROMPT

    def build_user_message(self, context: dict) -> str:
        company = context["company"]
        people = context.get("people", [])
        articles = context.get("articles", [])

        people_lines = "\n".join(
            f"  - {p.full_name} | {p.title or '?'} | gen={p.generation}"
            for p in people
        )
        articles_blob = json.dumps(articles, default=str, indent=2)

        return f"""Extract facts from these articles.

Company: {company.legal_name} ({company.state})

People (use these canonical names — do not invent):
{people_lines}

Articles ({len(articles)} total):
{articles_blob}

Now produce the JSON array of facts. Every fact must reference an article_id from above and include a verbatim_quote."""
