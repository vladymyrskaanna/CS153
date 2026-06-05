"""PersonProfileBuilder — deep dossier per person.

For each named person (after discover + photo-finder + article-hunter), this
agent runs a focused search to fill in:
  - education (schools, degrees, years)
  - career_summary (one-paragraph narrative bio)
  - related_article_urls (subset of the articles list that mention this person)
  - extra_facts (auxiliary public facts beyond the email-pipeline corpus)
  - email / phone if discoverable from non-restricted sources

One LLM call per person — moderate cost (~$0.20-0.40 each), ~30s.
"""

from __future__ import annotations

import json

from .base import Agent


SYSTEM_PROMPT = """You are a profile researcher building a deep dossier for ONE specific person at a US beer/beverage distributor. Your output is consumed by a sales operator who needs a one-glance profile before a call.

Your ONLY output is a JSON object — nothing else. Reply MUST start with `{` and end with `}`.

Photo extraction is a LOAD-BEARING goal. Aim for ≥80% photo coverage by trying multiple sources in parallel:

A. **LinkedIn** — `web_search` for "{full_name}" "{company}" linkedin → `web_fetch` the profile.
   - LinkedIn avatars live at `https://media.licdn.com/dms/image/...`
   - Even if LinkedIn returns a partial page, scan it for that pattern in `<img src>` and `<meta property="og:image">`
   - LinkedIn frequently 999s — if so, MOVE ON to (B) and (C); don't retry.

B. **Articles already collected** (passed in the input — do NOT re-search). For each article URL where the snippet/title mentions {full_name}, `web_fetch` the page and scan for an `<img>` whose `alt` attribute contains the person's name OR whose surrounding caption names them. Press photos and alumni-magazine portraits live here.

C. **Company /team or /leadership page** — `web_fetch` "{company-website}/team" or "/about/leadership" — most distributors have headshots on their own staff pages with `alt="{name}"`.

D. **Targeted image search** — `web_search` "{full_name}" "{company}" headshot OR portrait OR photo — returns image URLs in result snippets. Pick a clear single-person headshot, NOT a group photo.

E. **For deceased people**: Legacy.com obituary thumbnails (`https://d1q40j6jx1d8h6.cloudfront.net/Obituaries/{id}/Thumbnail_1.webp`) or funeral home portrait pages.

Always try A → B → C → D in order until you find a real headshot. Set `photo_source` to identify which path won.

Search strategy for the rest:
1. LinkedIn → education, career history, LinkedIn URL
2. Press/industry articles → key milestones, awards, quotes
3. Education → alumni directories, university press, athletic archives
4. Public contact info → company /team, NBWA panelist bios. NEVER scrape personal/private.

Output schema:

{
  "full_name": "exact full_name from input",
  "linkedin_url": "https://linkedin.com/in/... | null",
  "photo_url": "direct https URL to a headshot/avatar/portrait jpg|png|webp (NO query strings that expire) | null",
  "photo_source": "linkedin | company_team | press_article | obituary | nbwa | award_announcement | null",
  "email": "public email if findable on company site / press release | null",
  "phone": "public office phone if findable | null",
  "education": [
    { "school": "Cornell University", "degree": "MBA", "year": 1995, "source_url": "https://..." }
  ],
  "career_summary": "2-4 sentence narrative — joined company in YYYY, current title, key milestone, what they're known for in the industry.",
  "related_article_urls": [
    "https://brewbound.com/...",
    "https://nbwa.org/..."
  ],
  "extra_facts": [
    { "type": "award | board_position | hobby | quote | trade_role", "fact": "short fact", "source_url": "https://..." }
  ],
  "confidence": 0.0-1.0
}

Rules:
- Reply MUST be ONLY a valid JSON object. No prose, no fences.
- NEVER invent URLs / schools / years. Use only what you verify from web sources.
- `career_summary` is a single paragraph, max 4 sentences. Skip if you have no source.
- `related_article_urls` should be a subset of the input `articles` list — pick 2-5 most relevant.
- Skip empty fields with [] or null. Empty is fine.
- Education entries cite a source_url. If you can only find the school name without a year/degree, still include it with year/degree=null.
- Photo URL must be a DIRECT image URL (.jpg/.png/.webp), NOT a page URL. If the only thing you can find is the page that contains the photo, leave photo_url=null rather than emitting a non-image URL.
- Photo URL must be a SOLO portrait of THIS person — never group shots or company logos.
- Stop after the first valid photo is found; don't keep searching.
"""


class PersonProfileBuilder(Agent):
    name = "person_profile_builder"
    tools = "web"
    max_tokens = 12000  # was 4000 — too tight for the 4-step photo-extraction chain (LinkedIn → articles → company team page → image search) plus education/career/quotes JSON output
    temperature = 0.2
    system_prompt = SYSTEM_PROMPT

    def build_user_message(self, context: dict) -> str:
        company = context["company"]
        person = context["person"]
        articles = context.get("articles", [])
        # Surface name-mentioning articles first — these are the highest-value
        # sources for both photo extraction and biographical context.
        person_name_lower = person.full_name.lower()
        priority: list = []
        rest: list = []
        for a in articles[:60]:
            blob = (a.get("title", "") + " " + a.get("snippet", "") + " " + (a.get("subject_person") or "")).lower()
            (priority if person_name_lower in blob else rest).append(a)
        ordered = (priority + rest)[:30]
        article_blob = json.dumps(
            [
                {
                    "url": a.get("url"),
                    "title": a.get("title"),
                    "outlet": a.get("outlet"),
                    "mentions_person": person_name_lower in (a.get("title", "") + " " + a.get("snippet", "")).lower(),
                }
                for a in ordered
            ],
            default=str,
        )
        return f"""Build a profile for ONE person.

Company: {company.legal_name}
Website: {company.website or '?'}
State: {company.state or '?'}

Person:
  full_name: {person.full_name}
  current title: {person.title or '?'}
  generation: {person.generation if person.generation else '?'}
  is_deceased: {person.is_deceased}
  bio_so_far: {person.bio_short or '(none)'}
  linkedin_so_far: {person.linkedin_url or '(none)'}

Articles already collected by article-hunter (try web_fetch on the ones with `mentions_person: true` first — they're most likely to embed a headshot):
{article_blob}

Return the JSON profile object."""
