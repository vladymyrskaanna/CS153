# AI Intelligence — Research Pipeline (agents)

Personalized B2B research and email pipeline for beer/beverage distributors.

Take a company URL → produce in 5–8 minutes:
1. **Editorial HTML dossier** (founding moment, family tree, leadership, press, red flags)
2. **3+ role-specific emails** (CEO/CFO/VP Sales) with research-derived hooks
3. **Persistent dashboard** of every researched company

Built on the methodology in [`prompts/METHODOLOGY.md`](prompts/METHODOLOGY.md). All outputs are sourced — every fact in every email traces to a URL in `evidence.json`.

---

## Quick start

```bash
cd agents

# 1. Set up venv (one-time)
python3 -m venv .venv
.venv/bin/pip install -e .

# 2. Add credentials (DigitalOcean Gradient endpoint / Anthropic key)
cp .env.example .env        # then edit .env

# 3. Research a company end-to-end
.venv/bin/python -m aimerch.cli.main research https://saratogaeagle.com

# 4. Or run the FastAPI service that the app's backend worker calls
.venv/bin/uvicorn aimerch.api.server:app --port 7800
```

---

## CLI

```bash
# Research a company end-to-end
aimerch-research research <URL> [--hint "..."] [--roles ceo_owner,cfo_ops,vp_sales]

# List all companies in the DB
aimerch-research ls

# Show one company's people + emails
aimerch-research show <slug>
```

Outputs land at `dossiers/<slug>/`:

```
dossiers/saratoga_eagle_sales_service_inc/
├── dossier.html          ← editorial HTML, open in browser
├── research.md           ← structured research markdown
├── evidence.json         ← raw research data with source URLs
├── company.json          ← snapshot of company + people + flags
└── emails/
    ├── INDEX.md          ← list of generated emails
    ├── 01_ceo__jeff_vukelic.md
    ├── 02_cfo__abby_todd.md
    └── 03_vp_sales__christopher_dooling.md
```

---

## Pipeline phases

```
URL  →  DISCOVER  →  ENRICH  →  SYNTHESIZE  →  RENDER
       (90 sec)    (3-5 min)   (1-2 min)     (instant)

DISCOVER   — crawl site + sub-pages, extract company facts and people list
ENRICH     — deep web research: founding moment, family, press, red flags, LinkedIn
SYNTHESIZE — generate research.md + dossier.html + role-specific emails
RENDER     — write to dossiers/<slug>/, index in SQLite
```

The hook for every email comes from research evidence. Red flags (lawsuits, recent deaths, EEOC) automatically force a "safe mode" generic opener.

---

## Roles supported

| Role | Hook style | When to use |
|---|---|---|
| `ceo_owner` | Family-legacy ("What would [Ancestor] Do") | Family-owned distributor, no red flags |
| `cfo_ops` | Efficiency + ROI ("audit time cut 70%") | CFO / VP Operations / COO |
| `vp_sales` | Revenue + shelf execution | VP Sales, Sales Director |
| `director` | Career-momentum + visibility | Director-level (Marketing, IT, Cat Mgmt) |
| `heir` | Generational handoff | Next-gen heir |

`--roles` selects which to draft. Default: `ceo_owner,cfo_ops,vp_sales`.

---

## Claude integration

A Claude Code subagent (mirrored in this repo at `.claude/agents/distributor-researcher.md`) lets you run this from any CC session:

```
@distributor-researcher https://saratogaeagle.com
@distributor-researcher matesichbeer.com --roles ceo_owner,heir
```

---

## Configuration

Set in `.env`:

| Var | Default | Notes |
|---|---|---|
| `ANTHROPIC_API_KEY` | — | Required for prod. Falls back to `CLAUDE_CODE_OAUTH_TOKEN` in dev. |
| `MODEL_SYNTHESIZE` | `claude-opus-4-7` | Synthesis (dossier + emails). Use Haiku if rate-limited. |
| `MODEL_RESEARCH` | `claude-sonnet-4-6` | Research / enrichment with web search. |
| `MODEL_EXTRACT` | `claude-haiku-4-5-20251001` | Fast structured extraction. |
| `OPERATOR_NAME` | `Anna` | Email signature. |
| `OPERATOR_MOBILE` | `` | Email signature. |
| `OPERATOR_WEB` | `` | Email signature. |

---

## Dashboard

The repository's **`frontend/`** app (React, port 5181) is the dashboard — it reads the
researched dossiers from Postgres via the `backend/` API. See the root [README](../README.md)
for running it.

---

## Cost

Per dossier (estimate):

| Phase | Model | Cost |
|---|---|---|
| DISCOVER | Haiku 4.5 | $0.05–0.10 |
| ENRICH | Sonnet 4.6 (or Haiku) | $0.20–0.40 |
| SYNTHESIZE | Opus 4.7 (or Haiku) | $0.20–0.50 |
| **Total** | | **$0.40–$1.00** |

---

## Methodology

See [`prompts/METHODOLOGY.md`](prompts/METHODOLOGY.md) for the full playbook this pipeline encodes.

The four prompts (`prompts/01_research.md` through `prompts/04_ranking.md`) are the canonical references — `aimerch/pipeline/synthesize.py` is the code version of those prompts.
