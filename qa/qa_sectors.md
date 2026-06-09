# QA Test: Card 08 — Sectors ("The Rotation")
# Market Hub — loganbase.com/market-hub

## Your Role
You are a QA reviewer for the Market Hub dashboard. You have no prior context.
Run every check below in order. Report PASS / FAIL / NOTE for each item.
At the end, produce a summary table of results.

---

## STEP 1 — Fetch the Scores API

Fetch: GET https://www.loganbase.com/api/scores

From the JSON response:
- Locate the card where `id = "sectors"` (Card 08)
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

---

## STEP 3 — Card Structure Check

CHECK S1: Does the card have exactly 6 rows?
  The card shows top 3 leaders + bottom 3 laggards = 6 rows total.
  FAIL if fewer than 4 or more than 6 rows exist

CHECK S2: Are all row indicators valid SPDR sector tickers?
  Expected tickers (any 6 of): XLK, XLY, XLC, XLI, XLF, XLE, XLB, XLV, XLP, XLU, XLRE
  PASS = all row indicators are from this set
  FAIL = any ticker not in the expected list

CHECK S3: Are there no duplicate tickers across rows?
  PASS = all 6 row indicators are unique
  FAIL = any ticker appears more than once

CHECK S4: Is the `note` field present and non-empty?
  PASS = card.note exists and contains text about "spread" or "cyclical" or "defensive"
  FAIL = note missing or empty

---

## STEP 4 — Parse Spread Value and Sector Rankings

The card status is based on the 20d relative performance spread (cyclicals avg − defensives avg).
This value is embedded in the note field.

Extract from card.note:
  SPREAD_VAL = the signed percentage value in the note
    e.g., "−0.7% spread" → SPREAD_VAL = −0.7
    e.g., "Cyclicals outpacing defensives by +2.3%" → SPREAD_VAL = +2.3
    e.g., "Defensives outpacing cyclicals by 1.8%" → SPREAD_VAL = −1.8

Identify the top 3 and bottom 3 rows by relPerf:
  TOP_3_ROWS    = rows[0..2] (first 3 rows — leaders by relPerf, all status = "bullish")
  BOTTOM_3_ROWS = rows[3..5] (last 3 rows — laggards by relPerf, all status = "bearish")

NOTE: The condition text contains the relPerf value in parentheses, e.g.,
  "Leader (+4.9% vs SPY) — Overweight" → relPerf = +4.9%
  "Trend Broken (−4.4% vs SPY) — Underweight" → relPerf = −4.4%

Extract relPerf values from condition text for all 6 rows.
Verify top 3 have higher relPerf than bottom 3.

CHECK P1: Are the top 3 rows ranked by decreasing relPerf?
  rows[0].relPerf >= rows[1].relPerf >= rows[2].relPerf
  PASS = order is correct (ties acceptable)
  FAIL = out of order (e.g., rows[1].relPerf > rows[0].relPerf)

CHECK P2: Are the bottom 3 rows the actual lowest relPerf sectors?
  rows[3].relPerf <= rows[4].relPerf <= rows[5].relPerf (most negative last)
  NOTE: The sort is ascending for bottom rows (least negative first)
  PASS = order is consistent (all bottom row relPerfs < top row relPerfs)

---

## STEP 5 — Row Status Validation

*** CRITICAL RULE ***
Top 3 rows (leaders) ALWAYS display status = "bullish" (card display convention)
Bottom 3 rows (laggards) ALWAYS display status = "bearish" (card display convention)
This is true REGARDLESS of whether the sector is cyclical or defensive.

CHECK R1: Do rows[0..2] all have status = "bullish"?
  PASS = all three leader rows show "bullish"
  FAIL = any leader row shows "neutral" or "bearish"

CHECK R2: Do rows[3..5] all have status = "bearish"?
  PASS = all three laggard rows show "bearish"
  FAIL = any laggard row shows "bullish" or "neutral"

---

## STEP 6 — Condition Text Logic

For each row, verify the condition text is consistent with the sector type
and the relPerf direction. Extract sector type from the ticker:

  CYCLICALS:  XLK, XLY, XLC, XLI, XLF, XLE, XLB
  DEFENSIVES: XLV, XLP, XLU, XLRE

For CYCLICAL sectors, expected condition patterns (based on structure + relPerf):
  "Leader" — sector is above 200d AND relPerf > 0
  "In Trend, Lagging" — sector is above 200d AND relPerf < 0
  "Below 200d, Outpacing SPY" — sector is below 200d AND relPerf > 0
  "Trend Broken" — sector is below 200d AND relPerf < 0

For DEFENSIVE sectors, expected condition patterns:
  "Safe Haven Bid" — sector outperforming SPY (relPerf > 0) AND above 200d
  "Quiet Defensive" — sector lagging SPY (relPerf < 0) AND above 200d
  "No Safe Haven Bid" — sector below 200d

CHECK R3: For each of the 6 rows, is the condition text keyword consistent
  with the sector type and relPerf sign?

  For cyclicals:
    relPerf > 0 AND above trend → must contain "Leader"
    relPerf < 0 AND above trend → must contain "Lagging"
    relPerf > 0 AND below trend → must contain "Outpacing"
    relPerf < 0 AND below trend → must contain "Broken"

  For defensives:
    relPerf > 0 AND above trend → must contain "Safe Haven"
    relPerf < 0 AND above trend → must contain "Quiet Defensive"
    below trend (any relPerf)   → must contain "No Safe Haven"

  PASS = all 6 rows have consistent condition keywords
  FAIL = any row has a condition keyword that contradicts its type/relPerf

  NOTE: You cannot directly verify "above/below 200d" from the API response
  alone (the row value only shows price, not SMA). The condition text itself
  is the primary verification source — if it says "Leader" the sector must
  be above 200d; if it says "Trend Broken" it must be below 200d.

