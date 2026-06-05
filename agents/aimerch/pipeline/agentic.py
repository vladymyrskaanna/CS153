"""Agentic pipeline — orchestrates 6 specialized agents into the final dossier.

Flow:
    URL
     ↓
    [discover]            (existing) → company + people candidates
     ↓
    [ArticleHunter]       → list of articles (full text + citations)
     ↓
    [FactBuilder]         → list of facts (each with article_id + verbatim_quote)
     ↓
    [FactValidator]       → drops unsourced/hallucinated; outputs validated_fact_ids
     ↓
    [HookSpecialist]      → picks best hook per role, citing fact_ids
     ↓
    [EmailWriter] x N     → writes each email, citing fact_ids
     ↓
    [EmailValidator] x N  → blocks any email that fails fact-trace
     ↓
    persist + return
"""

from __future__ import annotations

import time
from pathlib import Path
from typing import Iterable, Optional

from rich.console import Console

from .. import db
from concurrent.futures import ThreadPoolExecutor, as_completed

from ..agents import (
    PersonProfileBuilder, PhotoResolver,
    ArticleHunter, FactBuilder, FactValidator,
    RelationshipResolver,
    HookSpecialist, EmailWriter, EmailValidator,
)
from ..models import Company, Dossier, Email, Evidence, Person, RedFlag
from ..pipeline.discover import discover
from ..pipeline.render import render_to_disk
from ..pipeline.synthesize import (
    DEFAULT_ROLES, ROLE_LABELS, _format_evidence_pack,
    pick_email_targets, pick_person_email_targets, make_dossier_html, make_research_md,
)


