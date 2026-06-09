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
  NOTE the value.

---

## STEP 3 — Card Structure Check

CHECK S1: Does the card have exactly 4 rows?
  Expected: rows[0], rows[1], rows[2], rows[3]
  FAIL if fewer or more rows exist

CHECK S2: Do the row labels match exactly?
  rows[0].label = "Risk Appetite"
  rows[1].label = "Spread Signal"
  rows[2].label = "IG Demand"
  rows[3].label = "Global Credit"

CHECK S3: Do the row indicators match exactly?
  rows[0].indicator = "HYG — High Yield Corp Bond ETF"
  rows[1].indicator = "HYG vs LQD — HY vs IG (200d basis)"
  rows[2].indicator = "LQD — Investment Grade Bond ETF"
  rows[3].indicator = "EMB — EM USD Bond ETF (JP Morgan)"

CHECK S4: Is the `note` field present and non-empty on the card?
  PASS = card.note exists and contains text about "200d" or "stress"
  FAIL = note field missing or empty

---

## STEP 4 — Parse Raw Values from Row Display Strings

Row 0 value format: "US$XX.XX<br>vs200 +X.X%" or just "US$XX.XX" or "—"
  → Extract: HYG_PRICE (strip "US$") and HYG_VS200 (strip "vs200 " and "%", keep sign)
  → If value = "—": mark HYG_UNAVAILABLE = true

Row 1 value format: "HYG +X.X%<br>LQD +X.X%" or "—"
  → Extract: HYG_VS200_ROW1 and LQD_VS200_ROW1 (signed percentages)
  → If value = "—": mark SPREAD_UNAVAILABLE = true

Row 2 value format: "US$XX.XX<br>vs200 +X.X%" or just "US$XX.XX" or "—"
  → Extract: LQD_PRICE and LQD_VS200 (same format as Row 0)
  → If value = "—": mark LQD_UNAVAILABLE = true

Row 3 value format: "US$XX.XX<br>vs200 +X.X%" or just "US$XX.XX" or "—"
  → Extract: EMB_PRICE and EMB_VS200 (same format as Row 0)
  → If value = "—": mark EMB_UNAVAILABLE = true

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
  If HYG above 200d → note must contain "above 200d"
  If HYG below 200d → note must contain "below 200d" and "4–6 weeks"

---

## STEP 6 — Row 1: Spread Signal (HYG vs LQD — 200d basis)

IF SPREAD_UNAVAILABLE = true: mark all R1 checks as NOTE

Otherwise, using HYG_VS200_ROW1 and LQD_VS200_ROW1:

Compute: SPREAD = HYG_VS200_ROW1 - LQD_VS200_ROW1

CHECK R1A: Is status correct?
  SPREAD > 0  → rows[1].status must = "bullish"  (HY outperforming IG)
  SPREAD <= 0 → rows[1].status must = "bearish"  (IG outperforming HY)
  (null → "neutral")

CHECK R1B: Is condition text correct?
  bullish → rows[1].condition must = "HY Outperforming IG — Rate-Driven"
  bearish → rows[1].condition must = "IG Outperforming HY — Credit-Driven"

CHECK R1C: CONSISTENCY — does the spread sign agree with the status?
  If HYG_VS200_ROW1 > LQD_VS200_ROW1 → status must be "bullish" not "bearish"
  If HYG_VS200_ROW1 < LQD_VS200_ROW1 → status must be "bearish" not "bullish"
  FAIL if status contradicts the parsed spread values

CHECK R1D: Cross-reference Row 0 and Row 1 — note the investment implication:
  Row 0 bearish + Row 1 bullish → Rate-Driven stress (less severe)
  Row 0 bearish + Row 1 bearish → Credit-Driven stress (most severe)
  Row 0 bullish + Row 1 bearish → Mild caution only (HYG still healthy)
  NOTE this combination in your report — it is the key diagnostic.

---

## STEP 7 — Row 2: IG Demand (LQD vs 200d)

IF LQD_UNAVAILABLE = true: mark all R2 checks as NOTE

Otherwise, using LQD_VS200:

CHECK R2A: Is status correct?
  LQD_VS200 > 0  → rows[2].status must = "bullish"
  LQD_VS200 <= 0 → rows[2].status must = "bearish"
  (null → "neutral")

CHECK R2B: Is condition text correct?
  bullish → rows[2].condition must = "Above 200d — IG Demand Firm"
  bearish → rows[2].condition must = "Below 200d — IG Demand Weak"

---

## STEP 8 — Row 3: Global Credit (EMB vs 200d)

IF EMB_UNAVAILABLE = true: mark all R3 checks as NOTE

Otherwise, using EMB_VS200:

CHECK R3A: Is status correct?
  EMB_VS200 > 0  → rows[3].status must = "bullish"
  EMB_VS200 <= 0 → rows[3].status must = "bearish"
  (null → "neutral")

CHECK R3B: Is condition text correct with the 3-tier bearish graduation?
  bullish                       → "Above 200d — EM Credit Stable"
  bearish AND EMB_VS200 >= -2   → "Below 200d — Monitor EM Risk"
  bearish AND EMB_VS200 >= -5   → "Below 200d — Stress Spreading"
  bearish AND EMB_VS200 < -5    → "Below 200d — Contagion Risk"