CHECK R4: DEFENSIVE SAFE HAVEN WARNING — if any defensive sector is in the top 3
  rows with condition "Safe Haven Bid", is this flagged appropriately?
  NOTE = document which defensive sector is in the leader rows and what its
  condition text says. A defensive sector in the top 3 is a risk-off warning
  signal embedded in a "bullish" row — important context for the user.

---

## STEP 7 — Card Status Logic

Card 8 uses a spread-based status (NOT majority-wins):

  IF SPREAD_VAL > +1.0%  → card.status must = "bullish"
  IF SPREAD_VAL < −1.0%  → card.status must = "bearish"
  IF −1.0% <= SPREAD_VAL <= +1.0% → card.status must = "neutral"

CHECK C1: Does card.status match the spread-based threshold?
  Using SPREAD_VAL parsed from note in Step 4:
  PASS = card.status matches the threshold rule above
  FAIL = card.status does not match
  NOTE: The spread in the note is rounded to 1 decimal; allow ±0.05% rounding tolerance
  at the ±1.0% boundary.

CHECK C2: Does the note describe the spread correctly?
  If status = "bullish" → note must contain "Cyclicals outpacing"
  If status = "bearish" → note must contain "Defensives outpacing"  
  If status = "neutral" → note must contain "near parity"
  PASS = note language matches the status
  FAIL = note contradicts the status

---

## STEP 8 — Cross-Reference Top Sector vs Yahoo Finance

Take the ticker from rows[0] (the top-ranked sector by relPerf).
Fetch from Yahoo Finance to independently verify it is outperforming SPY.

Fetch: GET https://query1.finance.yahoo.com/v8/finance/chart/[TICKER]?interval=1d&range=30d
Fetch: GET https://query1.finance.yahoo.com/v8/finance/chart/SPY?interval=1d&range=30d

From each response:
  Extract meta.regularMarketPrice (current price)
  Extract closes from approximately 20 trading days ago (close 20 entries from end)
  Compute 20d return: (current / close_20d_ago − 1) × 100
  Compute relPerf vs SPY: sector_20d_return − spy_20d_return

CHECK X1: Does the sector's 20d return vs SPY from Yahoo agree in sign with the
  relPerf extracted from the condition text in rows[0]?
  PASS = both positive (sector outperforming SPY) or both negative
  FAIL = sign mismatch (Yahoo says sector lagging but card shows it as leader)
  Allow ±1% tolerance for timing/calculation differences

CHECK X2: Does the top sector's current price from Yahoo match rows[0].value?
  Allow ±$0.10 tolerance
  PASS = prices consistent
  FAIL = prices diverge by more than $0.10

---

## STEP 9 — Delta Field

CHECK D1: Is the `delta` field present on the card?
  Expected values: "up" | "down" | "same"
  PASS = field exists and contains one of these three values

---

## REPORT FORMAT

Produce your findings in this format:

### Card 08 Sectors — QA Results [DATE]

| Check | Description | Result | Notes |
|-------|-------------|--------|-------|
| F1  | Timestamp freshness | PASS/FAIL | |
| F2  | Source field valid | PASS/FAIL | Value: d1/yahoo/d1+yahoo |
| S1  | Row count 4–6 | PASS/FAIL | Count: X |
| S2  | All tickers valid SPDR sectors | PASS/FAIL | |
| S3  | No duplicate tickers | PASS/FAIL | |
| S4  | Note field present | PASS/FAIL | |
| P1  | Top 3 rows ranked by relPerf | PASS/FAIL | |
| P2  | Bottom 3 rows ranked by relPerf | PASS/FAIL | |
| R1  | Leader rows all "bullish" | PASS/FAIL | CRITICAL |
| R2  | Laggard rows all "bearish" | PASS/FAIL | CRITICAL |
| R3  | Condition text consistent | PASS/FAIL | List any mismatches |
| R4  | Defensive safe haven warning | NOTE | [describe if present] |
| C1  | Card status matches spread | PASS/FAIL | Spread: X%, Status: X |
| C2  | Note language matches status | PASS/FAIL | |
| X1  | Top sector relPerf sign vs Yahoo | PASS/FAIL | Ticker: X, Hub: X%, Yahoo: X% |
| X2  | Top sector price vs Yahoo | PASS/FAIL | Hub: $X, Yahoo: $X |
| D1  | Delta field present | PASS/FAIL | Value: up/down/same |

### Rotation Summary
  - Spread (Cyc avg − Def avg, 20d vs SPY): X%
  - Card status: Bullish / Neutral / Bearish
  - Top 3 leaders: [Ticker (Type): relPerf%], [Ticker (Type): relPerf%], [Ticker (Type): relPerf%]
  - Bottom 3 laggards: [Ticker (Type): relPerf%], [Ticker (Type): relPerf%], [Ticker (Type): relPerf%]
  - Defensive sector in top 3: Yes/No — [if yes: sector, condition text]
  - Investment signal: [Risk-On / Near Parity / Risk-Off / Defensive Warning]

### Summary
- Total checks: 17
- Passed: X
- Failed: X
- N/A: X
- Notes: [anything unexpected]

### Critical Flags (fail-stop issues)
List any FAIL for: R1 (leader rows not bullish), R2 (laggard rows not bearish), C1 (spread-based status)
The most important check is C1 — the spread calculation drives the card status and must
match the threshold rule exactly.
If a defensive sector appears in top 3 leaders with "Safe Haven Bid" condition, flag
this prominently in the Rotation Summary even though it is not a FAIL condition.
