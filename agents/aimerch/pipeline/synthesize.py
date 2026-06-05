"""Phase 3 — SYNTHESIZE.

Generate three artifacts from research data:
1. research.md — long-form structured research document
2. dossier.html — editorial-quality HTML dossier (matches existing style)
3. emails — N role-specific personalized emails

The hook for each email MUST come from the research evidence, not a template.
"""

from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Iterable, Optional

from ..config import MODEL_SYNTHESIZE, OPERATOR
from ..llm import chat
from ..models import Company, Email, Evidence, Person, RedFlag


# Roles we generate emails for, in priority order.
DEFAULT_ROLES = ("ceo_owner", "cfo_ops", "vp_sales")

ROLE_LABELS = {
    "ceo_owner": "CEO / Owner / President (decision maker)",
    "cfo_ops": "CFO / VP Operations / COO (efficiency frame)",
    "vp_sales": "VP Sales / Sales Director (revenue & shelf execution frame)",
    "director": "Director-level (career-momentum frame)",
    "heir": "Next-generation heir (generational handoff frame)",
}

ROLE_HOOK_GUIDANCE = {
    "ceo_owner": (
        "Family-legacy hook. Open with a SPECIFIC, vivid, sourced founding moment from research. "
        "Use the construction 'a single decision that would define the next [N] years' if appropriate. "
        "End paragraph 1 with 'He/she built the company through [historical events of his/her era].' "
        "DO NOT use a generic opener. The moment must come from research evidence."
    ),
    "cfo_ops": (
        "Efficiency + ROI hook. Open by naming a specific operational fact you found in research "
        "(brand acquisition, expansion, AOR change), then bridge to operational/financial leverage. "
        "Reference Manhattan Beer with a concrete metric (e.g. 'cut audit time 70%, saved $X on shrinkage'). "
        "Avoid family-legacy framing — CFOs respond to numbers."
    ),
    "vp_sales": (
        "Revenue + shelf-execution hook. Open by naming a brand from their portfolio + a market "
        "moment (e.g. recent acquisition, brand launch, portfolio shift). Bridge to sell-through, "
        "void detection, distribution gaps. Reference Manhattan Beer with sales-lift metric."
    ),
    "director": (
        "Career-momentum + visibility hook. Open with a specific Director-level detail — promotion, "
        "recent panel appearance, project they led. Position AI Intelligence as making their work more visible. "
        "Lower-key tone."
    ),
    "heir": (
        "Generational-handoff hook. Open with the heir's father/mother and what they built. "
        "Pivot to 'You will face the AI test of your generation.' Lower volume on AI Intelligence credentials, "
        "higher volume on legacy and continuity."
    ),
}


