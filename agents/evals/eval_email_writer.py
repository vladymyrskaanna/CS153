"""LLM eval for the email-writer agent.

Runs three cases (happy / edge / adversarial) against the configured
backend (anthropic-direct or DO Gradient) and checks for fact-grounding
and the required Sources block.

Usage:

    .venv/bin/python -m evals.eval_email_writer

This is opt-in — costs ~$0.10 per run. CI can run it nightly via
`pytest -m eval evals/`.

Each case reports a JSON line; the runner sums pass/fail at the end.
"""

from __future__ import annotations

import json
import sys
from typing import Any

# Each case: (name, hook, expected_substrings_or_predicates)
CASES: list[dict[str, Any]] = [
    {
        "name": "happy_founding_fact",
        "company_name": "Saratoga Eagle Sales & Service",
        "hook": {
            "role": "ceo_owner",
            "target_person_name": "Jeff Vukelic",
            "safe_mode": False,
            "opening_paragraph": (
                "Few upstate New York families have carried a name across "
                "four generations the way yours has at Saratoga Eagle."
            ),
            "bridge_sentence": "From 1933 to today, every era has been answered.",
            "subject_line_options": [
                "Saratoga Eagle's next chapter",
                "AI in family beverage distribution",
            ],
        },
        "facts": [
            {
                "id": "fact_001",
                "fact_type": "founding_moment",
                "subject": "Stephen L. Vukelic",
                "predicate": "founded",
                "object": "Saratoga Eagle in 1933 in Lackawanna, NY",
                "verbatim_quote": "founded in 1933 by his father, Stephen L. Vukelic.",
                "article_id": "art_001",
                "confidence": 0.95,
            },
        ],
        "articles": [
            {
                "id": "art_001",
                "url": "https://saratogaeagle.com/our-story/",
                "outlet": "Saratoga Eagle",
                "title": "Our Story",
            },
        ],
        "must_contain": [
            "Sources",  # the required Sources block
            "1933",
            "saratogaeagle.com",
        ],
        "must_not_contain": [
            "synergy", "leverage", "disrupt", "10x",  # buzzword filter
        ],
        "max_word_count": 400,
    },
    {
        "name": "edge_safe_mode",
        "company_name": "Acme Distributors",
        "hook": {
            "role": "ceo_owner",
            "target_person_name": "John Doe",
            "safe_mode": True,
            "opening_paragraph": "Family beverage distribution is having a moment.",
            "bridge_sentence": "We help leaders like you stay ahead.",
            "subject_line_options": ["AI Intelligence — quick intro"],
        },
        "facts": [],
        "articles": [],
        "must_contain": [
            "Sources",  # even in safe mode, structure must hold
        ],
        "must_not_contain": [
            "John Doe Sr.",  # safe mode: no ancestor name in para 1
        ],
        "max_word_count": 400,
    },
    {
        "name": "adversarial_red_flag_lawsuit",
        "company_name": "Matagrano, Inc.",
        "hook": {
            "role": "vp_sales",
            "target_person_name": "Andrew Matagrano",
            "safe_mode": False,
            "opening_paragraph": (
                "California beverage families don't often last three "
                "generations — the Matagranos are an exception."
            ),
            "bridge_sentence": "From Racine in 1928 to Hayward today.",
            "subject_line_options": ["Matagrano + AI Intelligence"],
        },
        "facts": [
            {
                "id": "fact_001",
                "fact_type": "founding_moment",
                "subject": "Anthony Matagrano",
                "predicate": "founded",
                "object": "Matagrano in Racine, WI in 1928",
                "verbatim_quote": "selling Blatz beer in Racine, WI before prohibition",
                "article_id": "art_001",
                "confidence": 0.9,
            },
            {
                "id": "fact_002",
                "fact_type": "red_flag",
                "subject": "Matagrano Inc.",
                "predicate": "sued",
                "object": "Sierra Nevada Brewing for termination without cause",
                "verbatim_quote": "alleging termination without cause",
                "article_id": "art_002",
                "confidence": 0.85,
            },
        ],
        "articles": [
            {"id": "art_001", "url": "https://www.brewbound.com/news/booth", "outlet": "Brewbound", "title": "Booth Brewing"},
            {"id": "art_002", "url": "https://prospect.org/2022/05/25/rollups", "outlet": "American Prospect", "title": "Rollups"},
        ],
        "must_contain": [
            "Sources",
            "1928",
        ],
        "must_not_contain": [
            "Sierra Nevada",  # red-flag fact must NOT appear in body
            "lawsuit",
            "sued",
        ],
        "max_word_count": 400,
    },
]


def run_case(case: dict[str, Any]) -> dict[str, Any]:
    """Run one eval case end-to-end. Returns a result dict."""
    from aimerch.agents.email_writer import EmailWriter
    from aimerch.models import Company

    company = Company(
        slug="test_co_inc",
        legal_name=case["company_name"],
        state="NY",
        founded_year=1900,
    )
    writer = EmailWriter()
    result = writer.run({
        "company": company,
        "hook": case["hook"],
        "facts": case["facts"],
        "articles": case["articles"],
    })
    body = (result.data or {}).get("body", "") if isinstance(result.data, dict) else ""

    failures: list[str] = []
    for sub in case.get("must_contain", []):
        if sub not in body:
            failures.append(f"missing required {sub!r}")
    for sub in case.get("must_not_contain", []):
        if sub in body:
            failures.append(f"contains forbidden {sub!r}")
    word_count = len(body.split())
    max_wc = case.get("max_word_count")
    if max_wc and word_count > max_wc:
        failures.append(f"word_count={word_count} exceeds max {max_wc}")

    return {
        "case": case["name"],
        "passed": not failures,
        "failures": failures,
        "word_count": word_count,
        "cost_usd": result.cost_usd,
        "body_preview": body[:300],
    }


def main():
    print("Running email-writer evals…\n")
    results = [run_case(c) for c in CASES]
    passed = sum(1 for r in results if r["passed"])
    total_cost = sum(r["cost_usd"] for r in results)
    for r in results:
        marker = "✓" if r["passed"] else "✗"
        print(f"{marker} {r['case']}  ({r['word_count']} words, ${r['cost_usd']:.3f})")
        if r["failures"]:
            for f in r["failures"]:
                print(f"    - {f}")
    print()
    print(f"Score: {passed}/{len(results)} passed | total cost ${total_cost:.3f}")
    sys.exit(0 if passed == len(results) else 1)


if __name__ == "__main__":
    main()
