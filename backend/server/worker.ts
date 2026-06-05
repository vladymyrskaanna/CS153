/**
 * Background worker — polls research.run for queued items, dispatches the
 * external research pipeline (DO Gradient + Tavily MCP, hosted at
 * the research API service), mirrors live progress into research.run, and
 * imports the resulting dossier into research.intel + research.person +
 * research.article + research.fact + research.red_flag.
 *
 * The actual LLM/web work is delegated to the research FastAPI on
 * `RESEARCH_API_BASE` (default http://localhost:7800). Each run
 * pays ~$2-3 of DO Gradient + Tavily and lasts ~8-12 minutes.
 */

import "dotenv/config";
import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is required");
const sql = postgres(url, { max: 2, idle_timeout: 20 });

const RESEARCH_API_BASE = (process.env.RESEARCH_API_BASE ?? "http://localhost:7800").replace(/\/$/, "");
const POLL_INTERVAL_MS = 4000;
const MAX_RUN_MINUTES = 25;

const PHASE_PCT: Record<string, number> = {
  queued: 0,
  discover: 15,
  articles: 30,
  facts: 45,
  validate_facts: 55,
  hooks: 65,
  emails: 80,
  enrich: 30,
  synthesize: 80,
  render: 95,
  done: 100,
  failed: 100,
};

type RunRow = { id: number; distributor_id: string | null; url: string };

type ResearchPerson = {
  id?: number;
  full_name: string;
  title: string | null;
  role_category: string | null;
  generation: number | null;
  is_decision_maker: boolean | null;
  is_deceased: boolean | null;
  death_year: number | null;
  linkedin_url: string | null;
  photo_url: string | null;
  email: string | null;
  phone: string | null;
  parent_id: number | null;
  spouse_id: number | null;
  parent_name: string | null;
  spouse_name: string | null;
  bio_short: string | null;
  key_facts_json: string[] | string | null;
  education_json?: Array<{ school: string; degree: string | null; year: number | null; source_url: string | null }> | string | null;
  career_summary?: string | null;
  related_article_urls?: string[] | string | null;
  extra_facts_json?: Array<{ type: string; fact: string; source_url: string | null }> | string | null;
};

type ResearchCompany = {
  slug: string;
  legal_name: string;
  dba: string | null;
  state: string | null;
  website: string | null;
  founded_year: number | null;
  employee_count: number | null;
  account_count: number | null;
  primary_supplier: string | null;
  brands_json: string | string[] | null;
  founding_moment: string | null;
  summary: string | null;
  red_flag_severity: string | null;
  score: number | null;
  tier: string | null;
  people: ResearchPerson[];
  red_flags: Array<{ flag_type: string; severity: string; description: string; source_url: string | null }>;
};

async function setPhase(runId: number, phase: string, pct?: number) {
  const p = pct ?? PHASE_PCT[phase] ?? 0;
  await sql`
    UPDATE research.run
    SET status = 'running', current_phase = ${phase}, progress_pct = ${p}, updated_at = now()
    WHERE id = ${runId}
  `;
}

async function fail(runId: number, error: string) {
  await sql`
    UPDATE research.run
    SET status = 'failed', current_phase = 'failed', progress_pct = 100,
        error = ${error.slice(0, 1000)}, completed_at = now(), updated_at = now()
    WHERE id = ${runId}
  `;
}

