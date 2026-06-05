/**
 * Distributor "Company Dossier" report.
 *
 * GET /api/distributors/:id/report.html — a self-contained, editorial-style HTML
 * dossier. For the seeded distributors it renders a deeply-researched fixture
 * (full chronology, generational leadership, sources). For any other (e.g. a
 * distributor created via the URL → AI flow) it falls back to rendering whatever
 * research data exists in the DB. Opens in a tab; prints cleanly to PDF.
 */
import { Router } from "express";
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";
import { requireAuth } from "./auth";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is required");
const sql = postgres(url, { max: 3, idle_timeout: 20 });

export const reportRouter = Router();
reportRouter.use(requireAuth);

const DATA_DIR = join(dirname(fileURLToPath(import.meta.url)), "report-data");

// Seeded distributor id → deeply-researched fixture slug.
const ID_TO_SLUG: Record<string, string> = {
  "99fd34ba-42fc-4c5d-89d6-cbf3926e013f": "doll",
  "527c6236-4192-4b05-8715-3d11a0942b6d": "gulf",
  "be559c7b-c719-4812-a69c-a5ccbfb0ece0": "saratoga",
  "f9a78f4a-c9e8-439b-9d26-13a407aec584": "manhattan",
  "687fa905-ed54-4dcb-94a7-e782c839f030": "empire",
};

