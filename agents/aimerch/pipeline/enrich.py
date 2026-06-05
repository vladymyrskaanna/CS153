"""Phase 2 — ENRICH.

Given Company + initial People, perform deep web research:
- Founding moment (vivid, specific, sourced)
- Family tree across generations
- Press / media trail (interviews, NBWA, podcasts, local news)
- Red flags (lawsuits, recent deaths, EEOC, estrangement, bankruptcy)
- LinkedIn URLs + email patterns for decision makers
- Pull quotes from interviews (gold for email hooks)
"""

from __future__ import annotations

import json
import re
from typing import Any

from ..llm import agent_loop
from ..config import MODEL_RESEARCH
from ..dedup import dedupe_people, normalize_name
from ..models import Company, Evidence, Person, RedFlag


ENRICH_SYSTEM = """You are an investigative analyst building a research dossier on a US beer/beverage distributor for B2B sales outreach. The output will be used to write a personalized cold email referencing the family's history.

Your job: take a company + initial people list and produce a thorough JSON research dossier.

Use web_search and web_fetch liberally. Spend up to 12 searches and 8 fetches.

Search targets, in priority order:
1. Founding story — a VIVID specific moment (a phone call, handshake, war story, radio ad). NOT "founded in 1950." Pull from local newspapers, obituaries, alumni magazines, podcast interviews. Quote the moment if possible.
2. Founder + key generation obituaries — Legacy.com, local newspaper archives, funeral home pages.
3. Press interviews of the current operator — Brewbound, Beer Business Daily, Cheers Online, Bar Business Magazine, NBWA press releases, podcast transcripts, alumni magazines.
4. Decision-maker LinkedIn URLs — search "[Name] LinkedIn [Company]". Capture the public profile URL.
5. Red flags — search "[Company] lawsuit", "[Company] EEOC", "[Last Name] family lawsuit [State] court", "[Founder] death", obituary < 12 months.
6. Brands carried, supplier relationships, recent acquisitions/expansions.

CRITICAL RULES:
- Every fact must have source_url. NO hallucinations. If you can't find something, return null/empty list.
- Founding moment must be SPECIFIC — name a year + person + a verb that describes the moment ("called the brewery", "drove a truck back from Pittsburgh", "shook hands with [name] at the door"). Generic "started a distributorship" is NOT enough.
- Pull quotes are gold — capture verbatim quotes from interviews with attribution.
- Each person referenced in research should match a person in the input list, OR be flagged as a new person to add.
- If the family has 5 generations, find a fact for each one. Missing-generation gaps are common; if so, mark generation=null.

DEDUP — IMPORTANT:
- One physical person = ONE entry across the whole research. Never list 'W. Rockwell "Rocky" Wirtz' AND 'W. Rockwell Wirtz' — they are the same person.
- When updating people, ALWAYS use the same full_name string the discover phase already chose (canonical). If you find the same person under a different name (e.g. nickname-only, with/without middle initial, with/without Jr/Sr), update the EXISTING entry — do NOT create a new one with a slightly different name.
- Normalize for matching: lowercase, ignore quoted nicknames, ignore middle initials, ignore suffixes Jr/Sr/II/III, ignore honorifics.

PARENT POINTER (for family tree):
- For every family member you find or update, set `parent_name` = the canonical full_name of their father/mother (the lineage that owns the company).
- The parent_name MUST exactly match the full_name of another person already in the list (or one you are also adding). Do not invent.
- Set spouse_name when known.

Output ONE valid JSON object only. Schema:

{
  "founding_moment": {
    "text": str,                    // the vivid sentence/quote
    "year": int|null,
    "founder_name": str,
    "source_url": str
  } | null,
  "family_facts": [                  // facts about specific family members
    {
      "person_name": str,
      "fact": str,
      "source_url": str,
      "generation": int|null
    }
  ],
  "people_updates": [                // updates to existing people OR new people
    {
      "full_name": str,              // MUST match existing canonical name when updating
      "is_new": bool,                // true if not in initial list
      "title": str|null,
      "role_category": str|null,
      "generation": int|null,
      "linkedin_url": str|null,
      "email": str|null,             // only if found in public source
      "is_deceased": bool,
      "death_year": int|null,
      "parent_name": str|null,       // canonical full_name of father/mother
      "spouse_name": str|null,
      "key_facts": [str, ...],
      "bio_short": str|null,
      "source_urls": [str, ...]
    }
  ],
  "press": [                          // media trail
    {
      "date": str|null,               // 'YYYY' or 'YYYY-MM' or 'YYYY-MM-DD'
      "outlet": str,
      "title": str|null,
      "url": str,
      "subject_person": str|null,     // who is the article about
      "quote": str|null,              // pull-quote if any
      "summary": str
    }
  ],
  "red_flags": [
    {
      "flag_type": "lawsuit"|"death"|"eeoc"|"estrangement"|"bankruptcy"|"other",
      "severity": "low"|"medium"|"high",
      "description": str,
      "source_url": str,
      "detected_year": int|null
    }
  ],
  "business_facts": {
    "primary_supplier": str|null,
    "brands_carried": [str, ...],
    "account_count": int|null,
    "counties_served": [str, ...],
    "states_served": [str, ...],
    "recent_news": [str, ...]         // bullet-style snippets of last 12 months
  }
}
"""


