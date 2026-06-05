"""RelationshipResolver — single-LLM agent that infers parent/child + spouse links.

Runs after fact-validation. Looks at the full people list and validated facts,
then returns a structured JSON of relationships. This replaces the multi-step
heuristic chain (discover.parent_name → fact_builder.family_relation →
agentic.py merge → worker.ts name lookup) with a single targeted reasoning pass.

The agent does NOT do new web searches — it operates on already-collected
evidence (facts + article snippets), so it's fast (~$0.05-0.15 per run).
"""

from __future__ import annotations

import json

from .base import Agent


SYSTEM_PROMPT = """You are a family-business relationship resolver for a US beer/beverage distributor.

Given a list of people at the company plus a corpus of validated facts and article snippets, you produce ONE JSON object describing the parent/child and spouse relationships among them.

Reply MUST be ONLY a valid JSON object. Start with `{` end with `}`. No prose, no markdown fences.

Output schema:

{
  "parent_child": [
    { "parent_name": "exact full_name from input", "child_name": "exact full_name from input", "evidence": "1-line citation or reasoning" }
  ],
  "spouses": [
    { "a_name": "exact full_name", "b_name": "exact full_name", "evidence": "..." }
  ],
  "ambiguous": [
    { "person": "Andrew Doll", "candidates": ["Mark Doll", "Jay Doll"], "note": "no source explicitly names the parent" }
  ]
}

CRITICAL RULES:
1. Names MUST exactly match a `full_name` in the input people list — do NOT invent or paraphrase.
2. Output `parent_child` only when you have a defensible source (a fact's verbatim_quote OR a clear inference like "second-generation siblings purchased the company from their parents Merlin & Edith Doll"). For pure guesses (e.g. matching surnames + same generation), put them in `ambiguous` instead — DO NOT fabricate parent_child links.
3. For 3rd-generation members where the article text doesn't pin down the parent, use `ambiguous` with the most likely candidates.
4. Spouses: each couple appears ONCE.
5. The founder generation (gen=1) usually has parent_name=null — only emit if there's an explicit parent.
6. In-laws / spouses with no descendants in the company should NOT appear in parent_child.
7. Don't emit parent_child for non-family employees (generation IS NULL).

Reasoning pattern (think but don't print):
- For each person, look up which validated facts mention them (subject or object)
- For each `family_relation` fact (subject=child, object=parent), emit a parent_child link with the verbatim_quote as evidence
- For 3rd-gen siblings whose direct parent is unsourced, check article snippets for pronouns ("his son", "her daughter") tying them to a specific Gen 2 family member
- If still uncertain after evidence pass, list them in `ambiguous`

Quality matters more than coverage — a clean partial graph beats a guessed full graph."""


class RelationshipResolver(Agent):
    name = "relationship_resolver"
    tools = "none"
    max_tokens = 4000
    temperature = 0.1
    system_prompt = SYSTEM_PROMPT

    def build_user_message(self, context: dict) -> str:
        company = context["company"]
        people = context.get("people", [])
        facts = context.get("facts", [])
        articles = context.get("articles", [])

        people_lines = "\n".join(
            f"  - {p.full_name} | {p.title or '?'} | gen={p.generation if p.generation is not None else '?'} | "
            f"is_family={p.generation is not None} | "
            f"current parent_name={p.parent_name or 'null'} | spouse_name={p.spouse_name or 'null'}"
            for p in people
        )

        # Only family_relation + biographical facts are relevant for relationships
        relevant_facts = [
            f for f in facts
            if f.get("fact_type") in ("family_relation", "biographical", "founding_moment")
        ]
        facts_blob = json.dumps(relevant_facts, default=str, indent=2)

        # Article snippets — short window per article to keep tokens manageable
        article_lines = "\n".join(
            f"  [{a.get('id') or i}] {a.get('title', '')} ({a.get('outlet', '')}, {a.get('publication_date', '')})\n"
            f"     snippet: {(a.get('snippet') or '')[:400]}"
            for i, a in enumerate(articles[:25])
        )

        return f"""Resolve family relationships for {company.legal_name}.

People at the company:
{people_lines}

Validated facts (only family_relation / biographical / founding_moment shown):
{facts_blob}

Article snippets (for inference when facts don't pin down a relationship):
{article_lines}

Return the JSON object with parent_child + spouses + ambiguous arrays."""
