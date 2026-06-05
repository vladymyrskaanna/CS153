"""Person deduplication and family-tree wiring.

The LLM often emits duplicate person entries with slightly different names:
  - 'W. Rockwell "Rocky" Wirtz' vs 'W. Rockwell Wirtz'
  - 'Jeffrey "Jeff" Vukelic' vs 'Jeff Vukelic'
  - 'John Smith Jr.' vs 'John Smith'

This module:
1. Normalizes names (strip quoted nicknames, suffixes, punctuation)
2. Merges duplicates, preferring the entry with more data
3. Resolves family_relation_to strings into parent_id pointers
"""

from __future__ import annotations

import re
from typing import Optional

from .models import Person


HONORIFICS = {"mr", "mrs", "ms", "dr", "fr", "rev"}
SUFFIXES = {"jr", "sr", "ii", "iii", "iv", "v"}


def normalize_name(name: str) -> str:
    """Canonical form: lowercased, no quoted nicknames, no punctuation, no suffix.

    'W. Rockwell "Rocky" Wirtz Jr.' → 'rockwell wirtz'
    'Jeffrey \\'Jeff\\' Vukelic'    → 'jeffrey vukelic'
    """
    if not name:
        return ""
    n = name.lower()
    # strip 'nickname' or "nickname" segments
    n = re.sub(r'"[^"]*"', " ", n)
    n = re.sub(r"'[^']*'", " ", n)
    n = re.sub(r"\([^)]*\)", " ", n)
    # strip middle initials like "w." or "j.r."
    n = re.sub(r"\b[a-z]\.\s*", " ", n)
    # strip punctuation
    n = re.sub(r"[^\w\s]", " ", n)
    # collapse whitespace
    tokens = [t for t in n.split() if t]
    # drop honorifics + suffixes
    tokens = [t for t in tokens if t not in HONORIFICS and t not in SUFFIXES]
    return " ".join(tokens)


def first_last(name: str) -> tuple[str, str]:
    """Return (first_token, last_token) of normalized name. Used for fuzzy match."""
    norm = normalize_name(name)
    parts = norm.split()
    if not parts:
        return "", ""
    if len(parts) == 1:
        return parts[0], parts[0]
    return parts[0], parts[-1]