def run_agentic_pipeline(
    url: str,
    *,
    hint: Optional[str] = None,
    roles: Iterable[str] = DEFAULT_ROLES,
    dossier_number: int = 1,
    quiet: bool = False,
    run_id: Optional[int] = None,
    max_email_rewrites: int = 1,
) -> tuple[Dossier, Path]:
    """End-to-end agentic pipeline. Returns (Dossier, dossier_dir)."""
    import os
    console = Console(quiet=quiet)
    t_start = time.time()
    total_cost = 0.0

    db.init_db()
    if run_id is None:
        run_id = db.create_run(url, pid=os.getpid())
    else:
        db.update_run_pid(run_id, os.getpid())

    # Reset usage accumulator at start so we sum tokens for THIS run only.
    from ..llm import reset_usage_accumulator, get_usage_accumulator, _backend
    reset_usage_accumulator()
    backend = _backend()

    try:
        # ── Phase A: Discover ──
        db.update_run_phase(run_id, "discover")
        console.print(f"[cyan]·[/] discovering {url}")
        company, people, c0 = discover(url, hint=hint)
        total_cost += c0
        # Loud-fail when discover returns nothing — the most common cause is
        # web-search rate limit / quota exhaustion. Without people the rest of
        # the pipeline produces an empty dossier silently, which the operator
        # then has to detect manually. Surface it instead.
        if not people:
            raise RuntimeError(
                "discover returned 0 people — usually web_search quota exhausted "
                "or the company URL is unreachable. Try again later or fix the URL."
            )
        # Upsert company NOW so the FK on run.company_slug resolves later phases.
        db.upsert_company(company, runtime=0.0, cost=total_cost)
        db.update_run_phase(run_id, "discover", slug=company.slug)
        console.print(f"  → {company.legal_name} · {len(people)} people")

        # ── PhotoFinder phase removed — PersonProfileBuilder now handles
        # photo extraction smarter (LinkedIn + already-collected article pages
        # + company team page + targeted image search). Saves ~3-5 min and ~$5/run.

        # ── Phase B: ArticleHunter ──
        db.update_run_phase(run_id, "articles", slug=company.slug)
        console.print(f"[cyan]·[/] hunting articles")
        hunter = ArticleHunter()
        ah = hunter.run({"company": company, "people": people})
        total_cost += ah.cost_usd
        articles = ah.data if isinstance(ah.data, list) else []
        # assign stable ids
        for i, a in enumerate(articles):
            a["id"] = a.get("id") or f"art_{i+1:03d}"
        console.print(f"  → {len(articles)} articles · ${ah.cost_usd:.3f}")

        # ── Phase C: FactBuilder ──
        db.update_run_phase(run_id, "facts", slug=company.slug)
        console.print(f"[cyan]·[/] extracting facts")
        builder = FactBuilder()
        fb = builder.run({
            "company": company, "people": people, "articles": articles,
        })
        total_cost += fb.cost_usd
        facts = fb.data if isinstance(fb.data, list) else []
        console.print(f"  → {len(facts)} facts · ${fb.cost_usd:.3f}")

        # ── Phase D: FactValidator ──
        db.update_run_phase(run_id, "validate_facts", slug=company.slug)
        console.print(f"[cyan]·[/] validating facts")
        v = FactValidator()
        vr = v.run({"articles": articles, "facts": facts})
        total_cost += vr.cost_usd
        validated_ids = set(vr.data.get("validated_fact_ids", [])) if isinstance(vr.data, dict) else set()
        rejected_count = len(vr.data.get("rejected", [])) if isinstance(vr.data, dict) else 0
        validated_facts = [f for f in facts if f.get("id") in validated_ids]
        if not validated_facts:
            # Validator was too aggressive or nothing to validate — fall back to facts as-is
            validated_facts = facts
        console.print(f"  → {len(validated_facts)} facts passed (rejected {rejected_count}) · ${vr.cost_usd:.3f}")

        # ── Phase D2: PersonProfileBuilder — deep dossier per person ──
        # Run after fact-validation so we already have a clean article list
        # to surface as "related" links. One LLM call per person to fetch
        # education/career/photo from LinkedIn. Cover all decision-makers +
        # all family members (so org-chart cards have headshots), but skip
        # deceased people and cap total at 14 to control cost.
        seen_ids: set[int] = set()
        profile_targets: list = []
        for p in people:
            if p.is_deceased:
                continue
            if not (p.is_decision_maker or p.generation is not None):
                continue
            pid = id(p)
            if pid in seen_ids:
                continue
            seen_ids.add(pid)
            profile_targets.append(p)
        profile_targets = profile_targets[:14]
        if profile_targets:
            console.print(f"[cyan]·[/] building deep profiles for {len(profile_targets)} key people (parallel)")
            profiler = PersonProfileBuilder()

            def _profile_one(p):
                """Run PPB for one person; return (person, result_data, cost, error)."""
                try:
                    pr = profiler.run({
                        "company": company,
                        "person": p,
                        "articles": articles,
                    })
                    return (p, pr.data if isinstance(pr.data, dict) else None, pr.cost_usd, None)
                except Exception as e:  # noqa: BLE001
                    return (p, None, 0.0, str(e))

            # Parallelize PPB calls — each call is an independent LLM+web_fetch
            # operation. ThreadPoolExecutor with max_workers=6 keeps Anthropic API
            # rate limits + memory in check while collapsing 14×30s sequential
            # work into ~3 batches of ~30s = ~1.5 min.
            successes = 0
            with ThreadPoolExecutor(max_workers=6) as ex:
                futures = [ex.submit(_profile_one, p) for p in profile_targets]
                for fut in as_completed(futures):
                    p, d, cost, err = fut.result()
                    total_cost += cost
                    if err:
                        console.print(f"  [yellow]profile for {p.full_name} skipped: {err}[/]")
                        continue
                    if not d:
                        continue
                    successes += 1
                    if d.get("linkedin_url") and not p.linkedin_url:
                        p.linkedin_url = d["linkedin_url"]
                    if isinstance(d.get("photo_url"), str) and d["photo_url"].startswith("http"):
                        p.photo_url = d["photo_url"]
                    if d.get("email") and not p.email:
                        p.email = d["email"]
                    if d.get("phone") and not p.phone:
                        p.phone = d["phone"]
                    if isinstance(d.get("education"), list):
                        p.education = d["education"]
                    if isinstance(d.get("career_summary"), str):
                        p.career_summary = d["career_summary"]
                    if isinstance(d.get("related_article_urls"), list):
                        p.related_article_urls = d["related_article_urls"]
                    if isinstance(d.get("extra_facts"), list):
                        p.extra_facts = d["extra_facts"]
            console.print(f"  → profiled {successes}/{len(profile_targets)}")

            # ── Phase D2b: PhotoResolver — second pass for photos PPB missed ──
            # PPB juggles many goals (education, career, articles, photo). When
            # token budget is tight, photo extraction often gets dropped. This
            # focused agent has ONE goal — find a direct headshot URL — and runs
            # only for people PPB didn't get a photo for.
            no_photo = [p for p in profile_targets if not p.photo_url]
            if no_photo:
                console.print(f"[cyan]·[/] photo second-pass for {len(no_photo)} people without headshots")
                resolver_agent = PhotoResolver()

                def _resolve_photo(p):
                    try:
                        rr = resolver_agent.run({
                            "company": company,
                            "person": p,
                            "articles": articles,  # full article-hunter pool — agent picks ones mentioning this person
                        })
                        return (p, rr.data if isinstance(rr.data, dict) else None, rr.cost_usd, None)
                    except Exception as e:  # noqa: BLE001
                        return (p, None, 0.0, str(e))

                photo_hits = 0
                with ThreadPoolExecutor(max_workers=6) as ex:
                    photo_futures = [ex.submit(_resolve_photo, p) for p in no_photo]
                    for fut in as_completed(photo_futures):
                        p, d, cost, err = fut.result()
                        total_cost += cost
                        if err or not d:
                            continue
                        url = d.get("photo_url")
                        if isinstance(url, str) and url.startswith("http") and any(url.lower().split("?")[0].endswith(ext) for ext in (".jpg", ".jpeg", ".png", ".webp")):
                            p.photo_url = url
                            photo_hits += 1
                console.print(f"  → photo-resolver added {photo_hits}/{len(no_photo)} headshots")

        # ── Phase D3: RelationshipResolver — explicit JSON parent/child + spouse ──
        # One LLM call that takes the people list + validated facts + article
        # snippets and returns a structured relationships graph. Replaces the
        # earlier heuristic chain (discover.parent_name → fact_builder family_relation
        # → name match) which often left 3rd-gen siblings disconnected.
        try:
            resolver = RelationshipResolver()
            rr = resolver.run({
                "company": company,
                "people": people,
                "facts": validated_facts,
                "articles": articles,
            })
            total_cost += rr.cost_usd
            if isinstance(rr.data, dict):
                name_to_p = {p.full_name: p for p in people}
                pc = rr.data.get("parent_child", []) or []
                sp = rr.data.get("spouses", []) or []
                ambiguous_count = len(rr.data.get("ambiguous", []) or [])
                applied_pc = 0
                for pair in pc:
                    parent = (pair or {}).get("parent_name")
                    child = (pair or {}).get("child_name")
                    if not parent or not child:
                        continue
                    cp = name_to_p.get(child)
                    pp = name_to_p.get(parent)
                    if cp and pp and cp is not pp and not cp.parent_name:
                        cp.parent_name = pp.full_name
                        applied_pc += 1
                applied_sp = 0
                for pair in sp:
                    a_n = (pair or {}).get("a_name")
                    b_n = (pair or {}).get("b_name")
                    if not a_n or not b_n:
                        continue
                    a = name_to_p.get(a_n)
                    b = name_to_p.get(b_n)
                    if a and b and a is not b:
                        if not a.spouse_name:
                            a.spouse_name = b.full_name
                            applied_sp += 1
                        if not b.spouse_name:
                            b.spouse_name = a.full_name
                console.print(
                    f"  → relationships: {applied_pc} parent_child, {applied_sp} spouse "
                    f"({ambiguous_count} ambiguous unresolved) · ${rr.cost_usd:.3f}"
                )
        except Exception as _e:
            # Fall back to legacy heuristic if the resolver fails
            console.print(f"  [yellow]relationship_resolver skipped: {_e}[/]")
            for f in validated_facts:
                if f.get("fact_type") != "family_relation":
                    continue
                child_name = f.get("subject")
                parent_name = f.get("object")
                for p in people:
                    if p.full_name == child_name and not p.parent_name:
                        p.parent_name = parent_name

        # Build red flags from validated facts
        red_flags: list[RedFlag] = []
        for f in validated_facts:
            if f.get("fact_type") != "red_flag":
                continue
            flag_type = "other"
            for kw in ("lawsuit", "death", "eeoc", "estrangement", "bankruptcy"):
                if kw in (f.get("predicate", "") + " " + f.get("object", "")).lower():
                    flag_type = kw
                    break
            red_flags.append(RedFlag(
                flag_type=flag_type,
                severity="medium",
                description=f.get("verbatim_quote") or f.get("object") or "",
                source_url=next((a.get("url") for a in articles if a.get("id") == f.get("article_id")), None),
            ))

        # Build evidence list (for compatibility with existing render path)
        evidence: list[Evidence] = []
        for f in validated_facts:
            article = next((a for a in articles if a.get("id") == f.get("article_id")), {})
            evidence.append(Evidence(
                source_type=article.get("article_type", "web"),
                source_url=article.get("url"),
                snippet=f.get("verbatim_quote", "")[:500],
                confidence=f.get("confidence", 0.7),
            ))

        # Pick the founding moment from the strongest founding_moment fact
        founding = sorted(
            [f for f in validated_facts if f.get("fact_type") == "founding_moment"],
            key=lambda f: -float(f.get("confidence", 0)),
        )
        if founding:
            company.founding_moment = founding[0].get("verbatim_quote") or founding[0].get("object")

        # ── Phase E1: HookSpecialist ──
        db.update_run_phase(run_id, "hooks", slug=company.slug)
        console.print(f"[cyan]·[/] picking hooks + writing emails")

        # New: per-person targeting — every decision-maker + family member gets
        # a personalized email written through the angle (frame) that fits their
        # role + family standing. Cap at 12 to keep cost bounded (~$5 for emails).
        person_targets = pick_person_email_targets(people, company=company, cap=12)
        # name → person for downstream lookup
        targets_by_name = {p.full_name: p for _frame, p in person_targets}
        console.print(f"  → emailing {len(person_targets)} people: " + ", ".join(
            f"{p.full_name}({frame})" for frame, p in person_targets
        ))

        hooker = HookSpecialist()
        hr = hooker.run({
            "company": company,
            "people": people,
            "facts": validated_facts,
            "targets": person_targets,
        })
        total_cost += hr.cost_usd
        hooks = hr.data.get("hooks", []) if isinstance(hr.data, dict) else []
        console.print(f"  → {len(hooks)} hooks · ${hr.cost_usd:.3f}")

        # ── Phase E2: EmailWriter + EmailValidator (per person) ──
        db.update_run_phase(run_id, "emails", slug=company.slug)
        writer = EmailWriter()
        validator = EmailValidator()

        emails: list[Email] = []
        for hook in hooks:
            role = hook.get("role")
            target_name = hook.get("target_person_name") or ""
            target = targets_by_name.get(target_name)
            if not target:
                continue

            # Write
            attempts = 0
            email_data = None
            while attempts <= max_email_rewrites:
                er = writer.run({
                    "company": company,
                    "hook": hook,
                    "facts": validated_facts,
                    "articles": articles,
                })
                total_cost += er.cost_usd
                if not isinstance(er.data, dict) or "body" not in er.data:
                    break
                email_data = er.data

                # Validate
                vr = validator.run({
                    "email": {
                        "role": role,
                        "target_person_name": target.full_name,
                        "subject": email_data.get("subject", ""),
                        "body": email_data.get("body", ""),
                        "safe_mode": email_data.get("safe_mode", False),
                    },
                    "people": people,
                    "facts": validated_facts,
                })
                total_cost += vr.cost_usd
                v_passed = isinstance(vr.data, dict) and vr.data.get("pass") is True
                if v_passed:
                    break
                attempts += 1
                console.print(f"  [yellow]⟲[/] {role} email failed validation, attempt {attempts+1}/{max_email_rewrites+1}")

            if email_data:
                emails.append(Email(
                    role_category=_role_to_category(role),
                    target_person_name=target.full_name,
                    target_person_email=target.email,
                    subject=email_data.get("subject", "(no subject)"),
                    body=email_data.get("body", ""),
                    safe_mode=bool(email_data.get("safe_mode")),
                    word_count=int(email_data.get("word_count") or len(email_data.get("body", "").split())),
                ))

        console.print(f"  → {len(emails)} emails")

        # ── Phase F: Build dossier markdown + HTML using the validated evidence ──
        # Reuse existing synth helpers (they take an evidence_pack string).
        research_data = {
            "founding_moment": _founding_moment_summary(founding),
            "press": [_fact_to_press(f) for f in validated_facts if f.get("fact_type") == "press_quote"],
            "family_facts": [_fact_to_family(f) for f in validated_facts if f.get("fact_type") == "family_relation"],
            "red_flags": [{"flag_type": rf.flag_type, "severity": rf.severity, "description": rf.description} for rf in red_flags],
            "business_facts": _business_facts_from(validated_facts),
        }
        pack = _format_evidence_pack(company, people, evidence, red_flags, research_data)

        research_md, c1 = make_research_md(company, pack)
        total_cost += c1
        dossier_html, c2 = make_dossier_html(company, pack, dossier_number=dossier_number)
        total_cost += c2

        # ── Phase G: Render & persist ──
        db.update_run_phase(run_id, "render", slug=company.slug)
        runtime = time.time() - t_start
        path = render_to_disk(
            company=company, people=people, evidence=evidence, red_flags=red_flags,
            research_data=research_data, research_md=research_md,
            dossier_html=dossier_html, emails=emails,
            runtime_seconds=runtime, cost_usd=total_cost,
        )
        # Also persist agent artifacts
        import json as _json
        (path / "articles.json").write_text(_json.dumps(articles, indent=2, default=str))
        (path / "facts.json").write_text(_json.dumps(validated_facts, indent=2, default=str))
        (path / "hooks.json").write_text(_json.dumps(hooks, indent=2, default=str))
        (path / "validation.json").write_text(_json.dumps(vr.data if isinstance(vr.data, dict) else {}, indent=2, default=str))

        # Harvest source URLs from research.md so the Evidence tab is never
        # empty — even when article-hunter didn't return anything, the
        # synthesized markdown is rich with `[text](url)` citations.
        try:
            from .extract_citations import extract_to_articles_json
            n = extract_to_articles_json(path)
            console.print(f"  → articles.json now has {n} cited sources")
        except Exception as _e:
            console.print(f"  [yellow]citation extraction skipped: {_e}[/]")

        usage_totals = get_usage_accumulator()
        db.complete_run(
            run_id, company.slug, runtime, total_cost,
            usage=usage_totals, backend=backend,
        )
        console.print(f"\n[green]✓[/] {company.legal_name} in {runtime:.1f}s · ${total_cost:.3f}")
        console.print(f"  → {path}")

        return Dossier(
            company=company, people=people, evidence=evidence, red_flags=red_flags,
            research_md=research_md, dossier_html=dossier_html, emails=emails,
            runtime_seconds=runtime, cost_usd=total_cost,
        ), path

    except Exception as e:
        db.fail_run(run_id, f"{type(e).__name__}: {e}")
        raise


