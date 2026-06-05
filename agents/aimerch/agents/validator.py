"""FactValidator — drops unsourced / hallucinated / inconsistent facts.

Two checks:
1. **Source check**: every fact must reference a real article_id, and verbatim_quote
   must actually appear (substring match) in that article's snippet.
2. **Coherence check**: contradictions across facts (different death years for same
   person, different founding years, etc) get flagged.

Outputs:
- validated: list of facts that passed
- rejected: list of {fact_id, reason}
- coherence_warnings: list of {description}
"""

from __future__ import annotations

import json
from .base import Agent


SYSTEM_PROMPT = """You are a fact-checker. Given a list of articles and a list of facts extracted from them, you verify each fact and reject any that:

1. Reference a non-existent article_id
2. Quote text that doesn't actually appear in the article snippet (paraphrased or hallucinated)
3. Contradict another fact in the corpus (e.g. two different founding years for same company)
4. Have confidence < 0.5
5. Are vague or non-specific ("around 1900", "in the early days")

For each fact, verify:
- article_id exists in the article list
- verbatim_quote is a substring or near-substring of the article's snippet (allow minor punctuation differences)
- The fact's subject + predicate + object combination matches what the verbatim_quote actually says

Output ONE JSON object. Schema:

{
  "validated_fact_ids": [str, ...],         // ids that passed
  "rejected": [
    {"fact_id": str, "reason": str},
    ...
  ],
  "coherence_warnings": [
    {"affected_fact_ids": [str, ...], "description": str},
    ...
  ],
  "summary": {
    "input_count": int,
    "validated_count": int,
    "rejected_count": int,
    "warning_count": int
  }
}

CRITICAL:
- Output ONLY the JSON object. No prose, no fences.
- Be strict. A fact that looks plausible but doesn't match its quote MUST be rejected.
- Better to reject a true fact than accept a hallucinated one. Downstream emails depend on this.
"""


class FactValidator(Agent):
    name = "fact_validator"
    tools = "none"
    max_tokens = 8000
    temperature = 0.1
    system_prompt = SYSTEM_PROMPT

    def build_user_message(self, context: dict) -> str:
        articles = context.get("articles", [])
        facts = context.get("facts", [])
        return f"""Validate these facts against the source articles.

Articles ({len(articles)} total):
{json.dumps(articles, default=str, indent=2)}

Facts ({len(facts)} total):
{json.dumps(facts, default=str, indent=2)}

Now produce the JSON validation report."""