def _person_data_score(p: Person) -> int:
    """Rough score = how 'rich' a person record is. Prefer keeping the higher one."""
    score = 0
    if p.title: score += 2
    if p.role_category: score += 2
    if p.generation: score += 2
    if p.linkedin_url: score += 3
    if p.email: score += 3
    if p.bio_short: score += 1 + (len(p.bio_short) // 80)
    if p.is_decision_maker: score += 1
    score += len(p.key_facts or [])
    return score


def merge_people(primary: Person, dup: Person) -> Person:
    """Merge dup INTO primary, returning primary. Prefer non-empty fields from primary."""
    for field in (
        "title", "role_category", "generation", "linkedin_url",
        "email", "phone", "family_relation_to", "bio_short",
        "birth_year", "death_year",
    ):
        if not getattr(primary, field) and getattr(dup, field):
            setattr(primary, field, getattr(dup, field))
    if dup.is_deceased:
        primary.is_deceased = True
    if dup.is_decision_maker:
        primary.is_decision_maker = True
    # Merge key_facts (preserving order, dropping dups)
    existing = set(primary.key_facts or [])
    for f in dup.key_facts or []:
        if f and f not in existing:
            primary.key_facts.append(f)
            existing.add(f)
    # Prefer the longer / richer name (with quotes) for display
    if len(dup.full_name) > len(primary.full_name):
        primary.full_name = dup.full_name
    return primary


def dedupe_people(people: list[Person]) -> list[Person]:
    """Merge duplicates by normalized name."""
    by_norm: dict[str, Person] = {}
    for p in people:
        key = normalize_name(p.full_name)
        if not key:
            by_norm[p.full_name] = p
            continue
        if key in by_norm:
            existing = by_norm[key]
            # Keep the higher-scoring as primary
            if _person_data_score(p) > _person_data_score(existing):
                by_norm[key] = merge_people(p, existing)
            else:
                by_norm[key] = merge_people(existing, p)
        else:
            by_norm[key] = p
    return list(by_norm.values())


# ─── Family tree resolution ─────────────────────────────────────────

_RELATION_PATTERNS = [
    # 'son of [Name]', 'daughter of [Name]', 'child of [Name]'
    (re.compile(r"\b(?:son|daughter|child)\s+of\s+(.+)", re.I), "child"),
    (re.compile(r"\b(?:father|mother|parent)\s+of\s+(.+)", re.I), "parent"),
    (re.compile(r"\b(?:grandson|granddaughter|grandchild)\s+of\s+(.+)", re.I), "grandchild"),
    (re.compile(r"\b(?:grandfather|grandmother|grandparent)\s+of\s+(.+)", re.I), "grandparent"),
    (re.compile(r"\b(?:brother|sister|sibling)\s+of\s+(.+)", re.I), "sibling"),
    (re.compile(r"\b(?:wife|husband|spouse|married\s+to)\s+(?:of\s+)?(.+)", re.I), "spouse"),
    (re.compile(r"\b(?:nephew|niece)\s+of\s+(.+)", re.I), "nephew_niece"),
    (re.compile(r"\b(?:cousin)\s+of\s+(.+)", re.I), "cousin"),
]


def parse_relation(text: str | None) -> tuple[str, str] | None:
    """Parse 'son of John Smith' → ('child', 'John Smith'). Returns (role, target_name) or None."""
    if not text:
        return None
    for pat, role in _RELATION_PATTERNS:
        m = pat.search(text)
        if m:
            target = m.group(1).strip().rstrip(".,;")
            return role, target
    return None


def find_person_by_name(people: list[Person], name: str) -> Person | None:
    """Find a person by approximate name match using normalized form."""
    target = normalize_name(name)
    if not target:
        return None
    target_first, target_last = first_last(name)

    # Try exact normalized match
    for p in people:
        if normalize_name(p.full_name) == target:
            return p
    # Try last-name + first-name match
    for p in people:
        f, l = first_last(p.full_name)
        if l == target_last and (f == target_first or len(target_first) <= 2 or len(f) <= 2):
            return p
    # Try last-name only
    for p in people:
        _, l = first_last(p.full_name)
        if l == target_last:
            return p
    return None


def build_family_tree(people: list[Person]) -> dict:
    """Return a nested tree structure rooted at people who have no parent.

    Returns:
        {
            "roots": [Person, ...],
            "children": {person_name: [Person, ...]},  # name → list of direct descendants
            "spouse": {person_name: Person},
            "orphans": [Person, ...],  # people with no resolved parent who are also not roots
        }
    """
    # Build parent_name + spouse_name lookups.
    parent_of: dict[str, str] = {}      # child_name → parent_name
    spouse_of: dict[str, str] = {}      # name → spouse_name

    by_name = {p.full_name: p for p in people}

    # 1) explicit spouse_name first (so we can ignore conflicting parent_name)
    for p in people:
        if p.spouse_name and p.spouse_name in by_name:
            spouse_of[p.full_name] = p.spouse_name
            spouse_of[p.spouse_name] = p.full_name

    # 2) explicit parent_name from LLM, BUT skip if it conflicts with spouse_name
    #    (some agents confuse "spouse of" with "parent of")
    for p in people:
        if not p.parent_name:
            continue
        # If parent_name matches a known spouse, ignore — it's a parsing confusion.
        if spouse_of.get(p.full_name) == p.parent_name:
            continue
        target = find_person_by_name(people, p.parent_name)
        if target and target.full_name != p.full_name:
            parent_of[p.full_name] = target.full_name

    # 3) legacy family_relation_to free-text (back-compat for older data)
    for p in people:
        if p.full_name in parent_of:
            continue
        rel = parse_relation(p.family_relation_to)
        if not rel:
            continue
        role, target_name = rel
        target = find_person_by_name(people, target_name)
        if not target:
            continue
        if role == "child":
            parent_of[p.full_name] = target.full_name
        elif role == "parent":
            parent_of[target.full_name] = p.full_name
        elif role == "spouse":
            spouse_of.setdefault(p.full_name, target.full_name)
            spouse_of.setdefault(target.full_name, p.full_name)

    # Detect spouse pairs at each generation BEFORE child-parent inference, so we
    # can pick a single canonical parent when a child has multiple gen-1 candidates
    # with the same last name (e.g. Merlin AND Edith Doll for Mark Doll).
    by_gen: dict[int, list[Person]] = {}
    for p in people:
        if p.generation is not None:
            by_gen.setdefault(int(p.generation), []).append(p)

    # Only auto-pair at Gen 1 (founders), where same-lastname-same-gen is almost
    # always a founding couple. At Gen 2+ it's siblings (Mark Doll + Scott Doll).
    # Explicit spouse_name from the LLM still applies at any generation.
    canonical_parent_for: dict[str, str] = {}  # any spouse name → the canonical-primary name
    if 1 in by_gen:
        members = by_gen[1]
        by_last: dict[str, list[Person]] = {}
        for p in members:
            _, last = first_last(p.full_name)
            if last:
                by_last.setdefault(last, []).append(p)
        for last, group in by_last.items():
            if len(group) != 2:
                continue
            a, b = group
            if spouse_of.get(a.full_name) and spouse_of[a.full_name] != b.full_name:
                continue
            def score(p: Person) -> int:
                s = 0
                if p.bio_short: s += 2
                if p.title: s += 1
                if not p.is_deceased: s += 1
                if p.linkedin_url: s += 1
                # Prefer the founder whose bio mentions "started" or "founded"
                if p.bio_short and any(kw in p.bio_short.lower() for kw in ("started the company", "founded the company", "started the business", "launched the company")):
                    s += 3
                return s
            primary = a if score(a) >= score(b) else b
            secondary = b if primary is a else a
            spouse_of[primary.full_name] = secondary.full_name
            spouse_of[secondary.full_name] = primary.full_name
            canonical_parent_for[primary.full_name] = primary.full_name
            canonical_parent_for[secondary.full_name] = primary.full_name

    # Infer parents for any child without an explicit parent_of entry.
    have_parent = set(parent_of.keys())
    for gen in sorted(by_gen.keys()):
        if gen <= 1:
            continue
        for p in by_gen[gen]:
            if p.full_name in have_parent:
                continue
            _, last = first_last(p.full_name)
            candidates = [
                pr for pr in by_gen.get(gen - 1, [])
                if first_last(pr.full_name)[1] == last
            ]
            # Collapse spouses: if all candidates resolve to one canonical primary, use it.
            canonical_set = {
                canonical_parent_for.get(c.full_name, c.full_name) for c in candidates
            }
            if len(canonical_set) == 1 and canonical_set:
                parent_of[p.full_name] = next(iter(canonical_set))
                have_parent.add(p.full_name)
            elif len(candidates) >= 1:
                # Ambiguous (e.g. multiple siblings as candidates). Attach to the
                # FIRST candidate by appearance order — keeps the tree connected
                # rather than leaving the person as an orphan root at the top.
                # This is an approximation; flag it via parent_inferred=True if needed.
                parent_of[p.full_name] = candidates[0].full_name
                have_parent.add(p.full_name)

    # Build children index
    children: dict[str, list[Person]] = {}
    for child_name, parent_name in parent_of.items():
        children.setdefault(parent_name, [])
        # find Person object
        child_obj = next((p for p in people if p.full_name == child_name), None)
        if child_obj:
            children[parent_name].append(child_obj)

    # Sort children by generation then name
    for k, kids in children.items():
        kids.sort(key=lambda p: (p.generation or 99, p.full_name))

    # Find roots: people who are NOT children of anyone in our list
    descendant_names = set(parent_of.keys())
    roots = [p for p in people if p.full_name not in descendant_names]

    # Among roots, prefer founders (gen 1) first, then by generation, then name
    roots.sort(key=lambda p: (
        p.generation if p.generation is not None else 99,
        not p.is_deceased,  # deceased founders first
        p.full_name,
    ))

    # Spouses we want as a side-companion. Spouse map is not used for tree shape,
    # only for showing a 'married to' note next to a node.
    spouse_obj_map: dict[str, Person] = {}
    by_name = {p.full_name: p for p in people}
    seen_pairs: set[frozenset[str]] = set()
    for a, b in spouse_of.items():
        key = frozenset({a, b})
        if key in seen_pairs:
            continue
        seen_pairs.add(key)
        # Prefer to attach the spouse to the one inside the tree
        spouse_obj = by_name.get(b)
        if spouse_obj and a in by_name:
            spouse_obj_map[a] = spouse_obj

    # Collapse spouse pairs that are both roots: keep only the canonical primary.
    by_name = {p.full_name: p for p in people}
    primary_of = {sec: pri for pri, sec in canonical_parent_for.items() if pri == canonical_parent_for.get(pri)}
    # Build a map secondary→primary using canonical_parent_for entries where canonical != self
    secondary_to_primary: dict[str, str] = {
        secondary: primary
        for secondary, primary in canonical_parent_for.items()
        if secondary != primary
    }
    deduped_roots: list[Person] = []
    seen: set[str] = set()
    for r in roots:
        if r.full_name in seen:
            continue
        if r.full_name in secondary_to_primary:
            # this root is a spouse-secondary; skip — primary will represent the pair
            seen.add(r.full_name)
            continue
        # If r is primary and its spouse exists, attach as spouse_obj_map
        spouse_name = spouse_of.get(r.full_name)
        if spouse_name and spouse_name in by_name and spouse_name not in spouse_obj_map:
            spouse_obj_map[r.full_name] = by_name[spouse_name]
        deduped_roots.append(r)
        seen.add(r.full_name)
    roots = deduped_roots

    return {
        "roots": roots,
        "children": children,
        "spouse": spouse_obj_map,
        "parent_of": parent_of,
    }
