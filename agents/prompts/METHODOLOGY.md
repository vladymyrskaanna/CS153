# METHODOLOGY — The Complete Playbook

How to go from "I have a list of US beer distributors" to "I have personalized outreach emails and approved meeting requests."

---

## Phase 0 — Intake and Prioritization

**Input:** A list or directory of distributors. The NBWA directory (`data/nbwa_source_directory.xlsx`) is the canonical source for non-AB/InBev houses.

**Output:** A scored ranking (0-10) showing which distributors to approach first.

### Scoring rubric

| Score | Tier | Criteria | Example |
|-------|------|----------|---------|
| 10 | Mega | National/multi-state giant, billions in revenue | Reyes Beverage Group, Ben E. Keith |
| 9 | Very Large | $500M+ revenue, multi-region | The Odom Corporation, Capital Reyes |
| 8 | Large | 4+ locations, 40+ brands, regional leader | Crescent Crown, Heidelberg, Andrews |
| 7 | Large-medium | 5+ locations OR 50+ brands | Alliance Beverage, Admiral, Decrescente |
| 6 | Medium | 3-4 locations, 30+ brands | AlaBev, Valley Wide, Kozol Bros |
| 5 | Medium-small | 3+ locations, diverse brands | Standard Beverage, Premier Glazer's |
| 4 | Small | 2 locations OR 40+ brands single-loc | Wright Beverage, Crown Distributors |
| 3 | Very small | Single location, 20-40 brands | Most regional shops |
| 2 | Micro | Single location, 10-20 brands | Local / county-level |
| 1 | Tiny | Single location, <10 brands | Likely not worth personalized outreach |

### Manual overrides

The raw "locations count" alone undercounts single-warehouse giants like DeCrescente (NY — 57 brands, 1 location, but a huge regional player). Maintain a manual override table of known mega-distributors. See the Python script in `prompts/04_priority_ranking_prompt.md`.

### What determines outreach effort

- **Tier A (9-10):** Full research dossier, hand-written email, direct personal reference
- **Tier B (7-8):** Light research dossier, templated email with 2-3 personal details
- **Tier C (5-6):** Skip dossier, run template with name substitution + one specific detail
- **Tier D (3-4):** Instantly.ai bulk automation with minimal personalization
- **Tier E (1-2):** Skip entirely unless you have a specific reason

---

## Phase 1 — Research a Single Distributor

**Input:** Company name, state, and any starter info (website, key people).

**Output:** A structured research file covering family tree, company history, media trail, and outreach notes.

### Research sequence

1. **Company origin check.** Search "[Company Name] history family founded" and pull from the company's own "About" page if accessible (often age-gated — check Indeed, ZoomInfo, or CompanyTrue which mirror the text).

2. **Find the founding moment.** Every family-owned distributor has one vivid origin — a phone call, a handshake, a war story, a return from service. This is your hook. Sources:
   - Company "About" page (usually age-gated; mirrored on Indeed/ZoomInfo)
   - Local newspaper archives (Herald-News, Newark Advocate, etc.)
   - Obituaries of founders and their brothers/spouses
   - NBWA Chairman press releases (Brewbound, Cheers, Bar Business Magazine)

3. **Build the family tree.** Identify:
   - Generation 0 (immigrant ancestors, if applicable)
   - Generation 1 (founders)
   - Generation 2 (transition — often missing in public record)
   - Generation 3 (current elders / past presidents)
   - Generation 4 (current operator / future)
   - Generation 5 (heirs, often children still in school)

4. **Map current leadership.** CEO, President, COO, CFO — cross-reference with:
   - LinkedIn (search by name + company)
   - BBB business profile (confirms officers + accreditation date)
   - ZoomInfo / RocketReach (emails, though often behind paywall)
   - Local Chamber of Commerce listings (phone + address confirmation)

5. **Mine the media trail.** Search:
   - NBWA press releases (chairman elections, panel appointments, BREW forum)
   - State association (WBWAO, MLBA, TX Beverage Assoc, etc.)
   - ABC News, local TV, Columbus Business First, Crain's Cleveland, etc.
   - Senate/House committee testimony (Ohio, California, etc.)
   - Podcasts — Beer Business Daily, Brewbound Live, industry shows

6. **Red flags to surface before writing anything.** In rough order of severity:
   - Active lawsuits (state court records, often public)
   - Recent deaths in the family (< 12 months)
   - EEOC settlements (publicly searchable via EEOC.gov)
   - Estrangement signals (siblings with different last names across filings)
   - Political donation patterns (OpenSecrets, TransparencyUSA) — relevant tonally

### Time budget per dossier

- Tier A: 90-120 minutes of research
- Tier B: 45-60 minutes
- Tier C: 20-30 minutes
- Tier D: 5 minutes (scrape LinkedIn + name substitution)

---

## Phase 2 — Build the HTML Dossier

**Input:** All research from Phase 1.

**Output:** A single-file HTML document, magazine-editorial in style, that serves as both (a) internal reference before writing the email, and (b) shareable internal artifact for team context.

### Design tokens

- **Typography:** Fraunces (display + accents), Newsreader (body), JetBrains Mono (labels and metadata)
- **Layout:** Max-width 900px, generous margins, paper-texture background
- **Palette:** Pick 3 colors that evoke the company's heritage — copper/cream for Alabama, pine/lake for Michigan, terracotta/vineyard for California, burgundy/gold for Ohio, steel/brass for Illinois industrial-heritage towns