CHECK R3C: Does EMB_VS200 agree with the condition tier?
  e.g. if EMB_VS200 = -6.2%, condition must contain "Contagion" not "Monitor"
  FAIL if the tier and the actual vs200 value don't match

---

## STEP 9 — Card Status Logic

Card 6 uses a bull-count rule (not standard majority-wins):
  bull = count of rows where status = "bullish" across rows[0..3]

  bull >= 3 → card.status = "bullish"
  bull >= 2 → card.status = "neutral"
  bull <= 1 → card.status = "bearish"

There is NO override rule on Card 6 — all rows count equally.

CHECK C1: Count bullish rows from rows[0..3] and verify card.status matches:
  bull = 0 → "bearish"
  bull = 1 → "bearish"
  bull = 2 → "neutral"
  bull = 3 → "bullish"
  bull = 4 → "bullish"
  PASS = card.status matches your calculated result
  FAIL = card.status does not match

---

## STEP 10 — Cross-Reference via Yahoo Finance

Fetch HYG and LQD from Yahoo Finance (300d range for SMA200 calculation):
  GET https://query1.finance.yahoo.com/v8/finance/chart/HYG?interval=1d&range=300d
  GET https://query1.finance.yahoo.com/v8/finance/chart/LQD?interval=1d&range=300d

From each response:
  - Extract current price: meta.regularMarketPrice
  - Calculate SMA200 from the last 200 closing prices
  - Calculate vs200: ((price - SMA200) / SMA200) * 100

CHECK X1: Does HYG price from Market Hub match Yahoo price?
  Allow ±$0.05 tolerance
  PASS = prices match; FAIL = diverge by more than $0.05

CHECK X2: Does HYG vs200 direction (above/below 200d) match Yahoo calculation?
  PASS = both agree on above or below
  FAIL = Market Hub says above, Yahoo calculation says below, or vice versa

CHECK X3: Does LQD vs200 direction match Yahoo calculation?
  Same ±0.5% tolerance for percentage values
  PASS = direction consistent; FAIL = direction mismatch

CHECK X4: Does the computed SPREAD (HYG.vs200 - LQD.vs200) from Yahoo agree
  with the spread direction shown in Row 1?
  PASS = both positive or both negative
  FAIL = Yahoo spread is positive but card shows "Credit-Driven" (or vice versa)

---

## STEP 11 — Delta Field

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
| F2  | Source field valid | PASS/FAIL | Value: d1/yahoo/d1+yahoo |
| S1  | Row count = 4 | PASS/FAIL | |
| S2  | Row labels correct | PASS/FAIL | |
| S3  | Row indicators correct | PASS/FAIL | |
| S4  | Note field present | PASS/FAIL | |
| R0A | Row 0 (HYG) status | PASS/FAIL/NOTE | HYG vs200: X% |
| R0B | Row 0 condition text | PASS/FAIL/NOTE | |
| R0C | Note reflects HYG status | PASS/FAIL/NOTE | |
| R1A | Row 1 (Spread) status | PASS/FAIL/NOTE | HYG: X%, LQD: X%, Spread: X% |
| R1B | Row 1 condition text | PASS/FAIL/NOTE | |
| R1C | Spread sign consistent | PASS/FAIL/NOTE | CRITICAL |
| R1D | Stress type noted | NOTE | Rate-Driven / Credit-Driven / N-A |
| R2A | Row 2 (LQD) status | PASS/FAIL/NOTE | LQD vs200: X% |
| R2B | Row 2 condition text | PASS/FAIL/NOTE | |
| R3A | Row 3 (EMB) status | PASS/FAIL/NOTE | EMB vs200: X% |
| R3B | Row 3 condition tier | PASS/FAIL/NOTE | |
| R3C | EMB tier vs actual value | PASS/FAIL/NOTE | |
| C1  | Card status (bull count) | PASS/FAIL | Bull: X, Status: X |
| X1  | HYG price vs Yahoo | PASS/FAIL | Hub: $X, Yahoo: $X |
| X2  | HYG above/below direction | PASS/FAIL | |
| X3  | LQD direction vs Yahoo | PASS/FAIL | |
| X4  | Spread direction vs Yahoo | PASS/FAIL | CRITICAL |
| D1  | Delta field present | PASS/FAIL | Value: up/down/same |

### Stress Diagnosis Summary
  - HYG status:   Above 200d / Below 200d (vs200: X%)
  - LQD status:   Above 200d / Below 200d (vs200: X%)
  - HY–IG Spread: +X% (Rate-Driven) or −X% (Credit-Driven)
  - Signal:       No Stress / Rate-Driven / Credit-Driven
  - EMB severity: Stable / Monitor / Stress Spreading / Contagion Risk

### Summary
- Total checks: 23
- Passed: X
- Failed: X
- N/A: X
- Notes: [anything unexpected not covered by a specific check]

### Critical Flags (fail-stop issues)
List any FAIL for: R1C (spread sign consistency), X4 (spread direction vs Yahoo), C1 (card status)
These indicate logic bugs. R1C in particular is the most important check on this card —
a wrong spread direction would misclassify rate-driven stress as credit-driven or vice versa,
giving investors the wrong action signal.