def _format_evidence_pack(
    company: Company,
    people: list[Person],
    evidence: list[Evidence],
    red_flags: list[RedFlag],
    research_data: dict,
) -> str:
    """Single evidence pack used as system prompt input — cached across calls."""
    parts = ["# RESEARCH EVIDENCE PACK", ""]
    parts.append(f"## Company")
    parts.append(f"- Legal name: {company.legal_name}")
    parts.append(f"- DBA: {company.dba or '—'}")
    parts.append(f"- State: {company.state}")
    parts.append(f"- Website: {company.website}")
    parts.append(f"- Founded: {company.founded_year}")
    if company.summary:
        parts.append(f"- Summary: {company.summary}")
    if company.primary_supplier:
        parts.append(f"- Primary supplier: {company.primary_supplier}")
    if company.brands:
        parts.append(f"- Brands carried: {', '.join(company.brands[:30])}")
    parts.append("")

    fm = research_data.get("founding_moment") or {}
    if fm:
        parts.append("## Founding moment (the GOLD for paragraph 1 of CEO email)")
        parts.append(f"- Year: {fm.get('year')}")
        parts.append(f"- Founder: {fm.get('founder_name')}")
        parts.append(f"- Text: {fm.get('text')}")
        parts.append(f"- Source: {fm.get('source_url')}")
        parts.append("")

    parts.append("## People (decision makers + family)")
    for p in people:
        line = f"- **{p.full_name}**"
        if p.title:
            line += f" — {p.title}"
        if p.generation:
            line += f" (Gen {p.generation})"
        if p.is_deceased:
            line += f" [DECEASED{f' {p.death_year}' if p.death_year else ''}]"
        if p.linkedin_url:
            line += f" · LI: {p.linkedin_url}"
        if p.email:
            line += f" · email: {p.email}"
        parts.append(line)
        if p.bio_short:
            parts.append(f"  Bio: {p.bio_short}")
        if p.key_facts:
            for f in p.key_facts[:5]:
                parts.append(f"  · {f}")
    parts.append("")

    family_facts = research_data.get("family_facts") or []
    if family_facts:
        parts.append("## Family facts")
        for f in family_facts:
            parts.append(
                f"- {f.get('person_name', '?')}: {f.get('fact', '')} "
                f"[src: {f.get('source_url', '?')}]"
            )
        parts.append("")

    press = research_data.get("press") or []
    if press:
        parts.append("## Press / media trail")
        for pr in press:
            line = f"- {pr.get('date', '?')} | {pr.get('outlet', '?')}: {pr.get('title', '?')}"
            if pr.get("url"):
                line += f" — {pr['url']}"
            parts.append(line)
            if pr.get("quote"):
                parts.append(f"  QUOTE: \"{pr['quote']}\"")
            if pr.get("summary"):
                parts.append(f"  Summary: {pr['summary'][:200]}")
        parts.append("")

    if red_flags:
        parts.append("## RED FLAGS — affect tone of every email")
        for rf in red_flags:
            parts.append(
                f"- [{rf.severity.upper()}] {rf.flag_type}: {rf.description}"
                + (f" (src: {rf.source_url})" if rf.source_url else "")
            )
        parts.append("")

    bf = research_data.get("business_facts") or {}
    if bf:
        parts.append("## Business snapshot")
        for k, v in bf.items():
            if v:
                if isinstance(v, list):
                    parts.append(f"- {k}: {', '.join(str(x) for x in v[:20])}")
                else:
                    parts.append(f"- {k}: {v}")
        parts.append("")

    # Source URL index — every claim in the research.md must link back to one of these.
    seen_urls: set[str] = set()
    url_lines: list[str] = []
    for ev in evidence:
        if ev.source_url and ev.source_url not in seen_urls:
            seen_urls.add(ev.source_url)
            url_lines.append(f"- {ev.source_url} — {(ev.snippet or '')[:140]}")
    fm = research_data.get("founding_moment") or {}
    if fm.get("source_url") and fm["source_url"] not in seen_urls:
        seen_urls.add(fm["source_url"])
        url_lines.append(f"- {fm['source_url']} — founding moment: {(fm.get('text') or '')[:140]}")
    for press in research_data.get("press") or []:
        if press.get("url") and press["url"] not in seen_urls:
            seen_urls.add(press["url"])
            url_lines.append(f"- {press['url']} — {press.get('outlet', '')}: {press.get('title', '')}")
    if url_lines:
        parts.append("## Source URLs (cite these in research.md as inline markdown links)")
        parts.extend(url_lines)
        parts.append("")

    return "\n".join(parts)


# ───────────────────────── research.md ─────────────────────────

RESEARCH_MD_PROMPT = """You produce a structured research document about a US beer/beverage distributor. Use the evidence pack provided. Output 1500-3000 words of prose markdown.

Structure exactly:
# {COMPANY_NAME} — Research Dossier

## 1. Founding & origin story
A 3-4 paragraph narrative. Open with the most vivid sourced moment.
EVERY claim — year, person, deal, slogan — must end with an inline markdown link to the source URL: `[brewery purchase in 1965](https://example.com/article)`. Do NOT use footnote references like "[1]"; use real URLs.

## 2. Family tree (Generation 1 → today)
Per generation, name + dates + one-line role + one key fact, each fact ending with a `[source](URL)` link.

## 3. Current leadership
Markdown table: Name | Title | LinkedIn | Email | Source.
LinkedIn column = `[link](https://linkedin.com/...)`. Source column = the URL where you found this person's role.

## 4. Press & media trail
Bullet list. Each entry format: `- YYYY-MM-DD · **Outlet** — [Title](URL) — verbatim quote or one-line summary`. The outlet name AND title must be a clickable markdown link.

## 5. Red flags
Each flag: `- **HIGH lawsuit** — [court record](URL) — description`. If none: "None detected."

## 6. Business snapshot
Brands, supplier, account count, counties, recent acquisitions, employee count. Each metric: `[2,500 retail accounts](URL)` — link to the SOURCE of that metric.

## 7. Outreach strategy recommendation
Which person to target first, what hook to lead with, what to AVOID, what subject line. 4-6 specific tactical bullets. NO need for citations here — this is editorial.

CRITICAL — citation rules:
- Every fact in sections 1-6 MUST have an inline markdown URL, NOT a footnote.
- Pull URLs from the evidence pack (the sources list at the bottom of the pack).
- If a fact has no available URL, prefix with "Unsourced: " and italicize — do not invent URLs.
- Use real URLs. Never write `[link](#)` or `[link](URL)` literally — always real URLs.
- DO NOT invent. If the evidence is thin in any section, say so explicitly — do not fill gaps with generic prose.

Output the markdown only, no preamble."""


