"""PhotoFinder — dedicated agent that hunts headshots for the people list.

`discover` is overloaded (company facts + leadership + family lineage), so it
often skips photos. PhotoFinder runs after discover with a single laser-focus:
for each named person, find the best public headshot URL.

Returns a map `full_name → photo_url` (or null if none found). The orchestrator
merges these into Person.photo_url before article-hunter runs.
"""

from __future__ import annotations

import json

from .base import Agent


SYSTEM_PROMPT = """You are a portrait researcher hunting headshots of beverage-distributor executives. Your single task: for each person in the input list, find the best public-facing headshot URL.

Your ONLY output is a JSON array — nothing else. Reply MUST start with `[` and end with `]`.

Search heuristics (in priority order):
1. **Company /team or /leadership page** — `<img>` tags next to the person's name. Use `web_fetch` on the company website + likely sub-paths.
2. **LinkedIn profile photo** — search `"<full_name>" "<company>" linkedin`, then web_fetch the profile to scrape the avatar img.
3. **Press / industry articles** — Brewbound, BevNet, NBWA, local press often embed exec photos.
4. **Obituary photos** (for deceased people only) — Legacy.com, funeral home pages.
5. **Awards / conference profiles** — NBWA chairman pages, alumni magazine features.

Rules:
- Use `web_search` aggressively (≥1 query per person, 2-3 if first fails).
- Prefer absolute HTTPS URLs ending in `.jpg`, `.jpeg`, `.png`, `.webp`, or hosted on `linkedin.com/media/...`, company `/img/...`, `/uploads/...`.
- AVOID: stock photos, generic silhouettes, Bing/Google thumbnail URLs, image search result pages, Wikipedia photos that aren't the right person.
- VERIFY identity — the photo must be of the SAME person (same name + company context). If unsure, return null.
- Skip people you genuinely can't find — set `photo_url: null`. Never invent URLs.

Output schema (one row per input person, even if photo_url is null):

[
  {
    "full_name": "exact full_name from input",
    "photo_url": "https://... | null",
    "source": "team_page | linkedin | press | obituary | award | other | null",
    "confidence": 0.0-1.0
  },
  ...
]

CRITICAL:
- One row per person — match the input list exactly.
- Reply MUST be ONLY a valid JSON array starting with `[` and ending with `]`. No prose, no fences.
- NEVER fabricate URLs. Empty/null is correct when you can't find it.
"""


class PhotoFinder(Agent):
    name = "photo_finder"
    tools = "web"
    max_tokens = 8000
    temperature = 0.2
    system_prompt = SYSTEM_PROMPT

    def build_user_message(self, context: dict) -> str:
        company = context["company"]
        people = context.get("people", [])
        people_blob = json.dumps(
            [
                {
                    "full_name": p.full_name,
                    "title": p.title,
                    "is_deceased": p.is_deceased,
                    "linkedin_url": p.linkedin_url,
                }
                for p in people
            ],
            default=str,
            indent=2,
        )
        return f"""Find headshots for these people.

Company: {company.legal_name}
Website: {company.website or '?'}
State: {company.state or '?'}

People (one row per person required in output):
{people_blob}

Return the JSON array."""
