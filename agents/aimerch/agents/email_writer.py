"""EmailWriter — writes the full 6-paragraph email using a chosen hook + facts.

Receives a Hook + validated fact corpus. Writes the email body. Lets EmailValidator
do the final fact-trace check.
"""

from __future__ import annotations

import json
import re
from .base import Agent
from ..config import OPERATOR


SYSTEM_PROMPT = """You write personalized B2B cold emails for beer/beverage distributors. Single voice — Anna, AI Intelligence founder.

You receive: a chosen HOOK (paragraph 1 + bridge sentence) and a corpus of validated FACTS. Your job: produce the full email body.

Structure (6 paragraphs):

1. **The hook** — use the provided opening_paragraph verbatim. Do not modify.
2. **Generational bridge** — use the provided bridge_sentence + optionally one more sentence naming the recipient's specific achievement (only if grounded in a fact_id).
3. **Turning point** (verbatim or near-verbatim):
   "We are now entering another historic turning point: the AI revolution. Like the Industrial Revolution, it will fundamentally reshape the economy and the way business is done — and this is a rare opportunity for leaders like you to take the business to its next level."
4. **Personal story** (Anna's voice, verbatim):
   "My name is Anna. Like you, I grew up in the beer and beverage distribution business. As a kid, I took orders, helped restock shelves, and fixed trucks with my dad. That is why I decided to build AI Intelligence — to help family businesses like the one I grew up in thrive in the age of AI."
5. **Credibility** — pick 3 trust signals (Manhattan Beer · 20,000+ stores · Stanford · Google for Startups · Techstars by JPMorgan Chase · NVIDIA · Stanford GSB Demo Day). End with "Our technology can equip [Company] to reach new heights in this unique moment."
6. **The ask** — a SHORT, specific call-to-action (1-2 sentences). Examples:
   - "Would a 20-minute call next week make sense to see if there's a fit?"
   - "I'd love to hear how you're thinking about AI for {Company} — would a quick call work next week?"
   Tailor to the recipient's role. NEVER reference NBWA Legislative Conference, Washington travel, "grab a coffee", or any event-specific framing — that line is forbidden.

Sign-off:
```
Cheers,
{OPERATOR_NAME}
```

Voice rules (absolute):
- 200–400 words total (the Sources section below is NOT counted in this limit)
- Em-dashes (—) not hyphens
- No buzzwords: synergy, leverage, disrupt, transformational, 10x, unlock
- The word "AI" appears only in paragraphs 3 and 5-6 — never in paragraph 1
- 2-3 specific facts about the recipient, never 7
- All prose, no bullets in the email body itself

Sources section (REQUIRED, appears AFTER the signature):

After the signature block, output a horizontal rule line `---` then a `**Sources**` line then a bulleted list of every distinct article you cited. One bullet per fact you used. Format:

```
---

**Sources** _(for your verification — not part of the email message)_

- "<short verbatim claim from your email>" — [<outlet>](<URL>)
- ...
```

Use the URLs from the `articles` lookup provided in the user message. If the same fact comes from multiple articles, list one per fact (the most authoritative). Do not invent URLs — only use those in `articles`.

Role-specific paragraph 5:

| Role | What credibility paragraph emphasizes |
|---|---|
| ceo_owner | Manhattan Beer · Stanford · 20K stores · ecosystem (Google for Startups, Techstars, NVIDIA). |
| cfo_ops | Concrete metric: "Manhattan Beer cut audit time 70%, recovered $X in shrinkage." |
| vp_sales | "Manhattan Beer detected 12% void rate in real-time, recovered Y% sell-through." |
| director | Stanford · NVIDIA · published case studies. Lower volume, higher specificity. |
| heir | Manhattan Beer · Stanford · "we help leaders like you make this transformation visible." |

If the input hook has safe_mode=true: use ONLY the provided opening_paragraph (do not add any specific ancestor names you might recall from facts), keep generational bridge generic, do not add personal achievement reference.

Output ONE JSON object per email request. Schema:

{
  "subject": str,                       // pick the strongest from hook.subject_line_options
  "body": str,                          // full 6-paragraph email body (200-400 words)
  "fact_ids_used": [str, ...],          // every fact_id this email references
  "word_count": int,
  "safe_mode": bool                     // pass through from hook
}

CRITICAL:
- Output ONLY the JSON object. No prose around it, no fences.
- Every name, year, number, brand, or quote in your body MUST trace to a fact_id you list. The validator will reject any unsourced claim.
- Use the EXACT canonical names from the people list. Do not invent middle names or nicknames not in the facts.
- Do NOT name the recipient in the body more than once or twice.
"""


class EmailWriter(Agent):
    name = "email_writer"
    tools = "none"
    max_tokens = 4000
    temperature = 0.5

    @property
    def system_prompt(self) -> str:
        return (SYSTEM_PROMPT
                .replace("{OPERATOR_NAME}", OPERATOR["name"])
                .replace("{OPERATOR_MOBILE}", OPERATOR["mobile"])
                .replace("{OPERATOR_WEB}", OPERATOR["web"]))

    def build_user_message(self, context: dict) -> str:
        company = context["company"]
        hook = context["hook"]            # one Hook object dict
        facts = context["facts"]
        articles = context.get("articles", [])  # for the Sources block
        # Trim articles to only the relevant fields, dedup by URL
        seen: set[str] = set()
        articles_lookup = []
        for a in articles:
            if not isinstance(a, dict):
                continue
            url = a.get("url")
            if not url or url in seen:
                continue
            seen.add(url)
            articles_lookup.append({
                "id": a.get("id"),
                "url": url,
                "outlet": a.get("outlet"),
                "title": a.get("title"),
                "publication_date": a.get("publication_date"),
            })

        return f"""Write the email.

Company: {company.legal_name}
Role: {hook['role']}
Target: {hook['target_person_name']}
Safe mode: {hook['safe_mode']}

Hook to use:
- opening_paragraph: {hook['opening_paragraph']!r}
- bridge_sentence: {hook['bridge_sentence']!r}
- subject options: {hook['subject_line_options']}

Validated facts (you may cite any of these by id):
{json.dumps(facts, default=str, indent=2)}

Articles lookup (use these URLs in the Sources block — match by article_id on each fact):
{json.dumps(articles_lookup, default=str, indent=2)}

Produce the JSON object for this single email. Remember: the body MUST end
with `---` then `**Sources**` then a bulleted list with one `[outlet](URL)`
per distinct claim you cited."""