def make_research_md(
    company: Company,
    evidence_pack: str,
) -> tuple[str, float]:
    sys_prompt = RESEARCH_MD_PROMPT.replace("{COMPANY_NAME}", company.legal_name)
    text, _, cost = chat(
        model=MODEL_SYNTHESIZE,
        system=[
            {"type": "text", "text": sys_prompt, "cache_control": {"type": "ephemeral"}},
            {"type": "text", "text": evidence_pack, "cache_control": {"type": "ephemeral"}},
        ],
        messages=[{"role": "user", "content": f"Produce the research dossier markdown for {company.legal_name}."}],
        max_tokens=8000,
        temperature=0.4,
    )
    return text.strip(), cost


# ───────────────────────── HTML dossier ─────────────────────────

HTML_DOSSIER_PROMPT = """You are a magazine-editorial designer producing a single-file HTML company profile for a beer/beverage distributor.

OUTPUT: a complete, self-contained HTML document (DOCTYPE → </html>) with all CSS inline in <style>. NO external JS, only Google Fonts.

REFERENCE STYLE (must match):
- Typography: Fraunces (display, weights 300-900), Newsreader (body), JetBrains Mono (labels)
- Layout: max-width 900px, centered, paper-textured background (radial + linear gradients)
- Palette: 3 colors evoking the company's heritage. Pick based on geography/industry:
  - NY upstate: forest green + brick red + cream
  - AL/Birmingham: copper + cream + warm brown
  - MI: pine + lake blue + birch
  - IL industrial: steel blue + brass + oxblood
  - OH: burgundy + gold + cream
  - Etc.
- Use CSS custom properties exclusively (--ink, --accent-1, --accent-2, --paper, ...)

REQUIRED SECTIONS in order:
1. Masthead — kicker "Profile № 01 · Distributor Field Research · Confidential", company name (62px Fraunces 800), subtitle italic tagline, meta row (founded / HQ / top brand / employees) in JetBrains Mono small caps.
2. Highlight banner — green ✓ if clean target; orange/red ⚠ if red flags. Banner must explain WHY in plain language.
3. Section I · Origin — 3-4 paragraph narrative with drop-cap on first paragraph. Tell the founding story.
4. Section II · Chronology — vertical timeline (left-border line + dots) covering founding through present.
5. Section III · Family Tree — generation-grouped person cards. Color-code: founder=accent border, active=lighter, deceased=muted ink.
6. Pullquote — large italic centered Fraunces quote with attribution.
7. Section IV · Leadership — current operators with email/LinkedIn icons.
8. Section V · Media Trail — bordered list of 5-10 press appearances with date + outlet + title.
9. Section VI · Business Snapshot — 2-column data grid with hairline backgrounds, label (mono) + value (Fraunces bold).
10. Section VII · Outreach Strategy — dark recommendation box (cream text on dark accent) with 2-3 tactical bullets and a "Tonal note:" line.
11. Colophon — typography credits + sources (hyperlinked) + research notes.

CRITICAL:
- Every fact in the dossier must come from the evidence pack. No invented dates or names.
- If a section's evidence is thin, write less rather than fabricate.
- Highlight banner MUST acknowledge any red flags from research.
- The profile should read as editorial journalism, not a sales report.
- Single HTML file output, ~600-1200 lines, mobile responsive (720px breakpoint).
- Output ONLY the HTML, starting with <!DOCTYPE html> and ending with </html>. No preamble or fence."""


