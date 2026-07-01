# QA Test: Card 04 — Valuations ("The Rubber Band")
# Market Hub — loganbase.com/market-hub

## Your Role
You are a QA reviewer for the Market Hub dashboard. You have no prior context.
Run every check below in order. Report PASS / FAIL / NOTE for each item.
At the end, produce a summary table of results.

---

## STEP 1 — Fetch the Scores API

Fetch: GET https://www.loganbase.com/api/scores

From the JSON response:
- Locate the card where `id = "valuations"` (Card 04)
- Extract the full card object including: `status`, `rows[]`, `delta`, `note`
- Also extract: `timestamp` and `source` from the top-level response

---

## STEP 2 — Freshness & Source Check

CHECK F1: Is `timestamp` from today's date (UTC)?
  PASS = timestamp date matches today
  FAIL = timestamp is stale (yesterday or older)

CHECK F2: Is the top-level `source` field present and valid?
  Expected values: "d1" | "yahoo" | "d1+yahoo"
  PASS = field exists and contains one of these three values
  NOTE the value:
    "d1"       → All data from Cloudflare D1 (ideal for this card — all sources are D1-based)
    "d1+yahoo" → Mixed — D1 is partially populated
    "yahoo"    → D1 unavailable; note that Valuations card will fall back to placeholder values

---

## STEP 3 — Card Structure Check (API Layer)

CHECK S1: Does the card have exactly 4 rows in the API response?
  Expected: rows[0], rows[1], rows[2], rows[3]
  NOTE: All 4 rows exist in the API. The UI Indicators table only displays 2 of them
        (CAPE and Buffett Ind. are hidden from Indicators and shown in Metrics Boxes instead).
  FAIL if fewer than 4 rows exist in the API response.

CHECK S2: Do the API row labels match exactly?
  rows[0].label = "Trailing P/E"
  rows[1].label = "CAPE"
  rows[2].label = "Buffett Ind."
  rows[3].label = "Japan P/E"

CHECK S3: Do the row indicators match exactly?
  rows[0].indicator = "S&P 500 Trailing P/E (Shiller, 1-2mo lag)"
  rows[1].indicator = "Shiller CAPE (10yr)"
  rows[2].indicator = "Mkt Cap / GDP (Buffett)"
  rows[3].indicator = "EWJ (Japan ETF) vs S&P 500"

CHECK S4: Is the `note` field present on the card?
  PASS = card.note exists and contains "not near-term entry points"
  FAIL = note field is missing or empty

---

## STEP 4 — Parse Raw Values from Row Display Strings

Value formats for this card differ from market-price cards — all are ratio/percentage strings:

Row 0 value format: "X.X×" (e.g., "22.7×") or placeholder "~22×"
  → Extract: TRAILING_PE_VAL as a number (strip × and ~)
  → If value starts with "~": mark as PLACEHOLDER_PE = true (D1 not seeded for this metric)

Row 1 value format: "X.X×" or "X.X× *" (stale flag) or placeholder "~37×"
  → Extract: CAPE_VAL as a number (strip ×, *, and ~)
  → If value contains " *": mark CAPE_STALE = true
  → If value starts with "~": mark as PLACEHOLDER_CAPE = true

Row 2 value format: "XXX%" (e.g., "233%") or placeholder "~230%"
  → Extract: BUFFETT_VAL as a number (strip % and ~)
  → If value starts with "~": mark as PLACEHOLDER_BUFFETT = true

Row 3 value format: "X.X×" (e.g., "19.8×") or placeholder "~15×"
  → Extract: JAPAN_PE_VAL as a number (strip × and ~)
  → If value starts with "~": mark as PLACEHOLDER_JAPAN = true

NOTE: Placeholder values ("~XX") mean D1 has not been seeded for that metric yet.
Placeholder rows should still have the correct status and condition — check them but
note the placeholder in your report.

---

## STEP 5 — Row 0: Trailing P/E Zone Logic (API + Indicators Table)

Using TRAILING_PE_VAL from Step 4:

IF PLACEHOLDER_PE = true: mark R0A and R0B as NOTE (cannot verify math, D1 not seeded)

Otherwise:

