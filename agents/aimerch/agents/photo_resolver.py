"""PhotoResolver — single-purpose second-pass agent for finding ONE person's photo.

Runs ONLY for people that PersonProfileBuilder couldn't get a photo for. PPB
has many goals (education, career, articles, contact, photo); when token budget
runs out, photo is often the casualty. This agent has ONE goal — return a
direct image URL — and gets the full token budget for that.

Cost: ~$0.05-0.15 per person. Only runs for people without a photo, so impact
is bounded.
"""

from __future__ import annotations

import json

from .base import Agent


SYSTEM_PROMPT = """You are a single-purpose photo finder for ONE specific person at a US beer/beverage distributor. Your ONLY goal: return ONE direct image URL of a clear solo headshot of this person.

Reply MUST be ONLY a valid JSON object. Start with `{` end with `}`. No prose.

Output schema:

{
  "full_name": "exact full_name from input",
  "photo_url": "direct https URL ending in .jpg/.png/.webp | null",
  "photo_source": "press_article | linkedin | company_team | alumni_magazine | obituary | nbwa | award | other | null",
  "confidence": 0.0-1.0,
  "search_log": "1-line summary of which URLs you fetched"
}

CRITICAL: You DO NOT have web_search. Use ONLY web_fetch on the URLs provided in the input. The previous agents (article-hunter, person-profile-builder) already found the high-signal URLs — your job is to scan THEIR HTML for an embedded headshot. No new searches are allowed.

Routine — fetch the input URLs in this priority order until you find a portrait:

1. **Related articles** — fetch each `related_article_url` (these are pre-verified to mention the person). Look for `<img>` whose `alt=` contains the person's name OR whose surrounding caption names them. Press features and alumni magazines almost always embed an exec headshot.

2. **LinkedIn URL** — if the input includes a `linkedin_url`, web_fetch it. LinkedIn often 999s; if it does, MOVE ON immediately, don't retry.

3. **Company team page** — if a `company_team_url` is in the input (e.g. `https://{site}/team` or `/leadership`), web_fetch it. Distributors usually have headshots with `alt="{name}"`.

4. **Obituary** (only for deceased) — if an `obituary_url` is in the input, web_fetch it. Legacy.com / amigone.com / funeral home pages embed portrait thumbnails.

Stop conditions:
- Found a direct image URL (.jpg/.png/.webp) embedded in one of the fetched pages → emit it, set confidence ≥ 0.7, return.
- All input URLs fetched, no portrait found → emit null with confidence 0.

CRITICAL:
- photo_url must be a DIRECT image URL (ends in .jpg/.jpeg/.png/.webp), absolute https URL.
- The image must be a SOLO portrait of THIS person — never group shots, logos, or generic placeholder avatars.
- Resolve relative URLs against the page being fetched (e.g. `/wp-content/uploads/photo.jpg` on `example.com/article` → `https://example.com/wp-content/uploads/photo.jpg`).
- Don't invent URLs. If you can't verify the image exists in fetched HTML, return null.
- Don't burn tool calls — at most 1 web_fetch per input URL, then commit.
"""


class PhotoResolver(Agent):
    name = "photo_resolver"
    # `fetch` only — no web_search. The previous agents already discovered
    # the URLs that mention this person; we only need to fetch + scrape them.
    tools = "fetch"
    max_tokens = 6000
    temperature = 0.2
    system_prompt = SYSTEM_PROMPT

    def build_user_message(self, context: dict) -> str:
        company = context["company"]
        person = context["person"]
        articles = context.get("articles", [])
        # Build the URL slate this agent should fetch. Prefer (a) PPB's own
        # related_article_urls, (b) article-hunter articles whose snippet
        # mentions this person, (c) the company /team URL, (d) LinkedIn.
        person_name = (person.full_name or "").lower()
        article_url_slate: list[str] = []
        for u in (person.related_article_urls or []):
            if u and u not in article_url_slate:
                article_url_slate.append(u)
        for a in articles:
            url = a.get("url")
            if not url or url in article_url_slate:
                continue
            blob = (a.get("title", "") + " " + a.get("snippet", "") + " " + (a.get("subject_person") or "")).lower()
            if person_name and person_name in blob:
                article_url_slate.append(url)
        article_url_slate = article_url_slate[:8]
        team_url = None
        if company.website:
            base = company.website.rstrip("/")
            team_url = f"{base}/team"

        return f"""Find ONE direct headshot URL for this person — by fetching ONLY the URLs below.

Company: {company.legal_name}
Website: {company.website or '?'}

Person:
  full_name: {person.full_name}
  current title: {person.title or '?'}
  generation: {person.generation if person.generation else '?'}
  is_deceased: {person.is_deceased}
  linkedin_url: {person.linkedin_url or '(none)'}

URLs to fetch (in priority order — DO NOT search the web, ONLY fetch these):
- related_article_urls: {json.dumps(article_url_slate, indent=2) if article_url_slate else '  (none)'}
- linkedin_url: {person.linkedin_url or '(none)'}
- company_team_url: {team_url or '(none)'}

Return ONLY the JSON object."""