def make_dossier_html(
    company: Company,
    evidence_pack: str,
    dossier_number: int = 1,
) -> tuple[str, float]:
    text, _, cost = chat(
        model=MODEL_SYNTHESIZE,
        system=[
            {"type": "text", "text": HTML_DOSSIER_PROMPT, "cache_control": {"type": "ephemeral"}},
            {"type": "text", "text": evidence_pack, "cache_control": {"type": "ephemeral"}},
        ],
        messages=[{
            "role": "user",
            "content": f"Produce the HTML dossier for {company.legal_name}. "
                       f"Dossier number: {dossier_number:02d}. "
                       f"Pick a 3-color palette appropriate for {company.state or 'their region'}. "
                       f"Output the complete HTML file."
        }],
        max_tokens=16000,
        temperature=0.5,
    )
    # Strip markdown fences if present
    m = re.search(r"```(?:html)?\s*(<!DOCTYPE.*?</html>)\s*```", text, re.DOTALL | re.IGNORECASE)
    if m:
        return m.group(1), cost
    # find first <!DOCTYPE
    if "<!DOCTYPE" in text:
        idx = text.index("<!DOCTYPE")
        return text[idx:].strip(), cost
    return text.strip(), cost


# ───────────────────────── Emails ─────────────────────────

EMAIL_PROMPT = """You write short, human, personalized cold emails for B2B sales outreach to beer/beverage distributors.

You will produce ONE email targeted at a specific person and role.

OUTPUT FORMAT (exactly this structure, no preamble):

SUBJECT: <single subject line, < 70 chars>

<email body, 200-400 words, 6 paragraphs>

— end —

GENERAL VOICE RULES (these are absolute):
- Read like a thoughtful person who did real research, not an AI template.
- Use em-dashes (—) not hyphens (-).
- No buzzwords: "synergy", "leverage", "disrupt", "transformational", "game-changer", "unlock", "10x".
- The word "AI" appears only in the turning-point and credibility paragraphs (3rd and 5th), never in paragraph 1.
- 2-3 specific facts about the recipient is the right amount. 7 is creepy.
- Total length 200-400 words. Single voice (Anna).
- No bullet points, no lists, all prose.

PARAGRAPH STRUCTURE:

1. THE HOOK (specific, sourced, vivid).
   - For role family-legacy: name the founder + the vivid moment from evidence (a phone call, handshake, war story, radio ad, moonshine batch). Use construction "a single decision that would define the next N years." End with "He/she built the company through [historical events of their era]."
   - For role efficiency/ops/sales: open with a SPECIFIC business fact from research (recent acquisition, AOR change, brand launch). Bridge fast to operational angle.
   - The hook MUST come from the evidence pack. Never invent a moment. Never use a generic opener.

2. GENERATIONAL BRIDGE (one sentence, optionally extended).
   "Each generation after him faced its own defining test and took the business to a higher level."
   For role=heir or recipient with a known recent achievement, optionally name it: "You are doing the same — [specific public achievement]."

3. THE TURNING POINT (verbatim or close paraphrase):
   "We are now entering another historic turning point: the AI revolution. Like the Industrial Revolution, it will fundamentally reshape the economy and the way business is done — and this is a rare opportunity for leaders like you to take the business to its next level."

4. PERSONAL STORY (Anna's voice):
   "My name is Anna. Like you, I grew up in the beer and beverage distribution business. As a kid, I took orders, helped restock shelves, and fixed trucks with my dad. That is why I decided to build AI Intelligence — to help family businesses like the one I grew up in thrive in the age of AI."

5. CREDIBILITY (AI Intelligence trust signals — pick 3):
   Manhattan Beer · 20,000+ stores · Stanford · Google for Startups · Techstars by JPMorgan Chase · NVIDIA · Stanford GSB Demo Day. End with "Our technology can equip [Company] to reach new heights in this unique moment."

6. THE ASK (SHORT, specific, 1-2 sentences max — tailor to the recipient's role):
   Examples:
   - "Would a 20-minute call next week make sense to see if there's a fit?"
   - "I'd love to hear how you're thinking about AI for [Company] — would a quick call next week work?"
   NEVER reference NBWA Legislative Conference, Washington travel, "grab a coffee", or any event-specific framing — that line is forbidden.

SIGN-OFF:
Cheers,
{OPERATOR_NAME}
Mobile: {OPERATOR_MOBILE} · Web: {OPERATOR_WEB}

RED-FLAG GATE:
If the evidence pack contains a HIGH severity red flag (active lawsuit, recent death < 12 months in immediate family, EEOC settlement), you MUST:
- Default to a generic family opener: "Your family has built a remarkable multi-generational legacy in this industry. Founded [N] years ago, the company has moved beer through [historical eras]…"
- NOT name any specific ancestor in paragraph 1.
- For recent death of someone close to recipient: prepend a brief 1-sentence condolence before paragraph 1: "First — my condolences on [Name]'s passing." Then continue.
- For active lawsuit: never name siblings or specific family members in the opener.
- Set safe_mode=true in your output.

For SUBJECT LINE — be a copywriter:
- For CEO with clean legacy: clickbait works ("[Recipient] — what would [Ancestor] do in the age of AI?", "[Recipient], what would Dad do?").
- For CEO with recent-death case: gentler ("[Recipient] — honoring [Name], looking ahead at AI").
- For CFO/Sales/Director: outcome-focused ("[Recipient] — 70% audit time cut at Manhattan Beer", "[Recipient] — quick call on AI for [Company]?").
- < 70 chars always.

Output the email and stop."""


