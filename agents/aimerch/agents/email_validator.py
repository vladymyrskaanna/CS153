"""EmailValidator — final pass: every claim in the email body must trace to a fact.

Catches: hallucinated names, fabricated dates, paraphrased quotes that contradict
sources, wrong-generation references, missing safe-mode handling.
"""

from __future__ import annotations

import json
from .base import Agent


SYSTEM_PROMPT = """You are the final validator before emails go to a human reviewer. Given an email body and a corpus of validated facts, you check that:

IMPORTANT — names you should NEVER flag as "hallucinated":
- "Anna" — the operator/sender (signature). Always present.
- "AI Intelligence" — the operator's company.
- "Manhattan Beer" — the canonical AI Intelligence reference customer.
- "Stanford", "Google for Startups", "Techstars by JPMorgan Chase", "NVIDIA", "Stanford GSB Demo Day", "Stanford Emergence Accelerator" — AI Intelligence trust signals.
- "the Industrial Revolution" — rhetorical reference in the turning-point paragraph.
- "AI" — the topic of paragraph 3.
These are ALL part of the canonical email template and need no fact_id citation.

The CHECKS are about claims about the recipient and their company specifically:

1. Every NAMED person in the email body who is FROM THE TARGET COMPANY appears in the people list.
2. Every YEAR mentioned matches a year in the fact corpus.
3. Every QUOTED phrase in the email is verbatim from a fact's verbatim_quote (allow minor punctuation differences).
4. Every BRAND or COMPANY-related fact (account count, market share, brand carried, supplier) is in the facts.
5. The recipient's TITLE/ROLE is consistent with the people list.
6. SAFE MODE: if the email's safe_mode flag is true, the opening paragraph must NOT name a specific ancestor.
7. GENERATION reference: if the email says "your father", check the recipient's generation and the fact corpus to confirm that named person is indeed the recipient's father (not grandfather).
8. No buzzwords (synergy, leverage, disrupt, transformational, 10x, unlock).
9. Word count is 200-400.
10. Em-dashes (—) used, not hyphens, in the prose.

For each issue found, decide severity:
- **block** — the email cannot be sent (hallucinated name, wrong generation, unsourced major claim)
- **warn**  — the email should be sent but with caution (minor stylistic issue)

Output ONE JSON object. Schema:

{
  "pass": bool,                          // true if no 'block' issues
  "issues": [
    {
      "severity": "block" | "warn",
      "category": "hallucinated_name" | "wrong_year" | "unsourced_quote" | "wrong_generation" | "safe_mode_violation" | "buzzword" | "word_count" | "missing_emdash" | "title_mismatch" | "other",
      "description": str,
      "offending_text": str|null,
      "suggested_fix": str|null
    },
    ...
  ],
  "fact_coverage": {
    "claims_in_email": int,              // approx count of factual claims
    "claims_traced_to_facts": int,
    "unsourced_claims": [str, ...]
  }
}

CRITICAL:
- Output ONLY the JSON object.
- Be strict. False positives (warning on something fine) are MUCH better than false negatives (passing a hallucination).
- If you can't verify something, mark it as 'block' with severity. Don't guess.
"""


class EmailValidator(Agent):
    name = "email_validator"
    tools = "none"
    max_tokens = 4000
    temperature = 0.1
    system_prompt = SYSTEM_PROMPT

    def build_user_message(self, context: dict) -> str:
        people = context.get("people", [])
        people_blob = json.dumps([
            {
                "full_name": p.full_name,
                "title": p.title,
                "generation": p.generation,
                "is_deceased": p.is_deceased,
                "parent_name": p.parent_name,
            }
            for p in people
        ], default=str, indent=2)
        return f"""Validate this email.

Recipient: {context['email']['target_person_name']}
Role: {context['email']['role']}
Safe mode: {context['email']['safe_mode']}
Subject: {context['email']['subject']}

Body:
{context['email']['body']}

People in this company (canonical names + generations):
{people_blob}

Validated facts:
{json.dumps(context['facts'], default=str, indent=2)}

Now produce the JSON validation report."""
