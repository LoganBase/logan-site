# QA Test: Card 06 — Credit ("The Risk Canary")
# Market Hub — loganbase.com/market-hub

## Your Role
You are a QA reviewer for the Market Hub dashboard. You have no prior context.
Run every check below in order. Report PASS / FAIL / NOTE for each item.
At the end, produce a summary table of results.

---

## STEP 1 — Fetch the Scores API

Fetch: GET https://www.loganbase.com/api/scores

From the JSON response:
- Locate the card where `id = "credit"` (Card 06)
- Extract the full card object including: `status`, `rows[]`, `stats[]`, `delta`, `note`
- Also extract: `timestamp` and `source` from the top-level response

---

## STEP 2 — Freshness & Source Check

CHECK F1: Is `timestamp` from today's date (UTC)?
  PASS = timestamp date matches today
  FAIL = timestamp is stale (yesterday or older)

CHECK F2: Is the top-level `source` field present and valid?
  Expected values: "d1" | "yahoo" | "d1+yahoo"
  PASS = field exists and contains one of these three values
  NOTE the value.

---

## STEP 3 — Card Structure Check

CHECK S1: Does the card have exactly 4 rows?
  Expected: rows[0], rows[1], rows[2], rows[3]
  FAIL if fewer or more rows exist

CHECK S2: Do the row labels match exactly?
  rows[0].label = "Risk Appetite"
  rows[1].label = "Credit Quality"
  rows[2].label = "Global Credit"
  rows[3].label = "Spread Signal"
  NOTE: rows[0–2] are the 3 KPI tiles shown on the summary card.
        rows[3] (Spread Signal) is only shown in the deep dive Indicators table.

CHECK S3: Do the row indicators match exactly?
  rows[0].indicator = "HYG — High Yield Corp Bond ETF"
  rows[1].indicator = "LQD — Investment Grade Bond ETF"
  rows[2].indicator = "EMB — EM USD Bond ETF (JP Morgan)"
  rows[3].indicator = "HYG vs LQD — HY vs IG (200d basis)"

CHECK S4: Is the `note` field present and non-empty on the card?
  PASS = card.note exists and contains text about "200d" or "stress"
  FAIL = note field missing or empty

CHECK S5: Does the card have a `stats` array with exactly 9 entries?
  stats[0..2] = vs200% boxes (HYG, LQD, EMB)
  stats[3..5] = Days in Zone boxes (HYG, LQD, EMB)
  stats[6..8] = Ext. Velocity boxes (HYG, LQD, EMB)
  FAIL if stats is missing or length ≠ 9

---

## STEP 4 — Parse Raw Values from Row Display Strings

Row 0 value format: "HYG +X.X%<br>$XX.XX" or just "$XX.XX" or "—"
  → Extract: HYG_VS200 (signed percentage from first line, e.g. "+1.8%")
  → Extract: HYG_PRICE (dollar value from second line)
  → If value = "—": mark HYG_UNAVAILABLE = true

Row 1 value format: "LQD +X.X%<br>$XX.XX" or just "$XX.XX" or "—"
  → Extract: LQD_VS200 and LQD_PRICE
  → If value = "—": mark LQD_UNAVAILABLE = true

Row 2 value format: "EMB +X.X%<br>$XX.XX" or just "$XX.XX" or "—"
  → Extract: EMB_VS200 and EMB_PRICE
  → If value = "—": mark EMB_UNAVAILABLE = true

Row 3 value format: "HYG +X.X%<br>LQD +X.X%" or "—"
  → Extract: HYG_VS200_ROW3 and LQD_VS200_ROW3 (signed percentages)
  → If value = "—": mark SPREAD_UNAVAILABLE = true

CHECK P1: Do HYG_VS200 (from rows[0]) and HYG_VS200_ROW3 (from rows[3]) match?
  Allow ±0.1% rounding tolerance
  FAIL if they diverge — both are derived from the same underlying value

CHECK P2: Do LQD_VS200 (from rows[1]) and LQD_VS200_ROW3 (from rows[3]) match?
  Same tolerance
  FAIL if they diverge

---

## STEP 5 — Row 0: Risk Appetite (HYG vs 200d)