def make_email_for(
    *,
    company: Company,
    person: Person,
    evidence_pack: str,
    role: str,
    red_flags: list[RedFlag],
) -> tuple[Email, float]:
    role_label = ROLE_LABELS.get(role, role)
    role_guidance = ROLE_HOOK_GUIDANCE.get(role, "")
    # Safe mode only for legitimacy/legal red flags. Deaths get condolence framing
    # but still permit naming the deceased — like the user's actual sent email did.
    SAFE_MODE_FLAGS = {"lawsuit", "eeoc", "estrangement"}
    safe_flags = [rf for rf in red_flags if rf.severity == "high" and rf.flag_type in SAFE_MODE_FLAGS]
    death_flags = [rf for rf in red_flags if rf.flag_type == "death"]
    flag_lines = "\n".join(f"- [{rf.severity}] {rf.flag_type}: {rf.description}" for rf in red_flags) or "None"

    sys_prompt = (
        EMAIL_PROMPT
        .replace("{OPERATOR_NAME}", OPERATOR["name"])
        .replace("{OPERATOR_MOBILE}", OPERATOR["mobile"])
        .replace("{OPERATOR_WEB}", OPERATOR["web"])
    )

    user_msg = f"""Write the email.

TARGET:
- Recipient: {person.full_name}
- Title: {person.title or 'Unknown'}
- Role bucket: {role_label}
- Generation: {person.generation or 'unknown'}
- Email: {person.email or '(unknown — leave To: blank)'}
- LinkedIn: {person.linkedin_url or '(none)'}

COMPANY: {company.legal_name} ({company.dba or company.legal_name}) — {company.state}

ROLE-SPECIFIC HOOK GUIDANCE:
{role_guidance}

RED FLAGS (gate the opener):
{flag_lines}
{(
    'SAFE MODE: a HIGH-severity legal/employment red flag is present (lawsuit/EEOC/estrangement). '
    'Use the generic family opener as instructed — DO NOT name any specific ancestor in paragraph 1.'
    if safe_flags else
    ('DEATH-AWARE MODE: a recent family death is in the evidence. You MAY still name the deceased '
     'and the legacy in paragraph 1 — like writing "Your father built the company through X, Y, Z." '
     'Lead with respect: do not lead the email with the death itself. Instead let the legacy carry, '
     'and only briefly reference the loss in the bridge sentence (e.g. "...a legacy you now carry forward."). '
     'AVOID openers like "First — my condolences" — the user prefers the legacy to lead, not the loss.'
     if death_flags else
     'No safety flags. Proceed with full personalized hook from the evidence.'
    )
)}

Use the evidence pack above. The hook must reference a specific, sourced fact.
Output exactly: SUBJECT line, blank line, body, then `— end —`.
"""

    text, _, cost = chat(
        model=MODEL_SYNTHESIZE,
        system=[
            {"type": "text", "text": sys_prompt, "cache_control": {"type": "ephemeral"}},
            {"type": "text", "text": evidence_pack, "cache_control": {"type": "ephemeral"}},
        ],
        messages=[{"role": "user", "content": user_msg}],
        max_tokens=2500,
        temperature=0.7,
    )

    subject, body = _parse_email(text)
    return Email(
        role_category=_role_to_category(role),
        target_person_name=person.full_name,
        target_person_email=person.email,
        subject=subject,
        body=body,
        safe_mode=bool(safe_flags),
        word_count=len(body.split()),
    ), cost


