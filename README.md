# AI Intelligence

**An AI tool that researches any company and turns what it finds into personalized outreach.**

> Stanford **CS 153 · Frontier Systems** — *"The One-Person Frontier Lab."*
> Point it at a company and a pipeline of specialized AI agents builds a fully **cited dossier** —
> overview, reporting **org chart**, source articles, verbatim-quoted facts, risk flags — and
> drafts **personalized emails** for the right decision-makers. Demoed on the U.S. beer &
> beverage distributor market (~3,000 companies).

**Track:** [2] Application / Product + [3] Automation / Agent Systems.

**Links:** [▶ Demo video](https://drive.google.com/file/d/10KcBJwaBpXkPyEK9S7P4FnDPG4608Ckb/view) ·
[GitHub repo](https://github.com/vladymyrskaanna/CS153) ·
compute on [DigitalOcean](https://www.digitalocean.com) (Gradient agent endpoints + CS 153 credits) ·
built with [React](https://react.dev) · [Vite](https://vite.dev) · [shadcn/ui](https://ui.shadcn.com) ·
[drizzle](https://orm.drizzle.team) · [FastAPI](https://fastapi.tiangolo.com) · [Anthropic / Claude](https://www.anthropic.com).

---

## Repository layout

```
AI-Intelligence/
├── agents/      Python research pipeline — the AI agents themselves (track [3])
│   ├── aimerch/agents/    article_hunter · fact_builder · validator · hook_specialist
│   │                      · email_writer · email_validator · person_profile_builder …
│   ├── aimerch/pipeline/  orchestrator that chains the agents (discover→enrich→synthesize)
│   ├── aimerch/api/       FastAPI server (the research endpoint the backend calls)
│   └── aimerch/llm.py     Claude client every agent uses
├── backend/     Express + drizzle-orm + postgres — CRM API & research worker (:4041)
├── frontend/    React + Vite + shadcn/ui — the dashboard UI (:5181)
└── .claude/agents/   the same agents as Claude Code prompts (an alternative runner)
```

**Flow:** a company URL → the Python **agents/** pipeline (FastAPI → orchestrator → each agent
calls Claude) → a cited dossier written to **Postgres** → the **backend** API serves it → the
**frontend** dashboard renders it. A trimmed sample dataset ships in the repo so the app is
demoable offline without re-running the pipeline.

---

## Quick start

Prereqs: **Node 20+**, **pnpm**, local **PostgreSQL**.

```bash
# 1 — Database: create it and load the committed sample (5 researched distributors)
createdb ai_intelligence
psql ai_intelligence -f backend/sql/sample-data.sql

# 2 — Backend (API :4041 + research worker)
cd backend
cp .env.example .env          # set DATABASE_URL and SESSION_SECRET
pnpm install
pnpm dev:api

# 3 — Frontend (Vite :5181, proxies /api → :4041)
cd ../frontend
pnpm install
pnpm dev
```

Open **http://localhost:5181** and sign in: **`admin` / `BeerDist2024!`**.

**Running the agent pipeline (optional)** — the app above runs on the committed sample, so this
is only needed to research a *new* company:

```bash
cd agents
python3 -m venv .venv && .venv/bin/pip install -e .
cp .env.example .env                       # set the LLM backend (DigitalOcean Gradient) keys
.venv/bin/uvicorn aimerch.api.server:app --port 7800
# then in backend/.env set RESEARCH_API_BASE=http://localhost:7800
```

---

## How it works — the multi-agent research pipeline

The core of the project (track [3]). Research-to-outreach runs as a chain of **Claude (Opus)
agents — one orchestrator + specialists** — each with a single job, each handing a structured
artifact to the next. The agents are real Python code in [`agents/aimerch/agents/`](agents/aimerch/agents/)
(run by [`agents/aimerch/pipeline/orchestrator.py`](agents/aimerch/pipeline/orchestrator.py) and
exposed via the FastAPI server in [`agents/aimerch/api/`](agents/aimerch/api/)); the same agents
are also mirrored as Claude Code prompts in [`.claude/agents/`](.claude/agents/).

```
distributor-researcher (orchestrator)
   │  reads the company's own pages → company.json (business + people + org chart)
   ▼
1. article-hunter    → finds the best primary sources (newspaper histories, obituaries,
                       alumni profiles, trade press, court records)        → articles.json
2. fact-builder      → extracts atomic facts, each tied to a verbatim quote + source
3. fact-validator    → re-checks every quote against its article; drops anything unsupported
4. hook-specialist   → picks the strongest, most specific opener per decision-maker
5. email-writer      → drafts the full personalized email for each hook
6. email-validator   → verifies every name / year / quote against the facts; rewrites on miss
   │  orchestrator persists the dossier into Postgres (the backend worker imports it)
   ▼
        Overview · Org Chart · Sources · Flags · Emails · printable Report
```

This is where the **evidence guarantee** comes from: `fact-validator` rejects any quote that
isn't verbatim from a source, and `email-validator` blocks any email claim that doesn't trace
to a validated fact. The committed 5-company sample was produced by this pipeline.

Beyond the six core stages shown above, the pipeline also has helper agents — for building
per-person profiles, resolving family relationships, and finding photos — for ~10 specialist
agents in total, all under [`agents/aimerch/agents/`](agents/aimerch/agents/).

**Compute:** the agents run on **DigitalOcean** — Gradient agent endpoints provide the LLM
inference and built-in web search the agents use, hosted on DigitalOcean infrastructure (CS 153
DigitalOcean credits). The FastAPI service in `agents/aimerch/api/` is deployed there as the
research endpoint the backend worker calls.

---

## What you can do in the app

- **Browse** a searchable, sortable list of companies.
- **Overview** — generated summary, size, **Stores**, **Tier · Score**, top brands, founding moment.
- **Org Chart** — the reporting hierarchy as a **table or family tree**, with per-person dossiers
  (title, decision-maker flag, experience, education, related articles).
- **Sources** — every fact backed by a verbatim quote + a source link.
- **Flags** — risk signals with severity, each linked to its source.
- **Emails** — a separate personalized draft per decision-maker, grounded in the validated facts.
- **Report** — a one-click printable, magazine-style dossier (Download PDF).

---

## Evaluation & evidence

- **Cited facts** — every fact carries a verbatim quote + source, so claims are traceable, not
  asserted. The two validator agents enforce this automatically.
- **Tests** — backend unit tests (`pnpm test:unit`, no server needed) and e2e API tests
  (`pnpm test:e2e`, needs both dev servers): auth, list / detail / pagination, dashboard counts,
  create/edit round-trips.
- **Real data** — all five seeded companies carry real, cited dossiers researched from primary
  sources (Gulf, Saratoga Eagle, Doll, Manhattan Beer, Empire).

## AI usage disclosure

- **Claude (Opus), via Claude Code** — pair-programmer for the schema, API, worker, frontend,
  tests, and docs. All AI-generated code was reviewed and run by the author.
- **The product's own research is a multi-agent system** — the Python agents in
  [`agents/aimerch/agents/`](agents/aimerch/agents/), run by the orchestrator in
  `agents/aimerch/pipeline/`, generate the dossiers, org charts, cited facts, and emails. Each
  agent calls Claude (Opus) via `agents/aimerch/llm.py`; they are also mirrored as Claude Code
  prompts in [`.claude/agents/`](.claude/agents/).

## Attribution

This is the author's own work — not a fork of a third-party project. It brings together two
codebases the author built earlier (an internal distributor CRM and the Python research
pipeline) into one system, then adds the cited-dossier / org-chart / Report surfaces, a curated
reproducible sample dataset, the AI Intelligence rebrand, and this documentation. Open-source
libraries used: React, Vite, Tailwind, shadcn/ui, TanStack Query, Express, drizzle-orm,
postgres-js (frontend/backend); FastAPI, the Anthropic SDK (agents).

## Limitations & next

- The agent pipeline runs as a separate Python service (FastAPI on DigitalOcean); the app
  currently consumes its committed output. Wiring the in-app "Research" button to launch a fresh
  end-to-end run from the UI is the next step.
- The demo dataset is intentionally trimmed to 5 rich companies.
- Next: reply handling on the outreach loop and automated split-testing of the emails.

## CS 153 rubric map

| Rubric area | Where |
|---|---|
| Problem & Insight (3) | This README, top — research gates outreach; one person + agents compresses it. |
| Execution & Technical (5) | Python agent pipeline (`agents/`) + full-stack app (`backend/` + `frontend/`). |
| Evaluation & Evidence (3) | Verbatim-quote citations, validator agents, tests, real seeded data. |
| Communication (2) | This README + demo video. |
| Process & Disclosure (2) | AI disclosure + attribution above; public repo; development artifacts (the agent pipeline, tests, and a reproducible sample dataset). |