IF HYG_UNAVAILABLE = true: mark all R0 checks as NOTE

Otherwise, using HYG_VS200:

CHECK R0A: Is status correct?
  HYG_VS200 > 0  → rows[0].status must = "bullish"
  HYG_VS200 <= 0 → rows[0].status must = "bearish"
  (null/unavailable → status = "neutral")

CHECK R0B: Is condition text correct?
  bullish → rows[0].condition must = "Above 200d — Appetite Healthy"
  bearish → rows[0].condition must = "Below 200d — Risk Signal"

CHECK R0C: Does the note field reflect HYG's status?
  If HYG above 200d → note must contain "above its 200d"
  If HYG below 200d → note must contain "below its 200d" and "4–6 weeks"

---

## STEP 6 — Row 1: Credit Quality (LQD vs 200d)

IF LQD_UNAVAILABLE = true: mark all R1 checks as NOTE

Otherwise, using LQD_VS200:

CHECK R1A: Is status correct?
  LQD_VS200 > 0  → rows[1].status must = "bullish"
  LQD_VS200 <= 0 → rows[1].status must = "bearish"
  (null → "neutral")

CHECK R1B: Is condition text correct?
  bullish → rows[1].condition must = "Above 200d — Credit Quality Firm"
  bearish → rows[1].condition must = "Below 200d — Credit Quality Weak"

---

## STEP 7 — Row 2: Global Credit (EMB vs 200d)

IF EMB_UNAVAILABLE = true: mark all R2 checks as NOTE

Otherwise, using EMB_VS200:

CHECK R2A: Is status correct?
  EMB_VS200 > 0  → rows[2].status must = "bullish"
  EMB_VS200 <= 0 → rows[2].status must = "bearish"
  (null → "neutral")

CHECK R2B: Is condition text correct with the 3-tier bearish graduation?
  bullish                       → "Above 200d — EM Credit Stable"
  bearish AND EMB_VS200 >= -2   → "Below 200d — Monitor EM Risk"
  bearish AND EMB_VS200 >= -5   → "Below 200d — Stress Spreading"
  bearish AND EMB_VS200 < -5    → "Below 200d — Contagion Risk"

CHECK R2C: Does EMB_VS200 agree with the condition tier?
  e.g. if EMB_VS200 = -6.2%, condition must contain "Contagion" not "Monitor"
  FAIL if the tier and the actual vs200 value don't match

---

## STEP 8 — Row 3: Spread Signal (HYG vs LQD — 200d basis)

IF SPREAD_UNAVAILABLE = true: mark all R3 checks as NOTE

Otherwise, using HYG_VS200_ROW3 and LQD_VS200_ROW3:

Compute: SPREAD = HYG_VS200_ROW3 - LQD_VS200_ROW3

CHECK R3A: Is status correct?
  SPREAD > 0  → rows[3].status must = "bullish"  (HY outperforming IG)
  SPREAD <= 0 → rows[3].status must = "bearish"  (IG outperforming HY)
  (null → "neutral")

CHECK R3B: Is condition text correct?
  bullish → rows[3].condition must = "HY Outperforming IG — Rate-Driven"
  bearish → rows[3].condition must = "IG Outperforming HY — Credit-Driven"

CHECK R3C: CONSISTENCY — does the spread sign agree with the status?
  FAIL if status contradicts the parsed spread values (CRITICAL check)

CHECK R3D: Cross-reference Row 0 and Row 3 — note the investment implication:
  Row 0 bearish + Row 3 bullish → Rate-Driven stress (less severe)
  Row 0 bearish + Row 3 bearish → Credit-Driven stress (most severe)
  Row 0 bullish + Row 3 bearish → Mild caution only (HYG still healthy)
  NOTE this combination in your report — it is the key diagnostic.

---

## STEP 9 — Stats Boxes Validation

### Row 0 of stats — vs200% boxes (stats[0], stats[1], stats[2])

CHECK ST0: stats[0] label = "HYG vs 200d", value matches HYG_VS200 (±0.1%)
CHECK ST1: stats[1] label = "LQD vs 200d", value matches LQD_VS200 (±0.1%)
CHECK ST2: stats[2] label = "EMB vs 200d", value matches EMB_VS200 (±0.1%)

