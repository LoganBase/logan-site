# QA Test: Card 03 — Breadth ("The Early Warning")
# Market Hub — loganbase.com/market-hub

## Your Role
You are a QA reviewer for the Market Hub dashboard. You have no prior context.
Run every check below in order. Report PASS / FAIL / NOTE for each item.
At the end, produce a summary table of results.

---

## STEP 1 — Fetch the Scores API

Fetch: GET https://www.loganbase.com/api/scores

From the JSON response:
- Locate the card where `id = "breadth"` (Card 03)
- Extract the full card object including: `status`, `rows[]`, `delta`, `note`, `sectorTable`
- Also extract: `timestamp` and `source` from the top-level response

---

## STEP 2 — Freshness & Source Check

CHECK F1: Is `timestamp` from today's date (UTC)?
  PASS = timestamp date matches today
  FAIL = timestamp is stale (yesterday or older)

CHECK F2: Is the top-level `source` field present and valid?
  Expected values: "d1" | "yahoo" | "d1+yahoo"
  PASS = field exists and contains one of these three values
  NOTE the value — for Card 03, $MMTH/$MMFI come from D1 market_breadth table;
  sector ETFs and RSPD come from D1 daily_prices or Yahoo Finance fallback.

---

## STEP 3 — Card Structure Check

CHECK S1: Does the card have exactly 4 rows?
  Expected: rows[0], rows[1], rows[2], rows[3]
  FAIL if fewer or more rows exist

CHECK S2: Do the row labels match exactly?
  rows[0].label = "NYSE 200d Breadth"
  rows[1].label = "NYSE 50d Breadth"
  rows[2].label = "Sector Check"
  rows[3].label = "Consumer Signal"

CHECK S3: Do the row indicators match exactly?
  rows[0].indicator = "$MMTH — % NYSE Stocks Above 200d SMA"
  rows[1].indicator = "$MMFI — % NYSE Stocks Above 50d SMA"
  rows[2].indicator = "SPDR Sectors Above 200d SMA (11)"
  rows[3].indicator = "RSPD (Equal-Weight Consumer Disc.)"

CHECK S4: Is the `note` field present and non-empty?
  PASS = card.note exists and contains text (any non-empty string)
  FAIL = note missing or empty

CHECK S5: Is the `sectorTable` field present?
  PASS = card.sectorTable exists and is an array
  If empty array: NOTE (sector ETF data unavailable — may be expected if D1 not seeded)
  FAIL = sectorTable field missing entirely

---

## STEP 4 — Parse Raw Values from Row Display Strings

Row 0 value format: "XX.X%" (e.g., "52.5%") or "—" if D1 not seeded
  → Extract: MMTH_VAL as a number (strip %)
  → If value = "—": mark MMTH_UNAVAILABLE = true

Row 1 value format: "XX.X%" (e.g., "49.5%") or "—" if D1 not seeded
  → Extract: MMFI_VAL as a number (strip %)
  → If value = "—": mark MMFI_UNAVAILABLE = true

Row 2 value format: "X / 11" (e.g., "7 / 11") or "—"
  → Extract: BULL_COUNT (first number) and TOTAL_COUNT (second number)
  → If value = "—" or TOTAL_COUNT < 7: mark SECTOR_INSUFFICIENT = true

Row 3 value format: "US$XX.XX" (e.g., "US$54.76") or "—"
  → Extract: RSPD_PRICE as a number (strip "US$")
  → Direction determined from condition text (not the price itself)
  → If value = "—": mark RSPD_UNAVAILABLE = true

---

## STEP 5 — Row 0: NYSE 200d Breadth ($MMTH)

IF MMTH_UNAVAILABLE = true:
  CHECK R0A: rows[0].status must = "neutral"
  CHECK R0B: rows[0].condition must = "Awaiting Data"
  Mark remaining R0 checks as NOTE (D1 market_breadth not seeded)

Otherwise, using MMTH_VAL:

CHECK R0A: Is status correct?
  MMTH_VAL >= 70  → rows[0].status must = "bullish"
  MMTH_VAL >= 40  → rows[0].status must = "neutral"  (40 to <70)
  MMTH_VAL < 40   → rows[0].status must = "bearish"

CHECK R0B: Is condition text correct?
  bullish → rows[0].condition must = "Broad Participation — Rally Has Legs"
  neutral → rows[0].condition must = "Mixed Breadth — Bifurcated Market"
  bearish → rows[0].condition must = "Breadth Breakdown — Risk Off"

CHECK R0C: Does the note field reference the $MMTH value?
  PASS = card.note contains the MMTH_VAL number (e.g., "52.5%")
  NOTE if absent — note may still be valid but doesn't surface the key number

---

## STEP 6 — Row 1: NYSE 50d Breadth ($MMFI)