def _parse_email(text: str) -> tuple[str, str]:
    """Parse SUBJECT: + body out of the LLM output."""
    text = text.strip()
    # Remove possible markdown fences
    text = re.sub(r"^```\w*\n?", "", text)
    text = re.sub(r"\n?```$", "", text)
    # Strip trailing — end —
    text = re.sub(r"—\s*end\s*—\s*$", "", text, flags=re.IGNORECASE).strip()

    m = re.match(r"SUBJECT:\s*(.+?)\n\s*\n(.*)", text, re.DOTALL)
    if m:
        return m.group(1).strip(), m.group(2).strip()
    # fallback — first line is subject
    lines = text.split("\n", 1)
    if len(lines) == 2:
        return lines[0].strip(), lines[1].strip()
    return "(no subject)", text


def _role_to_category(role: str) -> str:
    return {
        "ceo_owner": "ceo",
        "cfo_ops": "cfo",
        "vp_sales": "vp_sales",
        "director": "director",
        "heir": "heir",
    }.get(role, "other")


# ───────────────────────── Person picking ─────────────────────────

_TITLE_KEYWORDS = {
    "ceo": [r"\bceo\b", r"\bpresident\b(?!.*\bemerit)", r"\bowner\b"],
    "owner": [r"\bowner\b", r"\bpresident\b"],
    "cfo": [r"\bcfo\b", r"\bchief financial\b", r"\bvp finance\b"],
    "coo": [r"\bcoo\b", r"\bchief operating\b"],
    "vp_ops": [r"vice president,? operations", r"\bvp ops\b", r"vp,? operations",
               r"inventory management", r"operations director"],
    "vp_sales": [r"vice president,? sales", r"vp,? sales", r"director of sales",
                 r"\bsales director\b", r"director,? sales", r"sales manager",
                 r"chief commercial"],
    "director": [r"director of category", r"director of business development",
                 r"director of marketing", r"director of customer", r"director,? "],
}


def _company_token_set(company: Company) -> set[str]:
    """Lowercase tokens of company name for affiliation matching."""
    name = (company.dba or company.legal_name or "").lower()
    return {tok for tok in re.split(r"[^a-z0-9]+", name) if len(tok) >= 4}


def _person_affiliated(p: Person, company_tokens: set[str]) -> bool:
    """True if person's title mentions THIS company specifically."""
    if not p.title:
        return False
    title_tokens = {tok for tok in re.split(r"[^a-z0-9]+", p.title.lower()) if len(tok) >= 4}
    return bool(company_tokens & title_tokens)


def frame_for_person(p: Person) -> Optional[str]:
    """Pick the best email-frame tag for ONE person.

    Frames map to HookSpecialist role-frames. The intent: every decision-maker
    + every non-deceased active family member (generation 2+) gets a personalized
    email written through the angle that fits their role + family standing.

    - founder_legacy : decision-maker + family + gen 2 (active operator carrying founder's torch)
    - heir           : family + gen 3+ (handoff via parent)
    - family_exec    : family non-decision-maker working at the company (daughter as VP, etc)
    - ceo_outsider   : non-family CEO/President — industry leadership angle
    - cfo_ops        : CFO/COO/VP-Ops — operational complexity angle
    - vp_sales       : VP Sales — market expansion / brand portfolio angle
    - director       : Director-level — execution / specialty angle
    """
    if p.is_deceased:
        return None
    is_family = p.generation is not None
    role = (p.role_category or "").lower()
    if is_family:
        if p.generation and p.generation >= 3:
            return "heir"
        if p.is_decision_maker:
            return "founder_legacy"
        return "family_exec"
    if role in ("ceo", "owner", "president"):
        return "ceo_outsider"
    if role in ("cfo", "coo", "vp_ops"):
        return "cfo_ops"
    if role == "vp_sales":
        return "vp_sales"
    if role == "director":
        return "director"
    return None  # skip generic non-family non-decision-makers