CHECK R0A: Is the status correct for the parsed P/E value?
  PE > 22×        → rows[0].status must = "bearish"
  PE 16× to 22×   → rows[0].status must = "neutral"
  PE < 16×        → rows[0].status must = "bullish"

CHECK R0B: Is the condition text correct?
  bearish  → rows[0].condition must contain "Elevated"
  neutral  → rows[0].condition must contain "Average"
  bullish  → rows[0].condition must contain "Below Average"

CHECK R0C: Is "Trailing P/E" visible in the UI Indicators table?
  PASS = the Indicators table shows a row labelled "Trailing P/E"
  FAIL = row is missing from the Indicators table
  NOTE: Only Trailing P/E and Japan P/E are shown in the Indicators table.
        CAPE and Buffett Ind. are intentionally hidden here (shown in Metrics Boxes instead).

---

## STEP 6 — Row 1 (CAPE) and Row 2 (Buffett Ind.) — API Only

These rows exist in the API response but are NOT shown in the UI Indicators table.
They are surfaced through the Valuation Metrics Boxes section instead (see Step 10).

CHECK R1A: Is the CAPE status correct for the parsed CAPE value?
  CAPE > 35×     → rows[1].status must = "bearish"
  CAPE 20–35×    → rows[1].status must = "neutral"
  CAPE ≤ 20×     → rows[1].status must = "bullish"

CHECK R1B: Is the CAPE condition text correct?
  CAPE > 40×     → condition must contain "Extreme"
  CAPE 35–40×    → condition must contain "Very High"
  CAPE 25–35×    → condition must contain "Elevated"
  CAPE ≤ 25×     → condition must contain "Normal" or "Average"

CHECK R2A: Is the Buffett status correct for the parsed value?
  BUFFETT > 115%  → rows[2].status must = "bearish"
  BUFFETT 80–115% → rows[2].status must = "neutral"
  BUFFETT < 80%   → rows[2].status must = "bullish"
  NOTE: Both >160% and 115–160% map to "bearish". The condition text distinguishes:
    > 160%      → condition must contain "Extreme"
    115–160%    → condition must contain "Overvalued"

CHECK R2B: Is the Buffett condition text present and non-empty?
  PASS = rows[2].condition is a non-empty string

CHECK UI_HIDDEN: Are CAPE and Buffett Ind. absent from the UI Indicators table?
  PASS = the Indicators table does NOT show rows labelled "CAPE" or "Buffett Ind."
  FAIL = either row appears in the Indicators table (they should be filtered out)

---

## STEP 7 — Row 3: Japan P/E (Context Only)

Using JAPAN_PE_VAL from Step 4:

*** CRITICAL RULE: Row 3 (Japan P/E) must NOT be counted in card.status ***
*** It is a context-only row — its status is irrelevant to the card score ***

CHECK J1: Does rows[3] exist in the API response?
  PASS = rows[3] is present
  FAIL = Japan P/E row is missing entirely

CHECK J2: Does rows[3].condition contain "International" or "In Line"?
  PASS = condition is non-empty and contains one of these terms

CHECK J3: Is Japan P/E visible in the UI Indicators table?
  PASS = the Indicators table shows a row labelled "Japan P/E"
  FAIL = Japan P/E row is missing from the Indicators table

CHECK J4: (Logic verification — if JAPAN_PE_VAL and TRAILING_PE_VAL both available)
  Japan status logic uses US P/E as the comparison reference:
    Japan P/E < US P/E × 0.8   → status = "bullish"
    Japan P/E < US P/E          → status = "neutral"
    Japan P/E ≥ US P/E          → status = "bearish"
  Verify rows[3].status is consistent with this comparison.
  NOTE: US P/E used may be the forward P/E (not displayed on card) if available in D1;
  if values seem off, this is likely the cause — mark as NOTE rather than FAIL.

---

## STEP 8 — Card Status Logic (Critical: Japan P/E Excluded)

This is the most important structural check for Card 04.

Count statuses across rows[0..2] ONLY (DO NOT include rows[3]):
  BULLISH_COUNT = rows where status = "bullish" among rows[0], rows[1], rows[2]
  BEARISH_COUNT = rows where status = "bearish" among rows[0], rows[1], rows[2]

Expected card.status:
  IF BULLISH_COUNT > BEARISH_COUNT → card.status = "bullish"
  IF BEARISH_COUNT > BULLISH_COUNT → card.status = "bearish"
  IF equal or all neutral          → card.status = "neutral"