def _extract_json(text: str) -> dict:
    fence = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", text, re.DOTALL)
    if fence:
        return json.loads(fence.group(1))
    depth = 0
    start = -1
    for i, ch in enumerate(text):
        if ch == "{":
            if depth == 0:
                start = i
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0 and start >= 0:
                try:
                    return json.loads(text[start : i + 1])
                except json.JSONDecodeError:
                    continue
    raise ValueError(f"No valid JSON in: {text[:300]}")


def _build_user_message(company: Company, people: list[Person]) -> str:
    people_blob = "\n".join(
        f"  - {p.full_name} | title={p.title!r} | gen={p.generation} | "
        f"role={p.role_category} | deceased={p.is_deceased}"
        for p in people
    )
    return f"""Research this distributor in depth.

Company: {company.legal_name}
DBA: {company.dba or '—'}
State: {company.state}
Website: {company.website}
Founded: {company.founded_year}
Summary: {company.summary}

Initial people list ({len(people)} found):
{people_blob}

Now do deep web research as instructed. Output the JSON.

Pay special attention to:
1. The current CEO/President's interviews (alumni magazines, industry press, podcasts).
2. The founding moment of the company — find a specific scene worth quoting.
3. The most recent death in the family (last 12 months), if any.
4. Any active lawsuits involving the family or company.
5. LinkedIn URLs for the top 5 decision-makers.

Spend your searches wisely. Return JSON only."""


def enrich(
    company: Company,
    people: list[Person],
) -> tuple[dict, list[Person], list[Evidence], list[RedFlag], float]:
    """Run deep research. Returns (raw_research_json, updated_people, evidence, red_flags, cost)."""
    text, _blocks, cost = agent_loop(
        model=MODEL_RESEARCH,
        system=ENRICH_SYSTEM,
        user_message=_build_user_message(company, people),
        max_tokens=16000,
        enable_web_search=True,
        enable_web_fetch=True,
        temperature=0.3,
    )

    data = _extract_json(text)

    # Merge people_updates onto existing people, matching by NORMALIZED name so
    # 'W. Rockwell "Rocky" Wirtz' merges with 'W. Rockwell Wirtz'.
    by_name = {normalize_name(p.full_name): p for p in people if normalize_name(p.full_name)}
    for upd in data.get("people_updates") or []:
        name = (upd.get("full_name") or "").strip()
        if not name:
            continue
        key = normalize_name(name) or name.lower()
        if key in by_name:
            p = by_name[key]
        else:
            p = Person(full_name=name)
            people.append(p)
            by_name[key] = p
        for field in (
            "title", "role_category", "generation", "linkedin_url",
            "email", "bio_short", "parent_name", "spouse_name",
        ):
            v = upd.get(field)
            if v:
                setattr(p, field, v)
        if upd.get("is_deceased"):
            p.is_deceased = True
        if upd.get("death_year"):
            p.death_year = upd["death_year"]
        if upd.get("key_facts"):
            existing = set(p.key_facts)
            for f in upd["key_facts"]:
                if f and f not in existing:
                    p.key_facts.append(f)

    # Extract evidence rows
    evidence: list[Evidence] = []
    fm = data.get("founding_moment") or {}
    if fm.get("source_url"):
        evidence.append(Evidence(
            source_type="web", source_url=fm["source_url"],
            snippet=fm.get("text", ""), confidence=0.9,
        ))
    for ff in data.get("family_facts") or []:
        if ff.get("source_url"):
            evidence.append(Evidence(
                source_type="web", source_url=ff["source_url"],
                snippet=f"{ff.get('person_name','')}: {ff.get('fact','')}",
                confidence=0.8,
            ))
    for press in data.get("press") or []:
        if press.get("url"):
            snippet = press.get("quote") or press.get("summary") or press.get("title") or ""
            evidence.append(Evidence(
                source_type="news",
                source_url=press["url"],
                snippet=snippet,
                confidence=0.85,
            ))

    # Red flags
    red_flags: list[RedFlag] = []
    for rf in data.get("red_flags") or []:
        try:
            red_flags.append(RedFlag(
                flag_type=rf.get("flag_type", "other"),
                severity=rf.get("severity", "medium"),
                description=rf.get("description", ""),
                source_url=rf.get("source_url"),
            ))
        except Exception:
            pass

    # Update company facts
    bf = data.get("business_facts") or {}
    if bf.get("primary_supplier") and not company.primary_supplier:
        company.primary_supplier = bf["primary_supplier"]
    if bf.get("brands_carried"):
        company.brands = list({*company.brands, *bf["brands_carried"]})
    if bf.get("account_count") and not company.account_count:
        company.account_count = bf["account_count"]
    if fm.get("text") and not company.founding_moment:
        company.founding_moment = fm["text"]

    return data, people, evidence, red_flags, cost