async function complete(
  runId: number,
  runtimeSec: number,
  stats?: {
    costUsd?: number | null;
    webSearches?: number | null;
    webSearchCostUsd?: number | null;
    llmCostUsd?: number | null;
    inputTokens?: number | null;
    outputTokens?: number | null;
  },
) {
  await sql`
    UPDATE research.run
    SET status = 'done', current_phase = 'done', progress_pct = 100,
        completed_at = now(), updated_at = now(), runtime_seconds = ${runtimeSec},
        cost_usd = ${stats?.costUsd ?? null},
        web_searches = ${stats?.webSearches ?? null},
        web_search_cost_usd = ${stats?.webSearchCostUsd ?? null},
        llm_cost_usd = ${stats?.llmCostUsd ?? null},
        input_tokens = ${stats?.inputTokens ?? null},
        output_tokens = ${stats?.outputTokens ?? null}
    WHERE id = ${runId}
  `;
}

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${RESEARCH_API_BASE}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init.headers ?? {}) },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`research ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json() as Promise<T>;
}

/** Build a hint string from existing people so the LLM uses canonical name
 * spellings on re-run (avoids creating "Simon J. Bergson" when we already
 * have "Simon Bergson") and preserves continuity of contact info.
 */
async function buildExistingPeopleHint(distributorId: string): Promise<string | null> {
  const rows = await sql<Array<{
    full_name: string; title: string | null; email: string | null; linkedin_url: string | null;
    role_category: string | null; generation: number | null; is_decision_maker: boolean;
    emails: string[] | null; phones: string[] | null; phone: string | null;
  }>>`
    SELECT full_name, title, email, linkedin_url, role_category, generation, is_decision_maker,
           emails, phones, phone
    FROM research.person
    WHERE distributor_id = ${distributorId}
    ORDER BY (CASE WHEN generation IS NULL THEN 99 ELSE generation END), full_name
    LIMIT 100
  `;
  if (rows.length === 0) return null;
  const lines = rows.map((r) => {
    const parts: string[] = [`- ${r.full_name}`];
    if (r.title) parts.push(`(${r.title})`);
    if (r.is_decision_maker) parts.push("[DM]");
    if (r.generation != null) parts.push(`gen ${r.generation}`);
    const allEmails = [r.email, ...(r.emails ?? [])].filter((e): e is string => !!e && e.trim().length > 0);
    if (allEmails.length > 0) parts.push(`<${[...new Set(allEmails)].join(", ")}>`);
    const allPhones = [r.phone, ...(r.phones ?? [])].filter((p): p is string => !!p && p.trim().length > 0);
    if (allPhones.length > 0) parts.push(`tel: ${[...new Set(allPhones)].join(", ")}`);
    if (r.linkedin_url) parts.push(`linkedin`);
    return parts.join(" ");
  });
  return [
    "EXISTING PEOPLE ON FILE — context for canonical names + contact info we already have:",
    "",
    ...lines,
    "",
    "Rules:",
    "1. **Canonical names**: if you find any of these people again, use the EXACT spelling from the list above. Don't shorten, expand initials, change case, or add suffixes. This lets the CRM merge instead of duplicating.",
    "2. **Find MORE people**: do NOT stop at this list. The list is incomplete on purpose. Your job is to BROADEN our coverage. Actively hunt for:",
    "   - Founders, owners, board members not in the list",
    "   - Family members (children, siblings, spouses of named people) — generational handoffs",
    "   - C-suite + VPs + Directors not yet captured",
    "   - Sales managers, ops managers, regional/branch heads",
    "   - Recently-joined execs (last 2 years — press releases, LinkedIn posts)",
    "3. **Output**: include EVERYONE you can verify, both the known names (canonical spelling) and every new person you discover. The CRM will UPSERT — existing rows merge, new rows insert. Coverage > precision.",
    "4. Don't drop anyone from the existing list if they're still at the company. If you can't confirm someone is still here, just don't mention them; we won't delete them either.",
  ].join("\n");
}

/** Kick off a run on the research pipeline + return the new run_id over there. */
async function enqueueResearch(targetUrl: string, hint: string | null = null): Promise<number> {
  const body: Record<string, unknown> = { url: targetUrl, force: true };
  if (hint) body.hint = hint;
  const payload = await api<{ run_id: number; url: string; status: string }>(
    "/api/research",
    { method: "POST", body: JSON.stringify(body) },
  );
  return payload.run_id;
}

async function pollResearch(remoteRunId: number, localRunId: number): Promise<{ slug: string; stats: ProdRunStats }> {
  const start = Date.now();
  while (true) {
    if (Date.now() - start > MAX_RUN_MINUTES * 60 * 1000) {
      throw new Error(`run exceeded ${MAX_RUN_MINUTES}-min budget`);
    }
    const run = await api<{
      id: number;
      status: string;
      current_phase: string;
      progress_pct: number;
      company_slug: string | null;
      error: string | null;
      cost_usd?: number | null;
      web_searches?: number | null;
      web_search_cost_usd?: number | null;
      llm_cost_usd?: number | null;
      input_tokens?: number | null;
      output_tokens?: number | null;
    }>(`/api/runs/${remoteRunId}`);

    // Mirror progress into our research.run row.
    if (run.status === "running" || run.status === "queued") {
      await setPhase(localRunId, run.current_phase || "running", run.progress_pct);
    }

    if (run.status === "done") {
      if (!run.company_slug) throw new Error("research run done but slug missing");
      return {
        slug: run.company_slug,
        stats: {
          costUsd: run.cost_usd ?? null,
          webSearches: run.web_searches ?? null,
          webSearchCostUsd: run.web_search_cost_usd ?? null,
          llmCostUsd: run.llm_cost_usd ?? null,
          inputTokens: run.input_tokens ?? null,
          outputTokens: run.output_tokens ?? null,
        },
      };
    }
    if (run.status === "failed") {
      throw new Error(run.error || "research run failed");
    }
    await delay(POLL_INTERVAL_MS);
  }
}

type ProdRunStats = {
  costUsd: number | null;
  webSearches: number | null;
  webSearchCostUsd: number | null;
  llmCostUsd: number | null;
  inputTokens: number | null;
  outputTokens: number | null;
};

async function fetchCompany(slug: string): Promise<ResearchCompany> {
  return api<ResearchCompany>(`/api/companies/${slug}`);
}

async function fetchArticles(slug: string): Promise<Array<Record<string, unknown>>> {
  try {
    return await api<Array<Record<string, unknown>>>(`/api/companies/${slug}/articles`);
  } catch {
    return [];
  }
}

async function fetchFacts(slug: string): Promise<Array<Record<string, unknown>>> {
  try {
    return await api<Array<Record<string, unknown>>>(`/api/companies/${slug}/facts`);
  } catch {
    return [];
  }
}

async function fetchEmails(slug: string): Promise<Array<Record<string, unknown>>> {
  try {
    return await api<Array<Record<string, unknown>>>(`/api/companies/${slug}/emails`);
  } catch {
    return [];
  }
}

/**
 * Map research dossier → research.* tables, keyed by distributor_id.
 * Wipe the previous research.* rows for this distributor first so re-runs
 * fully replace stale data.
 */
async function importDossier(
  distributorId: string,
  dossier: ResearchCompany,
  articles: Array<Record<string, unknown>>,
  facts: Array<Record<string, unknown>>,
  emails: Array<Record<string, unknown>>,
) {
  const brands = Array.isArray(dossier.brands_json)
    ? dossier.brands_json
    : typeof dossier.brands_json === "string"
      ? safeParseArray(dossier.brands_json)
      : [];

  // Wipe LLM artifacts (articles/facts/red_flags/emails). These are
  // recomputed every run and shouldn't be merged — that would cause stale
  // citations. PEOPLE are UPSERTed below to preserve manually-entered emails,
  // photos and human-edited approval state.
  await sql`DELETE FROM research.email WHERE distributor_id = ${distributorId}`;
  await sql`DELETE FROM research.red_flag WHERE distributor_id = ${distributorId}`;
  await sql`DELETE FROM research.fact WHERE distributor_id = ${distributorId}`;
  await sql`DELETE FROM research.article WHERE distributor_id = ${distributorId}`;

  // ─── intel ─────────────────────────────────────────────────────────────
  await sql`
    INSERT INTO research.intel (
      distributor_id, legal_name, dba, state, website, founded_year,
      employee_count, account_count, primary_supplier, brands_json,
      score, tier, red_flag_severity, founding_moment, summary
    ) VALUES (
      ${distributorId}, ${dossier.legal_name}, ${dossier.dba ?? null}, ${dossier.state ?? null},
      ${dossier.website ?? null}, ${dossier.founded_year ?? null},
      ${dossier.employee_count ?? null}, ${dossier.account_count ?? null},
      ${dossier.primary_supplier ?? null}, ${sql.json(brands)},
      ${dossier.score ?? null}, ${dossier.tier ?? null}, ${dossier.red_flag_severity ?? null},
      ${dossier.founding_moment ?? null}, ${dossier.summary ?? null}
    )
    ON CONFLICT (distributor_id) DO UPDATE SET
      legal_name = EXCLUDED.legal_name, dba = EXCLUDED.dba, state = EXCLUDED.state,
      website = EXCLUDED.website, founded_year = EXCLUDED.founded_year,
      employee_count = EXCLUDED.employee_count, account_count = EXCLUDED.account_count,
      primary_supplier = EXCLUDED.primary_supplier, brands_json = EXCLUDED.brands_json,
      score = EXCLUDED.score, tier = EXCLUDED.tier,
      red_flag_severity = EXCLUDED.red_flag_severity,
      founding_moment = EXCLUDED.founding_moment, summary = EXCLUDED.summary,
      updated_at = now()
  `;

  // ─── people (preserve parent/spouse via two-pass + name → id map) ─────
  const nameToId = new Map<string, number>();
  for (const p of dossier.people) {
    // Coerce: prod sometimes returns these JSONB columns as *strings* when
    // the upstream pipeline double-encoded. Parse defensively so we always
    // store native arrays in our JSONB columns.
    const keyFacts = coerceArr<string>(p.key_facts_json);
    const education = coerceArr<unknown>(p.education_json);
    const relatedUrls = coerceArr<string>(p.related_article_urls);
    const extraFacts = coerceArr<unknown>(p.extra_facts_json);

    // UPSERT semantics on (distributor_id, full_name):
    // - If row doesn't exist → INSERT all fields from dossier
    // - If row exists → only fill columns that are currently NULL/empty.
    //   Never overwrite human-entered values
    //   (email, linkedin_url, photo_url, photo carried from disco, title).
    //   ALWAYS refresh derived LLM data (bio, key_facts, education, career,
    //   related_articles, extra_facts) — those come fresh each run.
    const [row] = await sql`
      INSERT INTO research.person (
        distributor_id, full_name, title, role_category, generation,
        is_decision_maker, is_deceased, death_year,
        linkedin_url, photo_url, email, phone,
        parent_name, spouse_name, bio_short, key_facts_json,
        education_json, career_summary, related_article_urls, extra_facts_json
      ) VALUES (
        ${distributorId}, ${p.full_name}, ${p.title ?? null}, ${p.role_category ?? null},
        ${p.generation ?? null},
        ${!!p.is_decision_maker}, ${!!p.is_deceased}, ${p.death_year ?? null},
        ${p.linkedin_url ?? null}, ${p.photo_url ?? null}, ${p.email ?? null}, ${p.phone ?? null},
        ${p.parent_name ?? null}, ${p.spouse_name ?? null}, ${p.bio_short ?? null},
        ${sql.json(keyFacts)},
        ${sql.json(education)}, ${p.career_summary ?? null},
        ${sql.json(relatedUrls)},
        ${sql.json(extraFacts)}
      )
      ON CONFLICT (distributor_id, full_name) DO UPDATE SET
        -- Preserve human-entered contact info (only fill if existing was NULL/empty)
        email           = COALESCE(NULLIF(research.person.email, ''),        EXCLUDED.email),
        linkedin_url    = COALESCE(NULLIF(research.person.linkedin_url, ''), EXCLUDED.linkedin_url),
        phone           = COALESCE(NULLIF(research.person.phone, ''),        EXCLUDED.phone),
        photo_url       = COALESCE(NULLIF(research.person.photo_url, ''),    EXCLUDED.photo_url),
        title           = COALESCE(NULLIF(research.person.title, ''),        EXCLUDED.title),
        -- LLM-derived fields refresh every run (no user input here)
        role_category   = COALESCE(EXCLUDED.role_category, research.person.role_category),
        generation      = COALESCE(EXCLUDED.generation, research.person.generation),
        is_decision_maker = EXCLUDED.is_decision_maker OR research.person.is_decision_maker,
        is_deceased     = EXCLUDED.is_deceased OR research.person.is_deceased,
        death_year      = COALESCE(EXCLUDED.death_year, research.person.death_year),
        bio_short       = COALESCE(NULLIF(EXCLUDED.bio_short, ''), research.person.bio_short),
        key_facts_json  = EXCLUDED.key_facts_json,
        education_json  = EXCLUDED.education_json,
        career_summary  = COALESCE(NULLIF(EXCLUDED.career_summary, ''), research.person.career_summary),
        related_article_urls = EXCLUDED.related_article_urls,
        extra_facts_json     = EXCLUDED.extra_facts_json,
        parent_name     = COALESCE(EXCLUDED.parent_name, research.person.parent_name),
        spouse_name     = COALESCE(EXCLUDED.spouse_name, research.person.spouse_name)
      RETURNING id
    `;
    nameToId.set(normalizeName(p.full_name), row.id as number);
  }

  // Resolve parent_id / spouse_id from names. Guard against self-references
  // (LLM occasionally writes parent_name = self for Jr./Sr. cases when prompts
  // get confused).
  for (const p of dossier.people) {
    const myId = nameToId.get(normalizeName(p.full_name));
    if (!myId) continue;
    let parentId = p.parent_name ? nameToId.get(normalizeName(p.parent_name)) ?? null : null;
    let spouseId = p.spouse_name ? nameToId.get(normalizeName(p.spouse_name)) ?? null : null;
    if (parentId === myId) parentId = null;
    if (spouseId === myId) spouseId = null;
    if (parentId || spouseId) {
      await sql`
        UPDATE research.person SET parent_id = ${parentId}, spouse_id = ${spouseId}
        WHERE id = ${myId}
      `;
    }
  }

  // ─── red flags ─────────────────────────────────────────────────────────
  for (const rf of dossier.red_flags ?? []) {
    await sql`
      INSERT INTO research.red_flag (distributor_id, flag_type, severity, description, source_url)
      VALUES (${distributorId}, ${rf.flag_type}, ${rf.severity}, ${rf.description}, ${rf.source_url ?? null})
    `;
  }

  // ─── articles ──────────────────────────────────────────────────────────
  const articleIdMap = new Map<string, number>();
  for (const a of articles) {
    const externalId = (a.id as string | undefined) ?? null;
    const [row] = await sql`
      INSERT INTO research.article (
        distributor_id, url, title, outlet, publication_date, article_type,
        subject_person, snippet, key_quote, relevance
      ) VALUES (
        ${distributorId}, ${(a.url as string | null) ?? null}, ${(a.title as string | null) ?? null},
        ${(a.outlet as string | null) ?? null}, ${(a.publication_date as string | null) ?? null},
        ${(a.article_type as string | null) ?? null}, ${(a.subject_person as string | null) ?? null},
        ${(a.snippet as string | null) ?? null}, ${(a.key_quote as string | null) ?? null},
        ${(a.relevance as number | null) ?? null}
      )
      RETURNING id
    `;
    if (externalId) articleIdMap.set(externalId, row.id as number);
  }

  // ─── facts ─────────────────────────────────────────────────────────────
  for (const f of facts) {
    const articleExternalId = f.article_id as string | null | undefined;
    const articleDbId = articleExternalId ? articleIdMap.get(articleExternalId) ?? null : null;
    await sql`
      INSERT INTO research.fact (
        distributor_id, fact_type, subject, predicate, object, verbatim_quote,
        article_id, confidence, validated
      ) VALUES (
        ${distributorId}, ${(f.fact_type as string | null) ?? null},
        ${(f.subject as string | null) ?? null}, ${(f.predicate as string | null) ?? null},
        ${(f.object as string | null) ?? null}, ${(f.verbatim_quote as string | null) ?? null},
        ${articleDbId}, ${(f.confidence as number | null) ?? null},
        ${(f.validated as boolean | null) ?? true}
      )
    `;
  }

  // ─── emails ────────────────────────────────────────────────────────────
  // Snapshot subject/body into *_original columns on insert. Future edits
  // overwrite subject/body only — the originals stay frozen so the operator
  // can always pull up the LLM's first draft.
  for (const e of emails) {
    const subject = (e.subject as string | null) ?? null;
    const body = (e.body as string | null) ?? null;
    await sql`
      INSERT INTO research.email (
        distributor_id, role, to_name, to_email,
        subject, body, subject_original, body_original,
        sources_md, word_count, safe_mode, filename
      ) VALUES (
        ${distributorId}, ${(e.role as string | null) ?? null},
        ${(e.to_name as string | null) ?? null}, ${(e.to_email as string | null) ?? null},
        ${subject}, ${body}, ${subject}, ${body},
        ${(e.sources_md as string | null) ?? null},
        ${(e.word_count as number | null) ?? null},
        ${(e.safe_mode as boolean | null) ?? false},
        ${(e.filename as string | null) ?? null}
      )
    `;
  }
}

function safeParseArray(s: string): string[] {
  try {
    const v = JSON.parse(s);
    return Array.isArray(v) ? v.map(String) : [];
  } catch {
    return [];
  }
}

/** Defensive JSONB ingest — handles arrays, JSON-stringified arrays, null. */
function coerceArr<T>(v: unknown): T[] {
  if (Array.isArray(v)) return v as T[];
  if (typeof v === "string") {
    try {
      const parsed = JSON.parse(v);
      return Array.isArray(parsed) ? (parsed as T[]) : [];
    } catch { return []; }
  }
  return [];
}

/** Exact match with only whitespace + case normalized.
 * MUST NOT strip suffixes (Jr/Sr/III) or quoted nicknames — those distinguish
 * generations of the same family ("Jeffrey Vukelic" vs "Jeffrey Vukelic Jr.").
 * Our discover prompt instructs the LLM to use the EXACT full_name as
 * parent_name, so exact match is the right invariant.
 */
function normalizeName(name: string): string {
  return name.toLowerCase().replace(/\s+/g, " ").trim();
}

async function processOne(run: RunRow): Promise<void> {
  if (!run.distributor_id) {
    await fail(run.id, "distributor_id missing on run row");
    return;
  }
  const start = Date.now();
  try {
    await setPhase(run.id, "discover", 5);
    // Build a hint with existing canonical names so LLM uses same spellings
    // (no "Simon J. Bergson" duplicates of "Simon Bergson"), preserves contacts.
    const existingHint = await buildExistingPeopleHint(run.distributor_id);
    if (existingHint) {
      console.log(`[worker] passing existing-people hint to LLM (${existingHint.split("\n").length - 7} known names)`);
    }
    const remoteRunId = await enqueueResearch(run.url, existingHint);
    console.log(`[worker] dispatched research run #${remoteRunId} for distributor=${run.distributor_id}`);

    const { slug, stats } = await pollResearch(remoteRunId, run.id);
    console.log(`[worker] research run #${remoteRunId} done — slug=${slug}, importing…`);

    await setPhase(run.id, "render", 90);
    const [dossier, articles, facts, emails] = await Promise.all([
      fetchCompany(slug),
      fetchArticles(slug),
      fetchFacts(slug),
      fetchEmails(slug),
    ]);
    await importDossier(run.distributor_id, dossier, articles, facts, emails);

    await complete(run.id, (Date.now() - start) / 1000, stats);
  } catch (err) {
    console.error(`[worker] run ${run.id} failed`, err);
    await fail(run.id, err instanceof Error ? err.message : String(err));
  }
}

