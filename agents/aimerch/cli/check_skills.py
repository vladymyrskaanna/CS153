"""aimerch-check-skills — local equivalent of `gbrain check-resolvable`.

Validates the skill tree:

1. Reachability — every SKILL.md in `~/.claude/skills/` is referenced from
   `skills/RESOLVER.md` in this repo.
2. MECE — no two skills share an identical trigger pattern.
3. Frontmatter conformance — each SKILL.md has the required YAML keys
   (`name`, `description`). `version`, `triggers`, `tools`, `mutating`
   are recommended (warnings) per skillify spec.
4. Reverse reachability — every entry in RESOLVER.md points to a SKILL.md
   that actually exists.

Exit code 0 = pass, 1 = fail. Prints a human-readable report.
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

import click

# Skillify-required + recommended frontmatter keys
REQUIRED_KEYS = ("name", "description")
RECOMMENDED_KEYS = ("version", "triggers", "tools", "mutating")


def _read_frontmatter(path: Path) -> dict:
    """Lightweight YAML frontmatter parser. Avoids the PyYAML dep for one file."""
    text = path.read_text(encoding="utf-8")
    if not text.startswith("---"):
        return {}
    end = text.find("---", 3)
    if end < 0:
        return {}
    fm = text[3:end].strip()
    out: dict = {}
    current_key: str | None = None
    for line in fm.splitlines():
        if not line.strip():
            continue
        # multi-line value continuation (description: |)
        if current_key and (line.startswith("  ") or line.startswith("\t")):
            out[current_key] = (out.get(current_key) or "") + " " + line.strip()
            continue
        m = re.match(r"^([a-zA-Z_][a-zA-Z0-9_]*):\s*(.*)$", line)
        if not m:
            current_key = None
            continue
        key, val = m.group(1), m.group(2).strip()
        if val == "" or val == "|":
            current_key = key
            out[key] = ""
        elif val.startswith("- "):
            current_key = None
            out[key] = [val[2:].strip()]
        else:
            current_key = None
            out[key] = val.strip('"').strip("'")
    return out


def _list_user_skills() -> list[Path]:
    """Find every ~/.claude/skills/<name>/SKILL.md."""
    base = Path.home() / ".claude" / "skills"
    if not base.exists():
        return []
    return sorted(base.glob("*/SKILL.md"))


def _load_resolver_skill_names(resolver: Path) -> set[str]:
    """Extract `### <name>` headings from RESOLVER.md."""
    if not resolver.exists():
        return set()
    text = resolver.read_text(encoding="utf-8")
    return set(re.findall(r"^### ([a-zA-Z0-9_-]+)\s*$", text, re.M))


@click.command()
@click.option(
    "--resolver", default="skills/RESOLVER.md", type=click.Path(),
    help="Path to RESOLVER.md (default: ./skills/RESOLVER.md)",
)
@click.option("--strict", is_flag=True, help="Fail on warnings, not just errors")
def main(resolver: str, strict: bool) -> None:
    """Validate the skill tree against the skillify checklist."""
    resolver_path = Path(resolver)
    skills = _list_user_skills()
    resolver_names = _load_resolver_skill_names(resolver_path)

    errors: list[str] = []
    warnings: list[str] = []

    if not resolver_path.exists():
        errors.append(f"RESOLVER.md not found at {resolver_path}")
        click.echo("✗ " + errors[0])
        sys.exit(1)

    click.echo(f"Resolver:  {resolver_path}")
    click.echo(f"Skills:    {len(skills)} SKILL.md files under ~/.claude/skills/")
    click.echo(f"Resolver entries: {len(resolver_names)}")
    click.echo()

    seen_skill_names: dict[str, Path] = {}
    seen_triggers: dict[str, str] = {}

    # 1. Per-SKILL.md frontmatter + reachability
    for skill_path in skills:
        skill_name = skill_path.parent.name
        click.echo(f"▶ {skill_name}")
        seen_skill_names[skill_name] = skill_path

        fm = _read_frontmatter(skill_path)

        # Required keys
        for k in REQUIRED_KEYS:
            if k not in fm or not fm[k]:
                errors.append(f"{skill_name}: missing required frontmatter `{k}`")
                click.echo(f"    ✗ missing required `{k}`")

        # Recommended keys → warnings
        for k in RECOMMENDED_KEYS:
            if k not in fm:
                warnings.append(f"{skill_name}: missing recommended frontmatter `{k}`")
                click.echo(f"    ⚠ missing recommended `{k}`")

        # Reachability
        if skill_name not in resolver_names:
            errors.append(f"{skill_name}: not referenced in RESOLVER.md (orphan)")
            click.echo(f"    ✗ not in RESOLVER.md (orphan skill)")
        else:
            click.echo(f"    ✓ in RESOLVER.md")

        # MECE: collect triggers
        triggers = fm.get("triggers", "")
        if isinstance(triggers, str):
            for line in triggers.split("\n"):
                t = line.strip().strip("-").strip().strip('"').strip("'")
                if not t:
                    continue
                if t in seen_triggers and seen_triggers[t] != skill_name:
                    errors.append(
                        f"trigger collision: {t!r} claimed by both "
                        f"{seen_triggers[t]} and {skill_name}"
                    )
                    click.echo(f"    ✗ trigger collision on {t!r}")
                else:
                    seen_triggers[t] = skill_name

    # 2. Reverse reachability — RESOLVER references skills that don't exist
    for name in resolver_names:
        if name not in seen_skill_names:
            warnings.append(
                f"RESOLVER.md references `{name}` but no SKILL.md found at "
                f"~/.claude/skills/{name}/SKILL.md"
            )

    # ─── Report ─────────────────────────────────────────────────────────
    click.echo()
    click.echo(f"Errors:    {len(errors)}")
    click.echo(f"Warnings:  {len(warnings)}")
    if errors:
        click.echo()
        click.echo("✗ FAIL — errors:")
        for e in errors:
            click.echo(f"  - {e}")
    if warnings:
        click.echo()
        click.echo("⚠ Warnings:")
        for w in warnings:
            click.echo(f"  - {w}")

    if errors or (strict and warnings):
        sys.exit(1)
    click.echo()
    click.echo(f"✓ OK — {len(seen_skill_names)} skills, all reachable, no MECE collisions.")
    sys.exit(0)


if __name__ == "__main__":
    main()
