# PROMPT 04 — Build a Priority Ranking from NBWA Data

Use this prompt when you have a bulk distributor directory (NBWA or similar) and need to rank them 0-10 for outreach priority.

---

## The Prompt

```
I have a directory of US beer distributors (attached as an xlsx). I need a priority ranking from 0-10, with cell-level color coding, so I know who to approach first for personalized outreach.

Please:

1. Load the xlsx using openpyxl or pandas. The file has columns for: Distributor Name, State, Address, Phone, Website, Principals (contacts), and Brewers/Importers represented.

2. Consolidate duplicate distributors. Same company can appear multiple times with slightly different names or with one row per warehouse location. Normalize:
   - "MANHATTAN BEER & BEVERAGE DISTRIBUTORS" and "MANHATTAN BEER DISTRIBUTORS LLC" → same company
   - "KOZOL BROS., INC." and "KOZOL BROS., INC. - SOUTH" → same company
   - Any distributor with multiple rows sharing the same name → one consolidated entry

3. For each unique distributor compute:
   - Number of warehouse locations (# rows in the file)
   - Number of unique brand lines represented (split Brewers/Importers on newline)
   - Set of states (can be multi-state)
   - Principal contacts count
   - Website (first non-empty)
   - Primary phone

4. Apply a scoring rubric:
   - 10: Mega (Reyes Beverage Group, Manhattan Beer, Ben E. Keith, Columbia)
   - 9: Very Large ($500M+ revenue, multi-region: Odom, Capital Reyes, Southern Glazer's)
   - 8: Large (Crescent Crown, Heidelberg, Andrews, Republic National, J.J. Taylor)
   - 7: Large-medium (Alliance, Admiral, Dahlheimer, Koerner, Harbor, Decrescente)
   - 6: Medium (AlaBev, Valley Wide, Kozol, Gusto, Canyon, Summit, Allied, Grellner)
   - 5: Medium-small (Standard, Premium, Lee, United, Faust)
   - 4: Small (2 locations or 40+ brands single-loc)
   - 3: Very small (single location, 20-40 brands)
   - 2: Micro (single location, 10-20 brands)
   - 1: Tiny (single location, <10 brands)

5. Apply manual overrides for known mega-distributors that look small in location-count only but are actually huge (see list in the code below).

6. Build an xlsx with 4 tabs:

   **Tab 1 — Executive Summary**
   - Headline numbers: total distributors, total locations, states covered, total brands, already-done dossiers
   - Tier counts (A through E)
   - Scoring methodology table (color-coded by tier)
   - Important caveats section

   **Tab 2 — Priority Ranking** (the main tab)
   - One row per unique distributor, sorted by score descending
   - Columns: Priority tier, Score, Distributor, States, Locations, Brands, Website (hyperlinked), Phone, Top Contact, Email (mailto hyperlinked), LinkedIn (hyperlinked), # Contacts, Status
   - Color-code the Priority and Score cells by tier:
     - Score 10: deep red bg (B71C1C), white text
     - Score 9: red (D32F2F), white
     - Score 8: light red (E57373), black
     - Score 7: orange (F57C00), black
     - Score 6: light orange (FFB74D), black
     - Score 5: yellow (FFD54F), black
     - Score 4: light green (AED581), black
     - Score 3: green (81C784), black
     - Score 2: gray (B0BEC5), black
     - Score 1: very light gray (ECEFF1), black
   - Status column shows "✓ Done (Dossier #NN)" in green for completed dossiers, "⚠️ LAWSUIT" in orange for red-flag targets, "★ Existing Client" in yellow for current customers
   - Freeze first row + first 3 columns
   - Apply autofilter
   - Arial font throughout

   **Tab 3 — By State**
   - Aggregate statistics per state: unique distributors, total locations, average score, top score
   - Sort by total score descending (= which states have the most high-value targets)

   **Tab 4 — All Contacts**
   - One row per principal contact
   - Columns: Score (color-coded), Distributor, Name, Title, Email (mailto), LinkedIn, Outreach Status
   - Sorted by score desc, then distributor name

Save to /mnt/user-data/outputs/distributors_priority_ranking.xlsx

Use this manual override table:
```python
KNOWN_MEGA = {
    'REYES BEVERAGE GROUP': 10, 'CAPITAL REYES DISTRIBUTING, LLC': 9,
    'MANHATTAN BEER DISTRIBUTORS': 10, 'BEN E. KEITH SPECIALTY BEVERAGES': 10,
    'COLUMBIA DISTRIBUTING': 10, 'THE ODOM CORPORATION': 9,
    "SOUTHERN GLAZER'S WINE & SPIRITS OF NEVADA": 9,
    "SOUTHERN GLAZER'S BEVERAGE COMPANY": 9, "GLAZER'S BEER & BEVERAGE": 9,
    'CRESCENT CROWN DISTRIBUTING, LLC': 8, 'HEIDELBERG DISTRIBUTING CO.': 8,
    'ANDREWS DISTRIBUTING CO.': 8, 'J.J. TAYLOR DISTRIBUTING FLORIDA, INC.': 8,
    'ALLIANCE BEVERAGE DISTRIBUTING': 7, 'ADMIRAL BEVERAGE CORPORATION': 7,
    'DECRESCENTE DISTRIBUTING CO.': 7, 'ALABEV': 6, 'VALLEY WIDE BEVERAGE CO.': 6,
    'KOZOL BROS., INC.': 6, 'DAHLHEIMER BEVERAGE LLC': 7,
    'HIGH COUNTRY BEVERAGE CORP.': 6, 'CHEROKEE DISTRIBUTING CO., INC.': 6,
    'KOERNER DISTRIBUTOR, INC.': 7, 'HARBOR DISTRIBUTING, LLC': 7,
    'REPUBLIC NATIONAL DISTRIBUTING CO., INC.': 8, 'ISLAND DISTRIBUTING': 6,
    'JOHNSON BROTHERS- MUTUAL DISTRIBUTING CO.': 7, 'GUSTO DISTRIBUTING CO.': 6,
    'SUMMIT BEVERAGE': 6, 'CANYON DISTRIBUTING CO.': 6, 'ALLIED BEVERAGES': 6,
    'GRELLNER SALES & SERVICE INC.': 6, 'LEGACY BEVERAGE, LLC': 6,
    'CLARK DISTRIBUTING CO., INC.': 6, 'BEVERAGE SOUTH - COLUMBIA': 5,
    'BEVERAGE WHOLESALERS, INC.': 5, "PREMIER GLAZER'S BEER & BEVERAGE": 6,
    'FAVORITE BRANDS LLC': 5, 'UNITED BEVERAGE INC.': 5,
    'STANDARD BEVERAGE CORP.': 5, 'BREAKTHRU BEVERAGE MISSOURI': 5,
}
```

And this done-dossier table:
```python
DONE_DOSSIER = {
    'ALABEV': '✓ Done (Dossier #01)',
    'ALLIANCE BEVERAGE DISTRIBUTING': '✓ Done (Dossier #02)',
    "O'CONNOR DISTRIBUTING CO.": '✓ Done (Dossier #03)',
    'VALLEY WIDE BEVERAGE CO.': '✓ Done (Dossier #04)',
    'KOZOL BROS., INC.': '✓ Done (Dossier #05) ⚠️ LAWSUIT',
    'MATESICH DISTRIBUTING CO.': '✓ Done (Dossier #06)',
    'MANHATTAN BEER DISTRIBUTORS': '★ Existing AI Intelligence Client',
}
```
```

---

## Expected output

An xlsx file at `/mnt/user-data/outputs/distributors_priority_ranking.xlsx` with 4 tabs, color-coded by tier, hyperlinked contact info, and ready for prioritized outreach.

Total distributors in typical NBWA directory (non-AB/InBev): ~450-500. Expect:
- 4-6 distributors at score 10
- 2-4 at score 9
- 5-8 at score 8
- 8-15 at score 7
- 10-20 at score 6
- 150-300 at scores 1-4

---

## Common issues

1. **Locations ≠ revenue.** A distributor with one warehouse can still be a regional giant (DeCrescente, NY — 57 brands, 1 location, massive business). The manual override table exists for this reason. Update it whenever you encounter a new single-location distributor that's actually large.

2. **AB-house underrepresentation.** This file is specifically "non-AB/InBev." Pure AB houses (like Matesich) appear minimally or not at all. If your target is an AB house, use a separate directory.

3. **Brand count is brand-line count, not SKU count.** "Anheuser-Busch" counts as one brand even if the distributor sells 50 A-B SKUs. Brand count correlates with portfolio breadth, not volume.

4. **Some rows have no website.** Don't penalize. Many distributors have minimal web presence despite being large regional players. Fall back on BBB or state association listings.