def pick_person_email_targets(
    people: list[Person],
    *,
    company: Optional[Company] = None,
    cap: int = 12,
) -> list[tuple[str, Person]]:
    """One email per important person — decision-makers + all active family.

    Returns list of (frame, Person). Frame guides HookSpecialist's angle.
    Cap controls cost (each target = 1 hook + 1 email + 1 validation ≈ $0.40).
    """
    seen: set[str] = set()
    out: list[tuple[str, Person]] = []
    for p in people:
        if p.full_name in seen:
            continue
        if not (p.is_decision_maker or p.generation is not None):
            continue  # skip rank-and-file employees
        frame = frame_for_person(p)
        if not frame:
            continue
        seen.add(p.full_name)
        out.append((frame, p))
    # Priority order: family decision-makers first, then non-family CEO, then ops/sales, then heirs/directors.
    priority = {
        "founder_legacy": 0,
        "ceo_outsider": 1,
        "cfo_ops": 2,
        "vp_sales": 3,
        "family_exec": 4,
        "heir": 5,
        "director": 6,
    }
    out.sort(key=lambda t: priority.get(t[0], 9))
    return out[:cap]


def pick_email_targets(
    people: list[Person],
    roles: Iterable[str],
    *,
    company: Optional[Company] = None,
) -> list[tuple[str, Person]]:
    """For each requested role, find the best candidate. Returns [(role, Person)].

    Priority:
    1. is_decision_maker AND role_category match AND title affiliated with THIS company
    2. is_decision_maker AND role_category match (any affiliation)
    3. Title-keyword match against THIS company first, then anywhere
    """
    out: list[tuple[str, Person]] = []
    used_names: set[str] = set()
    company_tokens = _company_token_set(company) if company else set()

    def candidates(*role_filters: str) -> list[Person]:
        # 1) role_category match, alive, not used, ranked by affiliation+decision_maker
        cands = [
            p for p in people
            if not p.is_deceased
            and p.full_name not in used_names
            and (p.role_category in role_filters)
        ]
        if cands:
            cands.sort(key=lambda p: (
                not _person_affiliated(p, company_tokens),  # affiliated first
                not p.is_decision_maker,                    # decision-makers first
                people.index(p),                            # stable order
            ))
            return cands
        # 2) title-keyword fallback
        kw_patterns = []
        for f in role_filters:
            kw_patterns.extend(_TITLE_KEYWORDS.get(f, []))
        kw_cands: list[Person] = []
        for p in people:
            if p.is_deceased or p.full_name in used_names:
                continue
            if not p.title:
                continue
            t = p.title.lower()
            if any(re.search(pat, t) for pat in kw_patterns):
                kw_cands.append(p)
        kw_cands.sort(key=lambda p: (
            not _person_affiliated(p, company_tokens),
            not p.is_decision_maker,
            people.index(p),
        ))
        return kw_cands

    for role in roles:
        if role == "ceo_owner":
            cs = candidates("ceo", "owner", "president")
        elif role == "cfo_ops":
            cs = candidates("cfo", "coo", "vp_ops")
        elif role == "vp_sales":
            cs = candidates("vp_sales")
        elif role == "director":
            cs = candidates("director")
        elif role == "heir":
            heirs = [
                p for p in people
                if not p.is_deceased and p.generation is not None
                and p.full_name not in used_names
            ]
            heirs.sort(key=lambda x: (-(x.generation or 0), people.index(x)))
            cs = heirs
        else:
            cs = []
        if cs:
            p = cs[0]
            out.append((role, p))
            used_names.add(p.full_name)
    return out


def synthesize(
    company: Company,
    people: list[Person],
    evidence: list[Evidence],
    red_flags: list[RedFlag],
    research_data: dict,
    roles: Iterable[str] = DEFAULT_ROLES,
    dossier_number: int = 1,
) -> tuple[str, str, list[Email], float]:
    """Returns (research_md, dossier_html, emails, total_cost)."""
    pack = _format_evidence_pack(company, people, evidence, red_flags, research_data)

    research_md, c1 = make_research_md(company, pack)
    dossier_html, c2 = make_dossier_html(company, pack, dossier_number=dossier_number)

    emails: list[Email] = []
    c_emails = 0.0
    for role, person in pick_email_targets(people, roles, company=company):
        em, c = make_email_for(
            company=company, person=person, evidence_pack=pack,
            role=role, red_flags=red_flags,
        )
        emails.append(em)
        c_emails += c

    return research_md, dossier_html, emails, (c1 + c2 + c_emails)
