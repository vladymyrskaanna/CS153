# PROMPT 01 — Research a New Distributor

Use this prompt when you have a distributor name and need to build a complete research foundation before writing any outreach. Paste this into a fresh Claude conversation.

---

## The Prompt

```
I need you to do deep research on a US beer distributor for the purpose of personalized sales outreach. The goal is to understand their family history, leadership, and any recent news — so I can write a cold email that shows I know their business.

Target distributor: [COMPANY NAME]
State / HQ: [STATE]
Website (if known): [URL]
Known contact name(s), if any: [NAMES]

Please execute the following research in order, using web search liberally:

1. **Founding story**
   - When was the company founded?
   - Who founded it? Immigrant origins? Family name meaning?
   - Is there a vivid founding moment (phone call, handshake, war story, radio ad)?
   - What was the first major deal that defined the company (often a brewery-rights acquisition in the 1930s-1950s)?

2. **Family tree across all generations**
   - Identify generations 1 through 4+ where applicable
   - For each person: name, role, dates (birth/death/tenure), key contribution
   - Note any missing generations in the public record
   - Flag any siblings or cousins who are also in the business

3. **Current leadership**
   - CEO, President, COO, CFO — names + LinkedIn URLs
   - Non-family executives (often the finance/operations side)
   - Whose email address can we confirm from BBB, ZoomInfo, or the company website

4. **Media trail**
   - NBWA press releases (Chairman elections, panel appointments, BREW forum speakers)
   - Industry press (Brewbound, Cheers Online, Bar Business Magazine, Beer Business Daily)
   - Local newspaper features (state/city-specific)
   - Podcast appearances
   - Congressional/state committee testimony
   - For each: date, outlet, quote if notable

5. **Red flags check (do this ruthlessly)**
   - Active lawsuits in state court (plaintiffs, defendants, year filed, status)
   - Recent deaths of key family members (< 12 months)
   - EEOC filings (search eeoc.gov)
   - Estrangement signals (siblings with changed surnames, retroactive terminations)
   - Recent bankruptcy or brand loss
   - Political donation patterns (optional — relevant only for tonal choices)

6. **Business snapshot**
   - Legal name + DBA
   - HQ address and phone
   - Employee count
   - Number of accounts / retailers served
   - Counties / states covered
   - Primary supplier relationships (A-B, MillerCoors, Constellation, Yuengling, etc.)
   - Secondary portfolio (craft, imports, energy drinks)
   - BBB accreditation status and year

7. **Outreach recommendation**
   - Based on all of the above, what is the right tone for outreach?
   - Is the family-legacy template appropriate, or should we use a business-first approach?
   - Who is the correct target (operator, not figurehead)?
   - Any specific facts worth leading the email with?

Format the output as a structured markdown document with clear sections. When citing sources, include the URL. When uncertain, say so explicitly.
```

---

## Follow-up prompts to use as you go

**If the founding moment is weak or generic:**
> Dig deeper into the founder's life — check their obituary (if deceased), their military service records, their siblings' obits, and any local history books about the town. There is always a more specific story than "they started a beer distributorship in 1950."

**If you can't find current leadership contacts:**
> Try these sources in order: (1) BBB business profile for the state, (2) ZoomInfo company page, (3) RocketReach, (4) the state Wholesale Beer & Wine Association member list, (5) the company's LinkedIn page followed by 1st-degree employee browse. Confirm any email pattern you find by cross-referencing at least two sources.

**If you find a red flag:**
> Don't minimize it. Explain exactly what the red flag is, how recent, how severe, and what the implications are for outreach. It's better to kill a target than to send a tone-deaf email.

**If the family tree has a missing generation:**
> Search for "missing generation II" patterns: sometimes the corporate website compresses 3 generations into 2 for marketing simplicity. Check SSDI records on MyHeritage/Ancestry for middle generations. Check obituaries of the founders for lists of surviving children — those children are the missing generation.

---

## Expected output format

A markdown document of 2,000-4,000 words structured exactly as in the numbered sections of the prompt. Every fact should have a source URL next to it. Red flags should be in their own clearly-labeled section, not buried.

---

## Time budget

A tier-A distributor dossier takes 60-120 minutes even with Claude doing the work. Do not rush this phase — a bad research phase cascades into a bad email and a wasted opportunity.