CHECK O1: Does card.status match the majority-wins result across rows 0–2?
  PASS = card.status matches your calculated majority
  FAIL = card.status does not match — this is a scoring logic bug

CHECK O2: If you include rows[3] in the count, does the result CHANGE?
  This is a trap check. If including Japan P/E would change the card status,
  and the card status reflects the WRONG (4-row) calculation → FAIL.
  The card must always be scored on rows 0–2 only.

---

## STEP 9 — Valuations Chart (UI — 3 Tabs)

Open the Valuations deep-dive. Scroll to the chart section above the Indicators table.

CHECK CH1: Does the chart render with 3 tabs?
  Expected tabs (in order): "Trailing P/E" | "CAPE" | "Buffett"
  PASS = all 3 tabs are visible and labelled correctly
  FAIL = tabs are missing or mislabelled

CHECK CH2: Does the default tab load correctly?
  Default tab = "Trailing P/E"
  PASS = chart loads with data on page open (no blank/error state)
  FAIL = chart blank, spinner stuck, or error

CHECK CH3: Does switching tabs update the chart?
  Click "CAPE" tab → chart data should change
  Click "Buffett" tab → chart data should change
  PASS = each tab shows a different data series
  FAIL = chart doesn't update on tab switch

CHECK CH4: Does each tab show a Historical Average reference line?
  Expected: dashed gray line labelled "Historical Avg"
  PASS = reference line present on all 3 tabs
  FAIL = missing on any tab

CHECK CH5: Does each tab show a Warning reference line?
  Expected amber dashed line with label (e.g., "Elevated (22×)" for Trailing P/E)
  Trailing P/E warning: 22×
  CAPE warning:         35×
  Buffett warning:      115%
  PASS = warning line present on all 3 tabs with correct label
  FAIL = missing or wrong threshold on any tab

CHECK CH6: Does the range selector work?
  Expected ranges visible: 5Y | 10Y | 20Y | 30Y (minimum)
  PASS = range buttons present and chart updates on click
  FAIL = range selector missing or chart does not update

---

## STEP 10 — Valuation Metrics Boxes (UI — 3×3 Grid)

Open the Valuations deep-dive. Scroll to the "Key Metrics" section below the Indicators table.

The section must render 3 rows of 3 StatBoxes each (9 boxes total):
  Row A — CAPE Shiller:      [CAPE Shiller] [30Y Average] [Percentile]
  Row B — Buffett Indicator: [Buffett Indicator] [30Y Average] [Percentile]
  Row C — Trailing P/E:      [Trailing P/E] [30Y Average] [Percentile]

CHECK M1: Do all 9 boxes render with values (no "—" placeholders)?
  PASS = all 9 boxes show numeric values
  FAIL = any box shows "—" (data not loading)
  NOTE: allow "—" only if the API confirmed the metric is not seeded (PLACEHOLDER = true)

CHECK M2: Are direction arrows (▲ or ▼) shown on all 9 boxes?
  All boxes use positiveDir=false: ▲ red = elevated above average (bad), ▼ green = below average (good)
  PASS = every box has a visible direction arrow
  FAIL = any box is missing a direction arrow

CHECK M3: Do the "Current value" boxes (CAPE Shiller, Buffett Indicator, Trailing P/E) have
  the correct tone colour?
  CAPE > 35× → red; CAPE 20–35× → yellow; CAPE ≤ 20× → green
  Buffett > 115% → red; Buffett 80–115% → yellow; Buffett < 80% → green
  Trailing P/E > 25× → red; P/E 20–25× → yellow; P/E < 20× → green
  PASS = all 3 current-value boxes have the correct colour
  FAIL = any current-value box has the wrong colour

CHECK M4: Do the "30Y Average" boxes display correctly?
  Expected labels: "30Y Average" in each row
  Expected desc:   "long-run historical average"
  Expected tone:   neutral (white/gray text)
  PASS = all 3 average boxes show a plausible average value in neutral tone
  FAIL = boxes are missing, mislabelled, or showing wrong colour