IF MMFI_UNAVAILABLE = true:
  CHECK R1A: rows[1].status must = "neutral"
  CHECK R1B: rows[1].condition must = "Awaiting Data"
  Mark remaining R1 checks as NOTE

Otherwise, using MMFI_VAL:

CHECK R1A: Is status correct?
  MMFI_VAL >= 70  → rows[1].status must = "bullish"
  MMFI_VAL >= 40  → rows[1].status must = "neutral"
  MMFI_VAL < 40   → rows[1].status must = "bearish"

CHECK R1B: Is condition text correct?
  bullish → rows[1].condition must = "Momentum Expanding — Add Risk"
  neutral → rows[1].condition must = "Mixed Momentum — Watch Leaders"
  bearish → rows[1].condition must = "Momentum Fading — Tighten Stops"

CHECK R1C: Divergence note — compare $MMTH and $MMFI zones:
  Both available → NOTE their relationship:
    Both >= 70      → "Full breadth confirmation"
    Both < 40       → "Full breadth breakdown"
    MMFI < MMTH zone → "MMFI leading deterioration — early warning"
    MMFI > MMTH zone → "MMFI leading recovery — watch for MMTH follow"
    Same zone       → "Breadth aligned"
  This is informational — not a PASS/FAIL check.

---

## STEP 7 — Row 2: Sector Check

IF SECTOR_INSUFFICIENT = true (TOTAL_COUNT < 7 or value = "—"):
  CHECK R2A: rows[2].status must = "neutral"
  CHECK R2B: rows[2].condition must = "Insufficient Data"
  Mark remaining R2 checks as NOTE

Otherwise, using BULL_COUNT and TOTAL_COUNT:

CHECK R2A: Is status correct?
  BULL_COUNT >= 8  → rows[2].status must = "bullish"
  BULL_COUNT >= 5  → rows[2].status must = "neutral"  (5 to 7)
  BULL_COUNT < 5   → rows[2].status must = "bearish"

CHECK R2B: Is condition text correct?
  bullish → rows[2].condition must = "Broad Participation — Stay Long"
  neutral → rows[2].condition must = "Mixed Breadth — Be Selective"
  bearish → rows[2].condition must = "Sector Breakdown — Reduce Risk"

CHECK R2C: Does the value format match "X / 11"?
  PASS = value contains two numbers separated by " / "
  NOTE the total (should be 11 when all sectors have valid data; may be lower if some unavailable)

CHECK R2D: Cross-reference sectorTable count vs row value:
  Count the entries in card.sectorTable where bull = true
  Compare to BULL_COUNT from the row value
  PASS = counts match
  FAIL = counts differ by more than 1 (rounding/filtering difference acceptable)

---

## STEP 8 — Row 3: Consumer Signal (RSPD vs 200d)

IF RSPD_UNAVAILABLE = true: mark all R3 checks as NOTE

Otherwise:

CHECK R3A: Is the condition text one of the two expected values?
  "Above 200d — Consumer Healthy" → status should = "bullish"
  "Below 200d — Risk Rising"      → status should = "bearish"
  FAIL if condition is any other string

CHECK R3B: Does rows[3].status match the condition?
  "Above 200d" → status must = "bullish"
  "Below 200d" → status must = "bearish"
  FAIL if status contradicts condition text

CHECK R3C: Cross-verify RSPD vs its 200d SMA via Yahoo Finance
  Fetch: GET https://query1.finance.yahoo.com/v8/finance/chart/RSPD?interval=1d&range=300d
  Extract current price: meta.regularMarketPrice
  Calculate SMA200 from the last 200 daily closes
  Compare direction:
    IF RSPD_PRICE > SMA200 → condition should contain "Above 200d" and status = "bullish"
    IF RSPD_PRICE < SMA200 → condition should contain "Below 200d" and status = "bearish"
  PASS = Yahoo-computed direction matches the card
  FAIL = direction mismatch

---

## STEP 9 — Sector Table Validation

Using card.sectorTable (if present and non-empty):

CHECK T1: Does sectorTable contain entries for all 11 expected tickers?
  Expected tickers: XLK, XLV, XLF, XLI, XLC, XLY, XLP, XLE, XLU, XLRE, XLB
  PASS = all 11 tickers present
  NOTE = list any missing tickers (may be unavailable in Yahoo/D1)

CHECK T2: Spot-check one bullish sector (highest vs200) against Yahoo Finance
  Take the sector with the highest vs200 from sectorTable (e.g., XLK)
  Fetch: GET https://query1.finance.yahoo.com/v8/finance/chart/[TICKER]?interval=1d&range=300d
  Verify direction (above or below 200d SMA) matches sectorTable[n].bull
  PASS = direction consistent
  FAIL = direction mismatch