### Required sections (in order)

1. **Masthead** — Dossier number, company name, tagline, founding year, HQ
2. **Highlight banner** — Green for ideal targets, red/orange for cautions
3. **I · Origin** — The founding story in prose, 3-4 paragraphs
4. **II · Chronology** — Timeline with milestone markers, dates, and events
5. **III · Family Tree** — Person cards grouped by generation
6. **IV · Leadership (current)** — Who holds which title today
7. **V · Media Trail** — Selected press appearances with dates
8. **VI · Business Snapshot** — 2-column data grid with key business facts
9. **VII · Outreach Strategy** — Tactical advice in an ink-on-burgundy recommendation box
10. **Colophon** — Typography notes, sources with hyperlinks, research notes

See `prompts/02_dossier_html_prompt.md` for the full production prompt with all styling code.

### Quality bar

The dossier should be readable as a standalone artifact — someone on your team who has never heard of the target should be able to open the HTML, read for 5 minutes, and know how to write a competent email. If it fails that test, it's incomplete.

---

## Phase 3 — Write the Cold Email

**Input:** The dossier.

**Output:** A 200-400 word email in the structure described in the main README.

### Opening hook — the single most important sentence

The opening must name a specific, vivid detail from the target's family history. Generic openings ("Your family has built a remarkable legacy") are weak. Strong openings pull a concrete moment:

- **Good (Sarah Matesich):** "Your great-grandfather John founded the company after hearing an ad for Prima Near Beer on the radio during a baseball game — he picked up the phone, called the brewery, and asked for a distributorship."
- **Good (Nick Amendola):** "Your father Lou once described the scale of what he built with three simple words: 'Not even a little bit.'"
- **Weak:** "Valley Wide has built an impressive regional presence over the past four decades."

### The "single decision that would define the next ninety years" construction

Whenever the research turns up a pivotal deal or moment (1935 Budweiser rights, 1977 succession, 2019 presidency transfer), use this construction. It compresses decades into one sentence and gives the email rhetorical weight without being pompous.

### The "each generation after him" bridge

This one sentence does enormous work. It:
- Compresses 2-4 generations of history into a single line
- Sets up the AI-revolution paragraph
- Avoids awkwardly naming family members you might not know well
- Positions the current recipient as just one more generation in a long line

### Trust signals paragraph — order of impact

1. "**Manhattan Beer**" — existing client reference, highest impact for A-B houses
2. "**20,000+ stores**" — concrete scale metric
3. "**Stanford**" — academic validity
4. "**Google for Startups, Techstars by JPMorgan Chase, NVIDIA**" — name-drop hierarchy
5. "**Stanford Emergence Accelerator + Stanford GSB Demo Day**" — repeat Stanford signal

Don't use all of these at once; pick 3 for any given email. Manhattan Beer is mandatory for A-B houses.

### Closing — the NBWA ask

"My team and I will be in Washington for the NBWA Legislative Conference starting this Sunday. It would be great to grab a coffee and discuss how [Company] can lead the next wave of AI transformation in our industry."

Notes:
- "Starting this Sunday" is better than giving a date (which ages quickly)
- "Grab a coffee" is lower-commitment than "meet" or "have a meeting"
- Always name the company in the ask — "how [Company] can lead" signals we're not generic

### Common rewrites

When a user pushes back on an email draft, the common reasons are:
1. **Too many dates and numbers.** Strip specifics ("1928", "age seventeen") and let the story read cinematic rather than as a biographical timeline.
2. **Wrong generation reference.** Great-grandfather vs. grandfather matters; always re-check the tree before sending.
3. **Risky reference when there's a family problem.** If there's a lawsuit or recent death, default to generic "your family has built a multi-generational legacy" instead of naming anyone.

---

## Phase 4 — Follow-up and Meeting

After the cold email:

1. **3-day nudge.** If no response, a one-sentence reply: "Following up on this — happy to find any 15-minute window during the conference."
2. **Meeting prep.** Before the coffee, re-read the dossier. Have the founding story memorized; don't be caught not knowing a fact you referenced in email.
3. **Bring a printed one-pager** summarizing AI Intelligence's value prop for beer distributors specifically — not a generic deck.
4. **Post-meeting follow-up.** Send the dossier as a Google Doc, not the HTML. The HTML looks too polished and reads as "they made this just for me" in a way that can backfire — a neat Google Doc with the 2-3 most relevant facts is more natural.

---

## Failure Modes to Avoid

1. **Don't send the family-legacy frame to a distributor with active family litigation.** This is the #1 failure mode. Always check court records for the state the distributor is in.

2. **Don't over-personalize.** A 500-word email with seven specific facts reads as creepy, not researched. Use 2-3 concrete details, max.

3. **Don't name the wrong ancestor.** If you call someone's great-grandfather their grandfather, the email fails instantly. Always verify the generation count with the recipient's own public statements ("I'm the fourth generation to own the business" — Sarah Schwab, Ohio Senate testimony).

4. **Don't use the same subject line twice in a batch.** "What Would John Do in the Age of AI?" works for Sarah Matesich but not Ed Kozol. Each target needs its own personalized subject.

5. **Don't send on the wrong day.** Wholesaler executives read email Monday-Thursday 7-9am. Avoid Fridays and weekends.