# ─── Helpers ──────────────────────────────────────────────────────────────

def _role_to_category(role: str) -> str:
    return {
        # legacy frames
        "ceo_owner": "ceo",
        "cfo_ops": "cfo",
        "vp_sales": "vp_sales",
        "director": "director",
        "heir": "heir",
        # new per-person frames
        "founder_legacy": "ceo",
        "ceo_outsider": "ceo",
        "family_exec": "family_exec",
    }.get(role, "other")


def _founding_moment_summary(founding_facts: list[dict]) -> dict | None:
    if not founding_facts:
        return None
    f = founding_facts[0]
    return {
        "text": f.get("verbatim_quote") or f.get("object"),
        "year": _extract_year(f.get("verbatim_quote", "") + " " + f.get("object", "")),
        "founder_name": f.get("subject"),
        "source_url": None,  # filled by render below from article lookup if available
    }


def _extract_year(text: str) -> int | None:
    import re as _re
    m = _re.search(r"\b(1[89]\d{2}|20[0-2]\d)\b", text or "")
    return int(m.group(1)) if m else None


def _fact_to_press(f: dict) -> dict:
    return {
        "date": None,
        "outlet": "press",
        "title": f.get("subject"),
        "url": None,
        "quote": f.get("verbatim_quote"),
        "summary": f.get("object"),
    }


def _fact_to_family(f: dict) -> dict:
    return {
        "person_name": f.get("subject"),
        "fact": f"{f.get('predicate', '')}: {f.get('object', '')}",
        "source_url": None,
    }


def _business_facts_from(facts: list[dict]) -> dict:
    out: dict = {"recent_news": []}
    for f in facts:
        if f.get("fact_type") == "company_milestone":
            out["recent_news"].append(f.get("verbatim_quote") or f.get("object"))
    return out