CHECK T3: Spot-check one bearish sector (lowest vs200) against Yahoo Finance
  Take the sector with the lowest (most negative) vs200 from sectorTable
  Same verification as T2
  PASS = direction consistent

CHECK T4: Does the BULL_COUNT in row 2 match sectorTable entries where bull = true?
  (Same as R2D — verify consistency between the row display and the sectorTable data)
  PASS = counts agree (within 1)

---

## STEP 10 — Card Status Logic

Card 3 uses standard majority-wins across all 4 rows. No override rules.

Count statuses from rows[0..3]:
  BULLISH_COUNT = rows with status = "bullish"
  BEARISH_COUNT = rows with status = "bearish"

  IF BULLISH_COUNT > BEARISH_COUNT → card.status = "bullish"
  IF BEARISH_COUNT > BULLISH_COUNT → card.status = "bearish"
  IF equal or all neutral           → card.status = "neutral"

CHECK C1: Does card.status match the majority-wins result?
  PASS = card status matches your calculated result
  FAIL = card status does not match

NOTE: When $MMTH and $MMFI are unavailable (both neutral), card status is
determined by Sector Check and Consumer Signal only. This is valid fallback
behaviour — flag if D1 market_breadth is unavailable but card is not
reporting a graceful degraded state.

---

## STEP 11 — Delta Field

CHECK D1: Is the `delta` field present on the card?
  Expected values: "up" | "down" | "same"
  PASS = field exists and contains one of these three values

---

## REPORT FORMAT

Produce your findings in this format:

### Card 03 Breadth — QA Results [DATE]

| Check | Description | Result | Notes |
|-------|-------------|--------|-------|
| F1  | Timestamp freshness | PASS/FAIL | |
| F2  | Source field valid | PASS/FAIL | Value: d1/yahoo/d1+yahoo |
| S1  | Row count = 4 | PASS/FAIL | |
| S2  | Row labels correct | PASS/FAIL | |
| S3  | Row indicators correct | PASS/FAIL | |
| S4  | Note field present | PASS/FAIL | |
| S5  | sectorTable present | PASS/FAIL/NOTE | Count: X entries |
| R0A | Row 0 ($MMTH) status | PASS/FAIL/NOTE | MMTH: X% |
| R0B | Row 0 condition text | PASS/FAIL/NOTE | |
| R0C | Note references MMTH value | PASS/NOTE | |
| R1A | Row 1 ($MMFI) status | PASS/FAIL/NOTE | MMFI: X% |
| R1B | Row 1 condition text | PASS/FAIL/NOTE | |
| R1C | MMTH/MMFI divergence | NOTE | [describe relationship] |
| R2A | Row 2 (Sector) status | PASS/FAIL/NOTE | Bull: X / Total: X |
| R2B | Row 2 condition text | PASS/FAIL/NOTE | |
| R2C | Row 2 value format | PASS/FAIL | |
| R2D | Row 2 count vs sectorTable | PASS/FAIL | Row: X, Table: X |
| R3A | Row 3 (RSPD) condition valid | PASS/FAIL/NOTE | |
| R3B | Row 3 status matches condition | PASS/FAIL/NOTE | CRITICAL |
| R3C | RSPD direction vs Yahoo | PASS/FAIL/NOTE | Hub: X, Yahoo SMA: $X |
| T1  | sectorTable has all 11 tickers | PASS/NOTE | Missing: [list] |
| T2  | Top sector direction vs Yahoo | PASS/FAIL/NOTE | Ticker: X, Hub: bull/bear |
| T3  | Bottom sector direction vs Yahoo | PASS/FAIL/NOTE | Ticker: X, Hub: bull/bear |
| T4  | sectorTable bull count consistent | PASS/FAIL | Table: X, Row: X |
| C1  | Card status majority-wins | PASS/FAIL | Bull:X Bear:X Neu:X |
| D1  | Delta field present | PASS/FAIL | Value: up/down/same |

### Breadth Data Availability
  - $MMTH available: true / false (X%)
  - $MMFI available: true / false (X%)
  - Sector ETFs available: X / 11
  - RSPD available: true / false

### Divergence Analysis
  $MMTH zone: Bullish (≥70%) / Neutral (40–69%) / Bearish (<40%)
  $MMFI zone: Bullish (≥70%) / Neutral (40–69%) / Bearish (<40%)
  Signal: [Full confirmation / Full breakdown / MMFI leading deterioration / MMFI leading recovery / Aligned]

### Summary
- Total checks: 25
- Passed: X
- Failed: X
- N/A: X
- Notes: [anything unexpected]

### Critical Flags (fail-stop issues)
List any FAIL for: R3B (RSPD direction), C1 (card status), R2D/T4 (sector count mismatch)
If $MMTH and $MMFI are both unavailable, flag as infrastructure gap
(D1 market_breadth table not seeded) — this degrades Card 3 significantly
since the two most important rows are absent.