function esc(v: unknown): string {
  if (v == null) return "";
  return String(v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
const yearOf = (d: unknown): string => { const m = String(d ?? "").match(/\d{4}/); return m ? m[0] : ""; };
const liSvg = `<svg viewBox="0 0 24 24" fill="currentColor" style="width:11px;height:11px"><path d="M20.5 2h-17A1.5 1.5 0 002 3.5v17A1.5 1.5 0 003.5 22h17a1.5 1.5 0 001.5-1.5v-17A1.5 1.5 0 0020.5 2zM8 19H5v-9h3zM6.5 8.25A1.75 1.75 0 118.3 6.5a1.78 1.78 0 01-1.8 1.75zM19 19h-3v-4.74c0-1.42-.6-1.93-1.38-1.93A1.74 1.74 0 0013 14.19a.66.66 0 000 .14V19h-3v-9h2.9v1.3a3.11 3.11 0 012.7-1.4c1.55 0 3.36.86 3.36 3.66z"/></svg>`;

const STYLE = `
:root{--bg:#f4ede0;--ink:#1a1410;--ink-soft:#3a322a;--paper:#fbf6ec;--copper:#a05a2c;--copper-deep:#7a3f17;--olive-deep:#2d2d18;--gold:#c89a3e;--rule:#8a7a5e;--line:rgba(26,20,16,.18)}
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Newsreader',Georgia,serif;background:var(--bg);color:var(--ink);font-size:18px;line-height:1.65;background-image:radial-gradient(ellipse at 20% 10%,rgba(200,154,62,.08),transparent 50%),radial-gradient(ellipse at 80% 90%,rgba(160,90,44,.06),transparent 50%)}
.wrap{max-width:1180px;margin:0 auto;padding:0 48px}
.masthead{border-bottom:3px double var(--ink);padding:36px 0 24px}
.masthead-top,.masthead-bottom{display:flex;justify-content:space-between;align-items:baseline;font-family:'JetBrains Mono',monospace;font-size:11px;letter-spacing:.2em;text-transform:uppercase;color:var(--ink-soft);gap:16px;flex-wrap:wrap}
.masthead-top{margin-bottom:18px}.masthead-bottom{margin-top:16px}
.masthead-top .dot{display:inline-block;width:6px;height:6px;background:var(--copper);border-radius:50%;margin-right:8px}
.masthead-title{font-family:'Fraunces',serif;font-weight:900;font-size:clamp(44px,8.5vw,138px);line-height:.9;letter-spacing:-.04em;color:var(--ink);text-transform:uppercase;overflow-wrap:break-word;hyphens:auto}
.lede{display:grid;grid-template-columns:1fr 2fr;gap:56px;padding:56px 0 72px;border-bottom:1px solid var(--line)}
.lede-meta{font-family:'JetBrains Mono',monospace;font-size:11px;letter-spacing:.15em;text-transform:uppercase;color:var(--copper-deep);border-top:2px solid var(--copper-deep);padding-top:16px}
.lede-meta dt{font-weight:500;opacity:.6;margin-top:14px;font-size:10px}
.lede-meta dd{font-size:13px;margin-top:2px;color:var(--ink);font-family:'Newsreader',serif;font-weight:500;letter-spacing:0;text-transform:none}
.lede-text{font-family:'Fraunces',serif;font-size:clamp(20px,2.2vw,30px);line-height:1.35;font-weight:300;letter-spacing:-.01em}
.lede-text .drop{font-size:1.5em;font-style:italic;color:var(--copper-deep);font-weight:400}
.facts{display:grid;grid-template-columns:repeat(4,1fr);border-top:1px solid var(--line);border-bottom:1px solid var(--line)}
.fact{padding:32px 24px;border-right:1px solid var(--line)}.fact:last-child{border-right:none}
.fact-num{font-family:'Fraunces',serif;font-weight:600;font-size:46px;letter-spacing:-.03em;color:var(--copper-deep);line-height:1}
.fact-num small{font-size:18px;vertical-align:super;opacity:.6;margin-left:2px}
.fact-label{font-family:'JetBrains Mono',monospace;font-size:10px;letter-spacing:.2em;text-transform:uppercase;color:var(--ink-soft);margin-top:10px;line-height:1.4}
.section{padding:72px 0;border-bottom:1px solid var(--line)}
.section-num{font-family:'JetBrains Mono',monospace;font-size:11px;letter-spacing:.2em;text-transform:uppercase;color:var(--copper-deep);margin-bottom:12px;display:flex;align-items:center;gap:12px}
.section-num::before{content:'';width:32px;height:1px;background:var(--copper-deep)}
.section-title{font-family:'Fraunces',serif;font-weight:700;font-size:clamp(34px,5vw,68px);line-height:.95;letter-spacing:-.025em;margin-bottom:36px}
.section-title em{font-style:italic;font-weight:400;color:var(--olive-deep)}
.timeline{position:relative;margin-top:24px}
.timeline::before{content:'';position:absolute;left:96px;top:12px;bottom:12px;width:1px;background:linear-gradient(to bottom,var(--copper),var(--copper-deep))}
.epoch{display:grid;grid-template-columns:96px 1fr;gap:48px;padding:24px 0;position:relative}
.epoch::before{content:'';position:absolute;left:92px;top:34px;width:9px;height:9px;background:var(--bg);border:2px solid var(--copper-deep);border-radius:50%}
.epoch-year{font-family:'Fraunces',serif;font-weight:700;font-size:24px;color:var(--copper-deep);text-align:right;padding-top:4px}
.epoch-body h3{font-family:'Fraunces',serif;font-weight:600;font-size:21px;margin-bottom:6px}
.epoch-body p{color:var(--ink-soft);font-size:16px}
.gen-label{font-family:'JetBrains Mono',monospace;font-size:10px;letter-spacing:.22em;text-transform:uppercase;color:var(--copper-deep);margin:34px 0 16px;display:flex;align-items:center;gap:16px}
.gen-label::before,.gen-label::after{content:'';flex:1;height:1px;background:var(--copper-deep);opacity:.4}
.tree-intro{font-family:'Fraunces',serif;font-style:italic;font-size:20px;font-weight:300;color:var(--ink-soft);max-width:680px;margin:8px 0 24px}
.gen-row{display:flex;flex-wrap:wrap;gap:24px;margin-bottom:8px}
.person-card{background:var(--paper);border:1px solid var(--line);padding:22px 24px;width:300px;box-shadow:0 1px 0 rgba(26,20,16,.04)}
.person-card.founder{background:linear-gradient(135deg,#2d2d18,#1a1410);color:var(--paper)}
.person-card.ceo{background:linear-gradient(135deg,#7a3f17,#a05a2c);color:var(--paper)}
.person-card.founder .role,.person-card.ceo .role{color:var(--gold)}
.person-card.founder .meta,.person-card.ceo .meta{color:rgba(251,246,236,.75)}
.role{font-family:'JetBrains Mono',monospace;font-size:9px;letter-spacing:.22em;text-transform:uppercase;color:var(--copper-deep);margin-bottom:10px;font-weight:500}
.name{font-family:'Fraunces',serif;font-weight:600;font-size:21px;letter-spacing:-.015em;line-height:1.15;margin-bottom:6px}
.meta{font-size:13px;color:var(--ink-soft);line-height:1.45;margin-bottom:14px}
.li-link{display:inline-flex;align-items:center;gap:6px;font-family:'JetBrains Mono',monospace;font-size:10px;letter-spacing:.15em;text-transform:uppercase;color:var(--copper-deep);text-decoration:none;padding:5px 10px;border:1px solid var(--line)}
.person-card.founder .li-link,.person-card.ceo .li-link{color:var(--gold);border-color:rgba(200,154,62,.4)}
.li-link.disabled{opacity:.45;pointer-events:none}
.news-item{display:grid;grid-template-columns:130px 1fr;gap:32px;padding:22px 0;border-bottom:1px solid var(--line)}
.news-date{font-family:'JetBrains Mono',monospace;font-size:12px;letter-spacing:.08em;color:var(--copper-deep);padding-top:4px}
.news-item h3{font-family:'Fraunces',serif;font-weight:600;font-size:20px;margin-bottom:6px;letter-spacing:-.01em}
.news-item p{color:var(--ink-soft);font-size:15px;margin-bottom:8px}
.news-item .src{font-family:'JetBrains Mono',monospace;font-size:10px;letter-spacing:.15em;text-transform:uppercase;color:var(--copper-deep);text-decoration:none;border-bottom:1px dotted var(--copper-deep)}
.subhead{font-family:'JetBrains Mono',monospace;font-size:10px;letter-spacing:.22em;text-transform:uppercase;color:var(--copper-deep);margin:28px 0 14px}
.tags{display:flex;flex-wrap:wrap;gap:10px}
.tag{font-family:'JetBrains Mono',monospace;font-size:11px;letter-spacing:.04em;background:var(--paper);border:1px solid var(--line);padding:7px 13px;color:var(--ink-soft)}
.tag.supplier{border-color:var(--copper-deep);color:var(--copper-deep);font-weight:500}
.pullquote{margin:56px auto;max-width:820px;text-align:center;font-family:'Fraunces',serif;font-style:italic;font-weight:300;font-size:clamp(22px,3vw,34px);line-height:1.35;color:var(--olive-deep);padding:32px 24px;position:relative}
.pullquote::before{content:'\\201C';font-family:'Fraunces',serif;font-size:120px;position:absolute;top:-10px;left:50%;transform:translateX(-50%);color:var(--copper);opacity:.25;line-height:1}
.pullquote cite{display:block;margin-top:20px;font-size:12px;font-family:'JetBrains Mono',monospace;font-style:normal;letter-spacing:.2em;text-transform:uppercase;color:var(--copper-deep)}
.colophon{padding:48px 0 96px;border-top:3px double var(--ink);margin-top:48px}
.colophon-grid{display:grid;grid-template-columns:2fr 1fr 1fr;gap:48px}
.colophon h4{font-family:'JetBrains Mono',monospace;font-size:10px;letter-spacing:.25em;text-transform:uppercase;color:var(--copper-deep);margin-bottom:14px}
.colophon p,.colophon li{font-size:13px;color:var(--ink-soft);line-height:1.6}
.colophon ul{list-style:none}
.colophon a{color:var(--copper-deep);text-decoration:none;border-bottom:1px dotted var(--copper-deep)}
.pdf-btn{position:fixed;right:24px;bottom:24px;z-index:50;font-family:'JetBrains Mono',monospace;font-size:12px;letter-spacing:.1em;text-transform:uppercase;background:var(--copper-deep);color:var(--paper);border:none;padding:14px 20px;border-radius:6px;cursor:pointer;box-shadow:0 8px 24px rgba(26,20,16,.25)}
.pdf-btn:hover{background:var(--ink)}
@media (max-width:900px){.wrap{padding:0 24px}.lede{grid-template-columns:1fr;gap:32px}.facts{grid-template-columns:repeat(2,1fr)}.fact{border-bottom:1px solid var(--line)}.timeline::before{left:60px}.epoch{grid-template-columns:60px 1fr;gap:24px}.epoch::before{left:56px}.colophon-grid{grid-template-columns:1fr}.person-card{width:100%}}
@media print{.pdf-btn{display:none}body{background:#fff}.section,.lede,.epoch,.person-card,.pullquote{break-inside:avoid}}
`;

function shell(title: string, body: string): string {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(title)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,300;9..144,400;9..144,600;9..144,700;9..144,900&family=Newsreader:ital,wght@0,300;0,400;0,500;0,600;1,400&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
<style>${STYLE}</style></head><body>
<button class="pdf-btn" onclick="window.print()">⤓ Download PDF</button>
<div class="wrap">${body}</div></body></html>`;
}

// ---------- Rich fixture renderer (AlaBev-quality) ----------
interface Person { role: string; name: string; meta?: string; linkedin?: string; kind?: string }
interface Fixture {
  name: string; tagline?: string; location?: string; foundedYear?: number | null;
  lede: { legalName?: string; founded?: string; hq?: string; industry?: string; coverage?: string; size?: string; narrative?: string };
  facts: Array<{ num: string; sup?: string; label: string }>;
  timeline: Array<{ year: string; title: string; body: string }>;
  news?: Array<{ date?: string; headline: string; summary?: string; source?: string; url?: string }>;
  brands?: { suppliers?: string[]; highlights?: string[] };
  facilities?: Array<{ name: string; location?: string; note?: string }>;
  pullQuotes?: Array<{ text: string; cite: string }>;
  leadership: { generations: Array<{ label: string; people: Person[] }>; executives?: Person[] };
  flags?: Array<{ type?: string; severity?: string; description?: string; source?: string }>;
  sources?: Array<{ label: string; url: string }>;
}

function personCard(p: Person): string {
  const cls = p.kind === "founder" ? "person-card founder" : p.kind === "ceo" ? "person-card ceo" : "person-card";
  const link = p.linkedin
    ? `<a class="li-link" href="${esc(p.linkedin)}" target="_blank" rel="noopener">${liSvg} View LinkedIn</a>`
    : `<a class="li-link disabled">No public profile</a>`;
  return `<div class="${cls}"><div class="role">${esc(p.role)}</div><div class="name">${esc(p.name)}</div>${p.meta ? `<div class="meta">${esc(p.meta)}</div>` : ""}${link}</div>`;
}

function renderRich(d: Fixture): string {
  const peopleCount = d.leadership.generations.reduce((n, g) => n + g.people.length, 0) + (d.leadership.executives?.length ?? 0);
  const narrative = d.lede.narrative ?? "";
  const drop = narrative.trim().charAt(0) || "—";
  const rest = narrative.trim().slice(1);

  const meta = [
    d.lede.legalName && ["Legal name", d.lede.legalName],
    d.lede.founded && ["Founded", d.lede.founded],
    d.lede.hq && ["Headquarters", d.lede.hq],
    d.lede.industry && ["Industry", d.lede.industry],
    d.lede.coverage && ["Coverage", d.lede.coverage],
    d.lede.size && ["Scale", d.lede.size],
  ].filter(Boolean).map((m) => `<dt>${esc((m as string[])[0])}</dt><dd>${esc((m as string[])[1])}</dd>`).join("");

  const facts = d.facts.slice(0, 4).map((f) =>
    `<div class="fact"><div class="fact-num">${esc(f.num)}${f.sup ? `<small>${esc(f.sup)}</small>` : ""}</div><div class="fact-label">${esc(f.label)}</div></div>`).join("");

  const timeline = d.timeline.map((e) =>
    `<div class="epoch"><div class="epoch-year">${esc(e.year)}</div><div class="epoch-body"><h3>${esc(e.title)}</h3><p>${esc(e.body)}</p></div></div>`).join("");

  const pulls = (d.pullQuotes ?? []).map((q) => `<div class="pullquote">${esc(q.text)}<cite>— ${esc(q.cite)}</cite></div>`);

  const generations = d.leadership.generations.map((g) =>
    `<div class="gen-label">${esc(g.label)}</div><div class="gen-row">${g.people.map(personCard).join("")}</div>`).join("");

  const news = d.news?.length
    ? `<section class="section"><div class="section-num">§ II — In the news</div><h2 class="section-title">Lately, <em>on the record.</em></h2>${d.news.map((n) => `<div class="news-item"><div class="news-date">${esc(n.date ?? "")}</div><div><h3>${esc(n.headline)}</h3>${n.summary ? `<p>${esc(n.summary)}</p>` : ""}${n.url ? `<a class="src" href="${esc(n.url)}" target="_blank" rel="noopener">${esc(n.source ?? "Source")} →</a>` : (n.source ? `<span class="src">${esc(n.source)}</span>` : "")}</div></div>`).join("")}</section>`
    : "";

  const execs = d.leadership.executives?.length
    ? `<section class="section"><div class="section-num">§ IV — Beyond the family</div><h2 class="section-title">Key <em>executives.</em></h2><div class="gen-row">${d.leadership.executives.map(personCard).join("")}</div></section>`
    : "";

  const brands = (d.brands && ((d.brands.suppliers?.length ?? 0) + (d.brands.highlights?.length ?? 0) > 0))
    ? `<section class="section"><div class="section-num">§ V — Portfolio</div><h2 class="section-title">What they <em>carry.</em></h2>${d.brands.suppliers?.length ? `<div class="subhead">Supplier relationships</div><div class="tags">${d.brands.suppliers.map((s) => `<span class="tag supplier">${esc(s)}</span>`).join("")}</div>` : ""}${d.brands.highlights?.length ? `<div class="subhead">Brands & categories</div><div class="tags">${d.brands.highlights.map((s) => `<span class="tag">${esc(s)}</span>`).join("")}</div>` : ""}</section>`
    : "";

  const facilities = d.facilities?.length
    ? `<section class="section"><div class="section-num">§ VI — Footprint</div><h2 class="section-title">Facilities &amp; <em>territory.</em></h2><div class="gen-row">${d.facilities.map((f) => `<div class="person-card"><div class="role">${esc(f.location ?? "")}</div><div class="name">${esc(f.name)}</div>${f.note ? `<div class="meta">${esc(f.note)}</div>` : ""}</div>`).join("")}</div></section>`
    : "";

  const flags = d.flags?.length
    ? `<section class="section"><div class="section-num">§ VII — Diligence</div><h2 class="section-title">Risk <em>flags.</em></h2><div class="gen-row">${d.flags.map((f) => `<div class="person-card"><div class="role">${esc(f.type)} · ${esc(f.severity)}</div><div class="meta">${esc(f.description)}</div>${f.source ? `<a class="li-link" href="${esc(f.source)}" target="_blank" rel="noopener">Source →</a>` : ""}</div>`).join("")}</div></section>`
    : "";

  const sources = (d.sources ?? []).map((s) => `<li><a href="${esc(s.url)}" target="_blank">${esc(s.label)}</a></li>`).join("");

  const body = `
  <header class="masthead">
    <div class="masthead-top"><span><span class="dot"></span>Company Dossier</span><span>${esc(d.location ?? "")}${d.foundedYear ? ` · Est. ${esc(d.foundedYear)}` : ""}</span></div>
    <h1 class="masthead-title">${esc(d.name)}</h1>
    <div class="masthead-bottom"><span>${esc(d.tagline ?? "")}</span><span>${peopleCount} people mapped · ${d.timeline.length} milestones</span></div>
  </header>
  <section class="lede">
    <dl class="lede-meta">${meta}</dl>
    <div class="lede-text">${narrative ? `<span class="drop">${esc(drop)}</span>${esc(rest)}` : ""}</div>
  </section>
  <div class="facts">${facts}</div>
  ${pulls[0] ?? ""}
  <section class="section"><div class="section-num">§ I — Chronology</div><h2 class="section-title">The <em>record.</em></h2><div class="timeline">${timeline}</div></section>
  ${news}
  ${pulls[1] ?? ""}
  <section class="section"><div class="section-num">§ III — Chain of command</div><h2 class="section-title">Founders, owners, <em>successors.</em></h2>${generations}</section>
  ${execs}
  ${brands}
  ${facilities}
  ${flags}
  <footer class="colophon"><div class="colophon-grid">
    <div><h4>About this dossier</h4><p>Compiled by AI Intelligence from public-record research on ${esc(d.name)} — founding history, generational ownership, leadership, diligence flags and sources — for outreach and partnership research. ${esc(d.tagline ?? "")}</p></div>
    <div><h4>Primary sources</h4><ul>${sources || "<li>Web research</li>"}</ul></div>
    <div><h4>Generations</h4><ul>${d.leadership.generations.map((g) => `<li>${esc(g.label)} — ${g.people.length}</li>`).join("")}</ul></div>
  </div></footer>`;
  return shell(`${d.name} — Company Dossier`, body);
}

// ---------- DB fallback (for AI-created distributors) ----------
async function renderFromDb(id: string, groupName: string): Promise<string> {
  const [intel] = await sql<Array<{ legal_name: string | null; founded_year: number | null; employee_count: string | null; state: string | null; website: string | null; summary: string | null; founding_moment: string | null; tier: string | null; score: number | null }>>`
    SELECT legal_name, founded_year, employee_count, state, website, summary, founding_moment, tier, score FROM research.intel WHERE distributor_id = ${id} LIMIT 1`;
  if (!intel) {
    return shell(`${groupName} — not yet researched`, `<section class="lede" style="grid-template-columns:1fr"><div class="lede-text"><span class="drop">${esc(groupName.charAt(0))}</span>${esc(groupName.slice(1))} has no research dossier yet. Run AI research on this distributor — the report fills in automatically once the dossier is generated.</div></section>`);
  }
  const people = await sql<Array<{ full_name: string; title: string | null; role_category: string | null; is_decision_maker: boolean; linkedin_url: string | null; bio_short: string | null }>>`
    SELECT full_name, title, role_category, is_decision_maker, linkedin_url, bio_short FROM research.person WHERE distributor_id = ${id} ORDER BY is_decision_maker DESC, full_name`;
  const articles = await sql<Array<{ url: string; title: string | null; outlet: string | null; publication_date: string | null; snippet: string | null }>>`
    SELECT url, title, outlet, publication_date, snippet FROM research.article WHERE distributor_id = ${id} ORDER BY publication_date DESC NULLS LAST`;
  const fixture: Fixture = {
    name: groupName,
    tagline: "AI research dossier",
    location: intel.state ?? "",
    foundedYear: intel.founded_year,
    lede: { legalName: intel.legal_name ?? undefined, founded: intel.founded_year ? String(intel.founded_year) : undefined, hq: intel.state ?? undefined, size: intel.employee_count != null ? String(intel.employee_count) : undefined, narrative: intel.summary ?? intel.founding_moment ?? "" },
    facts: [
      { num: intel.founded_year ? String(intel.founded_year) : "—", label: "Year founded" },
      { num: intel.employee_count != null ? String(intel.employee_count) : "—", label: "Employees" },
      { num: String(people.length), label: "People mapped" },
      { num: String(articles.length), label: "Sources" },
    ],
    timeline: articles.map((a) => ({ year: yearOf(a.publication_date) || "—", title: a.title || a.outlet || "Source", body: a.snippet || "" })),
    leadership: {
      generations: [{ label: "Org chart", people: people.map((p) => ({ role: p.title || p.role_category || "Team", name: p.full_name, meta: p.bio_short ?? undefined, linkedin: p.linkedin_url ?? undefined, kind: p.is_decision_maker ? "ceo" : "" })) }],
    },
    sources: articles.slice(0, 12).map((a) => ({ label: a.title || a.outlet || a.url, url: a.url })),
  };
  return renderRich(fixture);
}

reportRouter.get("/distributors/:id/report.html", async (req, res) => {
  const id = req.params.id;
  const [group] = await sql<Array<{ name: string }>>`SELECT name FROM distributor."DistributorGroup" WHERE id = ${id} LIMIT 1`;
  if (!group) return res.status(404).send("Not found");

  const slug = ID_TO_SLUG[id];
  if (slug) {
    const file = join(DATA_DIR, `${slug}.json`);
    if (existsSync(file)) {
      const fixture = JSON.parse(readFileSync(file, "utf8")) as Fixture;
      return res.type("html").send(renderRich(fixture));
    }
  }
  return res.type("html").send(await renderFromDb(id, group.name));
});