Tone check:
  vs200 > 0 → tone = "pos" (green)
  vs200 < 0 → tone = "neg" (red)

### Row 1 of stats — Days in Zone (stats[3], stats[4], stats[5])

These count consecutive trading days the ETF has been on its current side of the 200d SMA.
Values come from D1 and may lag the live price by 1 trading day.

CHECK ST3: stats[3] label = "HYG — Days in Zone", value format is "NNd" (e.g. "57d")
CHECK ST4: stats[4] label = "LQD — Days in Zone", value format is "NNd"
CHECK ST5: stats[5] label = "EMB — Days in Zone", value format is "NNd"

Trigger threshold interpretation (verify the description field):
  < 20d    → "200d SMA" zone desc, early regime warning
  20–60d   → established regime
  60–120d  → mature regime, mean-reversion risk
  > 120d   → extended regime, elevated reversion risk

NOTE: A recently crossed symbol (e.g. LQD with 6d) should show < 20d trigger messaging.

### Row 2 of stats — Extension Velocity (stats[6], stats[7], stats[8])

These show the 10-day price rate of change (roc10) from D1 for each ETF.
Values may lag live price by 1 trading day.

CHECK ST6: stats[6] label = "HYG — Ext. Velocity", value format is "+X.XX%" or "-X.XX%"
CHECK ST7: stats[7] label = "LQD — Ext. Velocity", value format is "+X.XX%" or "-X.XX%"
CHECK ST8: stats[8] label = "EMB — Ext. Velocity", value format is "+X.XX%" or "-X.XX%"

Trigger threshold interpretation:
  > +0.5%    → Accelerating away (green)
  0 to +0.5% → Slowly expanding (green)
  -0.5 to 0  → Decelerating (amber)
  < -0.5%    → Collapsing (red)

---

## STEP 10 — Card Status Logic

Card 06 uses a bull-count rule across the 4 indicator rows:
  bull = count of rows where status = "bullish" across rows[0..3]

  bull >= 3 → card.status = "bullish"
  bull >= 2 → card.status = "neutral"
  bull <= 1 → card.status = "bearish"

There is NO override rule on Card 06 — all 4 rows count equally.

CHECK C1: Count bullish rows from rows[0..3] and verify card.status matches:
  bull = 0 → "bearish"
  bull = 1 → "bearish"
  bull = 2 → "neutral"
  bull = 3 → "bullish"
  bull = 4 → "bullish"
  PASS = card.status matches your calculated result
  FAIL = card.status does not match

---

## STEP 11 — Cross-Reference via Yahoo Finance

Fetch HYG, LQD, and EMB from Yahoo Finance (300d range for SMA200 calculation):
  GET https://query1.finance.yahoo.com/v8/finance/chart/HYG?interval=1d&range=300d
  GET https://query1.finance.yahoo.com/v8/finance/chart/LQD?interval=1d&range=300d
  GET https://query1.finance.yahoo.com/v8/finance/chart/EMB?interval=1d&range=300d

From each response:
  - Extract current price: meta.regularMarketPrice
  - Calculate SMA200 from the last 200 closing prices
  - Calculate vs200: ((price - SMA200) / SMA200) * 100

CHECK X1: Does HYG price match Yahoo? Allow ±$0.05
CHECK X2: Does HYG vs200 direction (above/below) match Yahoo calculation?
CHECK X3: Does LQD vs200 direction match Yahoo calculation?
CHECK X4: Does EMB vs200 direction match Yahoo calculation?
CHECK X5: Does the computed SPREAD (HYG.vs200 - LQD.vs200) from Yahoo agree
  with the spread direction shown in rows[3]?
  PASS = both positive or both negative
  FAIL = Yahoo spread is positive but card shows "Credit-Driven" (or vice versa)

---

## STEP 12 — Delta Field

CHECK D1: Is the `delta` field present on the card?
  Expected values: "up" | "down" | "same"
  PASS = field exists and contains one of these three values

---

## REPORT FORMAT

Produce your findings in this format:

### Card 06 Credit — QA Results [DATE]