CHECK M5: Do the "Percentile" boxes display correctly?
  Expected format: ordinal number (e.g., "96th", "48th", "100th")
  Expected desc:   "of monthly readings in 30Y" or "of quarterly readings in 30Y"
  PASS = all 3 percentile boxes show an ordinal value
  FAIL = boxes missing or showing raw numbers without ordinal suffix

CHECK M6: Do hover tooltips (triggers) work on the current-value boxes?
  Hover over CAPE Shiller → should show threshold breakdown (e.g., "Extreme > 40×", etc.)
  Hover over Buffett Indicator → should show threshold breakdown
  Hover over Trailing P/E → should show threshold breakdown
  PASS = tooltips appear on hover with labelled thresholds and colour-coded text
  FAIL = no tooltip, blank tooltip, or tooltip appears on wrong boxes

CHECK M7: Are "warn" badges (⚠) shown when the value is near a threshold?
  Thresholds: CAPE ±2× of [40, 35, 25, 16]; P/E ±1.5× of [25, 20, 16]; Buffett ±5% of [160, 115, 80]
  PASS = warn badge visible when current value is within the tolerance of a threshold
  NOTE = if no current value is near a threshold today, this check is N/A

---

## STEP 11 — Cross-Reference via Valuations History API

Fetch: GET https://www.loganbase.com/api/valuations-history?range=30y

From the response extract:
  summary.currentCape   (latest CAPE from D1)
  summary.currentPe     (latest trailing P/E from D1 — may be null if recent months are missing)
  summary.latestDate    (date of the most recent data row)
  summary.avgCape       (30-year average CAPE)
  summary.percentile    (current CAPE percentile over 30 years)

NOTE on currentPe: The API may return null for currentPe if the most recent 1–3 monthly entries
are null (PE data lags by ~2 months). The UI falls back to the last non-null value in peRatios[].
If summary.currentPe = null, this is expected behaviour — not a bug.

CHECK V1: Does summary.currentCape match CAPE_VAL parsed from the card in Step 4?
  Allow ±0.1× tolerance
  PASS = values match within tolerance
  FAIL = values diverge — inconsistency between scores API and valuations-history API
  N/A  = if PLACEHOLDER_CAPE = true (D1 not seeded)

CHECK V2: Does the last non-null value in peRatios[] match TRAILING_PE_VAL from the card?
  Allow ±0.5× tolerance
  If summary.currentPe is null: find the last non-null entry in peRatios[] manually
  PASS = values match within tolerance
  NOTE = minor divergence is acceptable if data dates differ between the two endpoints
  N/A  = if PLACEHOLDER_PE = true

CHECK V3: Is summary.latestDate recent (within 2 months of today)?
  PASS = latestDate is within 2 months of today's date
  FAIL = latestDate is more than 2 months old — D1 Shiller data needs re-seeding
  (If latestDate IS more than 2 months old, this confirms the CAPE_STALE asterisk
   on the card is working correctly — note this as PASS for any stale-flag check)

CHECK V4: Is summary.percentile a number between 0 and 100?
  PASS = percentile is a valid number
  FAIL = percentile is null or outside 0–100 range

---

## STEP 12 — Buffett History API

Fetch: GET https://www.loganbase.com/api/buffett-history?range=30y

From the response extract:
  summary.current    (latest Buffett ratio %)
  summary.avg        (30-year average %)
  summary.percentile (current percentile over 30 years)
  summary.latestDate (date of the most recent data row)

CHECK B1: Does summary.current match BUFFETT_VAL from Step 4?
  Allow ±2% tolerance
  PASS = values match within tolerance
  N/A  = if PLACEHOLDER_BUFFETT = true

CHECK B2: Is summary.avg a plausible 30-year average (expect roughly 90–140%)?
  PASS = value is in a reasonable range
  FAIL = null or outside expected range

CHECK B3: Is summary.percentile a number between 0 and 100?
  PASS = percentile is a valid number
  FAIL = null or outside 0–100 range

---

## STEP 13 — Delta Field

CHECK D1: Is the `delta` field present on the card?
  Expected values: "up" | "down" | "same"
  PASS = field exists and contains one of these three values
  NOTE: Valuations change slowly — "same" is the most common reading for this card

---

## REPORT FORMAT

Produce your findings in this format:

### Card 04 Valuations — QA Results [DATE]