async function pickQueued(): Promise<RunRow | null> {
  const rows = await sql`
    SELECT id, distributor_id, url FROM research.run WHERE status = 'queued'
    ORDER BY started_at ASC LIMIT 1
  `;
  return (rows[0] as RunRow) ?? null;
}

/**
 * Stuck-run watchdog. A CRM run is "stuck" when:
 *   status IN ('queued','running') AND updated_at older than MAX_RUN_MINUTES.
 *
 * This catches scenarios where the worker crashed mid-run, the prod research-api
 * dropped the job, or we hit Yaroslava's "5% forever" symptom. Marks the row
 * `failed` with a clear error so the UI shows it (and Regenerate becomes usable).
 */
const STUCK_AFTER_MINUTES = MAX_RUN_MINUTES + 5; // give a small cushion past the natural timeout
async function reapStuckRuns() {
  // Build the error suffix in JS so the SQL has only typed params.
  // (Embedding ${num} inside a string concat in a sql`` template makes
  // postgres-js emit an un-cast $N which trips "indeterminate datatype".)
  const errSuffix = ` [watchdog] run stuck > ${STUCK_AFTER_MINUTES}min — marked failed by worker`;
  const reaped = await sql`
    UPDATE research.run
    SET status = 'failed', current_phase = 'failed', progress_pct = 100,
        completed_at = now(), updated_at = now(),
        error = COALESCE(error, '') || ${errSuffix}::text
    WHERE status IN ('queued','running')
      AND updated_at < now() - (${STUCK_AFTER_MINUTES}::int * INTERVAL '1 minute')
    RETURNING id
  `;
  if (reaped.length > 0) {
    console.log(`[worker] watchdog reaped ${reaped.length} stuck run(s): ${reaped.map((r) => r.id).join(", ")}`);
  }
}

let stopped = false;
async function loop() {
  let watchdogTick = 0;
  while (!stopped) {
    // Every ~30s (15 iterations of 2s idle), sweep for stuck runs.
    watchdogTick++;
    if (watchdogTick >= 15) {
      watchdogTick = 0;
      try { await reapStuckRuns(); } catch (e) { console.warn("[worker] watchdog error", e); }
    }
    const run = await pickQueued();
    if (!run) {
      await delay(2000);
      continue;
    }
    console.log(`[worker] processing local run ${run.id} url=${run.url} dist=${run.distributor_id ?? "(none)"}`);
    await processOne(run);
    console.log(`[worker] local run ${run.id} completed`);
  }
}

process.on("SIGTERM", () => { stopped = true; });
process.on("SIGINT", () => { stopped = true; });

loop().catch((e) => {
  console.error("[worker] fatal", e);
  process.exit(1);
});

console.log(`[worker] started — polling research.run every 2s, dispatching to ${RESEARCH_API_BASE}`);
export {};