| Check | Description | Result | Notes |
|-------|-------------|--------|-------|
| F1  | Timestamp freshness | PASS/FAIL | |
| F2  | Source field valid | PASS/FAIL | Value: d1+yahoo / etc |
| S1  | Row count = 4 | PASS/FAIL | |
| S2  | Row labels correct | PASS/FAIL | |
| S3  | Row indicators correct | PASS/FAIL | |
| S4  | Note field present | PASS/FAIL | |
| S5  | Stats array = 9 entries | PASS/FAIL | |
| P1  | HYG_VS200 consistent rows 0 & 3 | PASS/FAIL | |
| P2  | LQD_VS200 consistent rows 1 & 3 | PASS/FAIL | |
| R0A | Row 0 (HYG) status | PASS/FAIL/NOTE | HYG vs200: X% |
| R0B | Row 0 condition text | PASS/FAIL/NOTE | |
| R0C | Note reflects HYG status | PASS/FAIL/NOTE | |
| R1A | Row 1 (LQD) status | PASS/FAIL/NOTE | LQD vs200: X% |
| R1B | Row 1 condition text | PASS/FAIL/NOTE | |
| R2A | Row 2 (EMB) status | PASS/FAIL/NOTE | EMB vs200: X% |
| R2B | Row 2 condition tier | PASS/FAIL/NOTE | |
| R2C | EMB tier vs actual value | PASS/FAIL/NOTE | |
| R3A | Row 3 (Spread) status | PASS/FAIL/NOTE | HYG: X%, LQD: X%, Spread: X% |
| R3B | Row 3 condition text | PASS/FAIL/NOTE | |
| R3C | Spread sign consistent | PASS/FAIL/NOTE | CRITICAL |
| R3D | Stress type noted | NOTE | Rate-Driven / Credit-Driven / N-A |
| ST0 | stats[0] HYG vs 200d value | PASS/FAIL | |
| ST1 | stats[1] LQD vs 200d value | PASS/FAIL | |
| ST2 | stats[2] EMB vs 200d value | PASS/FAIL | |
| ST3 | stats[3] HYG Days in Zone format | PASS/FAIL | e.g. 57d |
| ST4 | stats[4] LQD Days in Zone format | PASS/FAIL | |
| ST5 | stats[5] EMB Days in Zone format | PASS/FAIL | |
| ST6 | stats[6] HYG Ext. Velocity format | PASS/FAIL | e.g. +0.23% |
| ST7 | stats[7] LQD Ext. Velocity format | PASS/FAIL | |
| ST8 | stats[8] EMB Ext. Velocity format | PASS/FAIL | |
| C1  | Card status (bull count) | PASS/FAIL | Bull: X, Status: X |
| X1  | HYG price vs Yahoo | PASS/FAIL | Hub: $X, Yahoo: $X |
| X2  | HYG direction vs Yahoo | PASS/FAIL | |
| X3  | LQD direction vs Yahoo | PASS/FAIL | |
| X4  | EMB direction vs Yahoo | PASS/FAIL | |
| X5  | Spread direction vs Yahoo | PASS/FAIL | CRITICAL |
| D1  | Delta field present | PASS/FAIL | Value: up/down/same |

### Stress Diagnosis Summary
  - HYG status:   Above 200d / Below 200d (vs200: X%)
  - LQD status:   Above 200d / Below 200d (vs200: X%)
  - EMB status:   Stable / Monitor / Stress Spreading / Contagion Risk (vs200: X%)
  - HY–IG Spread: +X% (Rate-Driven) or −X% (Credit-Driven)
  - Signal:       No Stress / Rate-Driven / Credit-Driven
  - HYG zone:     Xd above/below 200d (Early / Established / Mature / Extended)
  - LQD zone:     Xd above/below 200d
  - EMB zone:     Xd above/below 200d

### Summary
- Total checks: 36
- Passed: X
- Failed: X
- N/A: X
- Notes: [anything unexpected not covered by a specific check]

### Critical Flags (fail-stop issues)
List any FAIL for: R3C (spread sign consistency), X5 (spread direction vs Yahoo), C1 (card status)
These indicate logic bugs. R3C in particular is the most important check on this card —
a wrong spread direction would misclassify rate-driven stress as credit-driven or vice versa,
giving investors the wrong action signal.
