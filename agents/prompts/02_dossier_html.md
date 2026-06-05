# PROMPT 02 — Build the HTML Dossier

Use this prompt AFTER completing Phase 1 research. Paste into Claude with the research attached.

---

## The Prompt

```
I have completed research on a US beer distributor and I need you to produce an editorial-quality HTML dossier. Attached is the research.

Distributor: [COMPANY NAME]
Dossier number: [##]

Please produce a single-file HTML document with these requirements:

## Typography
- Fraunces for display and accent text (Google Fonts)
- Newsreader for body text (Google Fonts)
- JetBrains Mono for labels, timeline years, metadata (Google Fonts)
- All fonts loaded via Google Fonts CDN in the <head>

## Layout
- Max-width 900px, generous 40px padding
- Centered with auto margins
- Paper-textured background (radial gradients + linear gradient)
- Height auto, no fixed viewport height

## Palette (pick 3 colors that evoke the company's heritage)
Examples:
- Birmingham, AL (AlaBev): copper + cream + warm brown
- Grand Rapids, MI (Alliance): pine green + lake blue + birch
- Little Rock, AR (O'Connor): clay red + Southern cream + pine
- Fresno, CA (Valley Wide): terracotta + vineyard green + cream
- Joliet, IL (Kozol): steel blue + brass + oxblood
- Newark, OH (Matesich): burgundy + antique gold + cream

Use CSS custom properties (--ink, --accent-1, --accent-2, --paper, etc.)

## Required sections in order

1. **Masthead**
   - Kicker: "Dossier № [##] · Distributor Field Research · Confidential"
   - Title: Company Name (big, bold, 62px, Fraunces 800)
   - Subtitle: one italicized evocative tagline
   - Meta row: founded / HQ / top brand / employee count (JetBrains Mono, small caps)

2. **Highlight Banner** (top of dossier)
   - Green banner with ✓ icon if ideal target
   - Red/orange banner with ⚠️ icon if cautions apply (recent death, lawsuit, EEOC history)
   - Banner text states WHY this is or isn't a clean target in plain language

3. **Section I · Origin** (prose, 3-4 paragraphs)
   - First paragraph uses a drop-cap (::first-letter styled, Fraunces 900, ~76px)
   - Tell the founding story in narrative form
   - Name the patriarch/founder, the pivotal first deal, any vivid moment

4. **Section II · Chronology** (vertical timeline)
   - Left-border line with dots at each entry
   - Milestone entries have larger dots
   - Year label (mono), title (Fraunces bold), body (serif)
   - Cover the founding through the present

5. **Section III · Family Tree** (generation-grouped cards)
   - Group by Generation 0 / I / II / III / IV / V
   - Each person gets a card with:
     - Name in bold Fraunces
     - Role / dates in italics
     - Body text describing their contribution
     - Person-meta row with LinkedIn link + email if available
   - Color-code cards: founder (burgundy left border), active (oxblood), deceased (ink)

6. **Pullquote** (between sections III and IV)
   - A standout quote from the target or a family member, with attribution
   - Large italic Fraunces, centered, with a big opening quote mark

7. **Section IV · Leadership** (current executives)
   - Person cards just for current operators
   - Include direct email addresses when known

8. **Section V · Media Trail** (selected press appearances)
   - A bordered list with date in one column, body in the other
   - 6-10 most significant media appearances with dates and outlets

9. **Section VI · Business Snapshot** (2-column data grid)
   - CSS grid, alternating hairline backgrounds
   - Label (tiny mono) + Value (Fraunces bold)
   - Cover: legal name, founded, HQ, employees, accounts, primary supplier, etc.

10. **Section VII · Outreach Strategy** (ink-on-dark recommendation box)
    - Dark background (burgundy or steel-deep), cream text
    - "Strategic Recommendation" label
    - 2-3 specific, tactical recommendations in numbered list
    - Close with "Tonal note:" guidance

11. **Colophon** (bottom)
    - Typography notes (Fraunces/Newsreader/JetBrains Mono credits)
    - Sources section with hyperlinks to every URL used in research
    - Research notes (uncertainties, gaps, verification still needed)

## CSS conventions

- Use CSS custom properties exclusively; no hardcoded colors
- Borders: 1px rgba() hairlines, 6px double lines only for section breaks
- Shadows: modest, 3px-8px offset, 0 blur, using color-tinted rgba
- Hover states on links (color shift to gold-deep or accent color)
- Mobile responsive: 720px breakpoint reduces padding, collapses 2-col grids to 1-col

## Output rules

- Single HTML file, self-contained
- All CSS in a single <style> block in <head>
- No external JS
- Google Fonts via <link>, no CSS @import
- Mobile-responsive
- Print-friendly (readable on paper if needed)

Save the file to /mnt/user-data/outputs/[##]_[company_slug].html

Then use the present_files tool to show me the result.
```

---

## Style reference

The 6 existing dossiers in the `dossiers/` folder are the canonical style guide. If in doubt, match their conventions. Open any of them in a browser and copy the CSS structure.

---

## Quality checklist before delivering

- [ ] Does the masthead make me want to read on?
- [ ] Is the founding story vivid in Section I, or does it read like a corporate bio?
- [ ] Does the timeline cover the founding through the present without major gaps?
- [ ] Are all generations labeled and color-coded in the family tree?
- [ ] Is there a pullquote somewhere in the document?
- [ ] Does the outreach recommendation box give 2-3 actionable tactical points?
- [ ] Are all source URLs hyperlinked in the colophon?
- [ ] Is the dossier number in the masthead?
- [ ] Does it render properly on mobile (test at 375px width)?

---

## Common mistakes to avoid

1. **Wall-of-text prose in Section I.** Break into 3-4 tight paragraphs with clear narrative progression.
2. **Timeline that stops in 2015.** Timeline must run to the present year — show current standing.
3. **Missing the pullquote.** The pullquote gives the dossier a rest-point and adds human texture.
4. **Overly formal tone.** The dossier reads like editorial journalism, not a sales report. Voice matters.
5. **Hardcoded colors.** All colors must be CSS variables to keep the palette coherent.
