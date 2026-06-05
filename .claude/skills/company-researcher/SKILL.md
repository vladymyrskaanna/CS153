---
name: company-researcher
version: 1.0.0
description: >
  Research any company and produce a structured, cited dossier — overview,
  reporting org chart, source articles, verbatim-quoted facts, and risk flags.
  Powers AI Intelligence. Live research is delegated to the external AI Intelligence pipeline;
  seeded companies make the capability fully demoable offline.
triggers:
  - "research <company>"
  - "research a company"
  - "build a dossier for <company>"
  - "look up <company>"
  - "who runs <company> / org chart for <company>"
tools:
  - server/research-source.ts   # adapter: external pipeline → IntelBundle
  - server/persist.ts           # single DB writer
  - server/worker.ts            # queue processor
mutating: true   # writes companies/intel/people/articles/facts/flags
---

# company-researcher

## Contract

Given `{ name, website? }`, produce a validated `IntelBundle`:

```
IntelBundle = {
  company: Company,        // identity + status
  intel:   Intel | null,   // narrative dossier (Overview tab)
  people:  Person[],       // reporting org chart (reports_to) + Contacts
  articles: Article[],     // Sources
  facts:   Fact[],         // Sources — each with a verbatim_quote + citation
  flags:   Flag[],         // risk flags
}
```

**Invariants (gated by the eval):**
1. The bundle is `zod`-valid (`src/lib/types.ts → IntelBundle`).
2. **Evidence guarantee** — every `fact` cites a source (`articleId` → a real
   article, or an inline `sourceUrl`). Unsourced facts are dropped.
3. The org chart is resolvable — every `reports_to_id` points at a real person;
   dangling managers become `null`, never a broken reference.

## Phases

1. **Gate** — `research()` requires `AIMERCH_BASE` (the external pipeline). With
   it unset, throws a typed `ResearchUnavailableError`; seeded companies still load.
2. **Fetch** — enqueue → poll → fetch the company payload from the pipeline.
3. **Map** — `mapAimerchToBundle()` (pure, unit-tested) normalizes the payload:
   assigns ids, resolves reporting links by name, links facts to articles by URL,
   normalizes flag severity, validates against the schema.
4. **Persist** — `persistBundle()` upserts the company and replaces its children
   in one path shared with the seed script.

## Output Format

A single validated `IntelBundle`, persisted to the `company` Postgres schema and
served at `GET /api/companies/:id/intel` for the detail page.

## Skill completeness (this repo — standalone TS, not gbrain/OpenClaw)

| # | Item | Status |
|---|------|--------|
| 1 | SKILL.md | ✅ this file |
| 2 | Deterministic code | ✅ `server/research-source.ts` (`mapAimerchToBundle`) |
| 3 | Unit tests | ✅ `tests/unit/research-source.test.ts`, `types.test.ts`, `fixtures.test.ts` |
| 4 | Integration tests | ✅ `tests/e2e/worker.test.ts`, `tests/e2e/api.test.ts` (real Postgres) |
| 5 | Evals | ✅ `tests/eval/company-researcher.eval.test.ts` (happy / edge / adversarial) |
| 6 | Resolver trigger | ⚪️ N/A — no gbrain `skills/RESOLVER.md` in this repo (triggers listed above) |
| 7 | Resolver trigger eval | ⚪️ N/A — no resolver |
| 8 | `gbrain check-resolvable` | ⚪️ N/A — gbrain not installed |
| 9 | E2E test | ✅ `tests/e2e/api.test.ts` (user turn → DB side effect → API shape) |
| 10 | Brain filing | ⚪️ N/A — no brain pages |

Applicable items (1–5, 9): **6/6 complete.** gbrain-specific items (6–8, 10) are
marked N/A because this is a standalone TypeScript app, not a gbrain workspace.

## Run

```bash
cd crm
pnpm vitest run tests/unit/research-source.test.ts   # unit
pnpm vitest run tests/eval                            # evals
pnpm vitest run tests/e2e                             # integration + e2e
```