| Check | Description | Result | Notes |
|-------|-------------|--------|-------|
| F1  | Timestamp freshness | PASS/FAIL | |
| F2  | Source field valid | PASS/FAIL | Value: d1/yahoo/d1+yahoo |
| S1  | Row count = 4 (API) | PASS/FAIL | |
| S2  | Row labels correct (API) | PASS/FAIL | |
| S3  | Row indicators correct (API) | PASS/FAIL | |
| S4  | Note field present | PASS/FAIL | |
| R0A | Row 0 (Trailing P/E) status | PASS/FAIL/NOTE | PE: X× |
| R0B | Row 0 condition text | PASS/FAIL/NOTE | |
| R0C | Trailing P/E in Indicators table | PASS/FAIL | |
| R1A | Row 1 (CAPE) status (API) | PASS/FAIL/NOTE | CAPE: X× |
| R1B | Row 1 condition text (API) | PASS/FAIL/NOTE | |
| R2A | Row 2 (Buffett) status (API) | PASS/FAIL/NOTE | Buffett: X% |
| R2B | Row 2 condition text (API) | PASS/FAIL/NOTE | |
| UI_HIDDEN | CAPE & Buffett absent from Indicators table | PASS/FAIL | |
| J1  | Row 3 (Japan P/E) exists (API) | PASS/FAIL | |
| J2  | Row 3 condition text valid | PASS/FAIL | |
| J3  | Japan P/E in Indicators table | PASS/FAIL | |
| J4  | Row 3 logic consistent | PASS/NOTE | Japan: X×, US: X× |
| O1  | Card status = majority rows 0–2 | PASS/FAIL | Bull:X Bear:X Neu:X |
| O2  | Japan P/E correctly excluded | PASS/FAIL | CRITICAL |
| CH1 | Chart: 3 tabs present | PASS/FAIL | |
| CH2 | Chart: default tab loads | PASS/FAIL | |
| CH3 | Chart: tab switching works | PASS/FAIL | |
| CH4 | Chart: Historical Avg line | PASS/FAIL | |
| CH5 | Chart: Warning line (correct threshold) | PASS/FAIL | |
| CH6 | Chart: range selector works | PASS/FAIL | |
| M1  | Metrics: all 9 boxes have values | PASS/FAIL | |
| M2  | Metrics: all 9 boxes have direction arrows | PASS/FAIL | |
| M3  | Metrics: current-value box colours correct | PASS/FAIL | |
| M4  | Metrics: 30Y Average boxes correct | PASS/FAIL | |
| M5  | Metrics: Percentile boxes show ordinal | PASS/FAIL | |
| M6  | Metrics: hover triggers work | PASS/FAIL | |
| M7  | Metrics: warn badges near thresholds | PASS/NOTE/N-A | |
| V1  | CAPE matches valuations-history API | PASS/FAIL/N-A | Card:X× API:X× |
| V2  | P/E matches valuations-history API | PASS/FAIL/N-A | Card:X× API:X× |
| V3  | Shiller data recency | PASS/FAIL | Latest: [date] |
| V4  | CAPE percentile valid | PASS/FAIL | Value: X |
| B1  | Buffett matches buffett-history API | PASS/FAIL/N-A | Card:X% API:X% |
| B2  | Buffett 30Y average plausible | PASS/FAIL | Value: X% |
| B3  | Buffett percentile valid | PASS/FAIL | Value: X |
| D1  | Delta field present | PASS/FAIL | Value: up/down/same |

### Placeholder Summary
  - PLACEHOLDER_PE:      true / false
  - PLACEHOLDER_CAPE:    true / false
  - PLACEHOLDER_BUFFETT: true / false
  - PLACEHOLDER_JAPAN:   true / false
  (Any "true" means D1 has not been seeded for that metric — card is using fallback values)

### Summary
- Total checks: 38
- Passed: X
- Failed: X
- N/A: X
- Notes: [anything unexpected not covered by a specific check]

### Critical Flags (fail-stop issues)
List any FAIL results for: O1 (card status logic), O2 (Japan excluded from score), UI_HIDDEN (CAPE/Buffett visible in Indicators when they should not be)
These indicate logic bugs and should be investigated immediately.
Any PLACEHOLDER = true entries should be noted as infrastructure items (D1 seeding
incomplete) rather than code bugs.
