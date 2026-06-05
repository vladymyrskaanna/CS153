# CLAUDE.md

Guidance for Claude Code when working in this repository.

## Project: AI Intelligence — AI Distributor Researcher & CRM (CS 153)

A sales CRM for U.S. beer/beverage distributors with an **AI research pipeline**: for
any distributor it builds a cited dossier (overview, reporting org chart, source
articles, verbatim facts, risk flags) and drafts **personalized outreach emails**.

See [README.md](README.md) for the full overview, setup, and CS 153 rubric mapping.

## Active code

- **`backend/`** — backend: Express + tsx + drizzle-orm + postgres-js + zod.
  - `server/index.ts` — app entry; mounts routers (api, research, pipeline, materials, outreach).
  - `server/routes.ts` — distributor/contact CRM REST API.
  - `server/research.ts` — research dossier + per-distributor emails endpoints.
  - `server/worker.ts` — polls `research.run`, delegates to the external research pipeline, imports the dossier.
  - `server/outreach.ts` + `server/instantly.ts` — mailbox list + email send (used by the Emails tab).
  - `src/lib/db/schema.ts` — drizzle schema for `distributor.*` (groups, branches, notes).
- **`frontend/`** — frontend: React + Vite + shadcn/ui + TanStack Query.
  - `src/pages/DistributorsPage.tsx`, `src/pages/DistributorDetailPage.tsx`.
  - `src/components/{OrgChartTable,FamilyTree,IntelPanel,PersonSidePanel}.tsx` — dossier tabs.
  - `src/lib/api.ts` — typed API client.
- **`backend/sql/sample-data.sql`** — committed sample dataset (5 fully-researched distributors).
- **`agents/`** — the **Python research pipeline** (the real agent code). `aimerch/agents/*.py`
  (article_hunter, fact_builder, validator, hook_specialist, email_writer, email_validator,
  person_profile_builder…); `aimerch/pipeline/orchestrator.py` chains them; `aimerch/api/` is
  the FastAPI server the backend worker calls; `aimerch/llm.py` is the Claude client.
- **`.claude/agents/`** — the same agents mirrored as Claude Code prompts (alternative runner).
  Both produce the cited dossiers + emails the app renders; see README.

## Commands

```bash
cd backend && pnpm dev:api      # backend API (:4041) + research worker
cd frontend && pnpm dev       # frontend (:5181, proxies /api → :4041)
cd backend && pnpm test:e2e     # backend e2e tests (needs both dev servers running)
cd backend && pnpm test:unit    # pure unit tests (no server needed)
```

DB: `ai_intelligence` (Postgres). Load the sample with
`psql ai_intelligence -f backend/sql/sample-data.sql`. Login: `admin` / `BeerDist2024!`.

## Scope notes

- The app is **distributor-focused**: nav is Distributors + Dashboard. The Campaigns,
  Mailboxes, and global Contacts pages were
  intentionally removed. The per-distributor **Emails** tab is review-only (read the draft,
  click a recipient to open their contact panel); the backend `outreach`/`instantly` modules
  remain for backend-only programmatic send (requires `INSTANTLY_*`).
- **Production is off-limits.** A separate live deployment exists on a private remote server —
  never deploy to or mutate it from this repo.
