# QA Test: Card 02 — Leadership ("The Quality Check")
# Market Hub — loganbase.com/market-hub

## Your Role
You are a QA reviewer for the Market Hub dashboard. You have no prior context.
Run every check below in order. Report PASS / FAIL / NOTE for each item.
At the end, produce a summary table of results.

---

## STEP 1 — Fetch the Scores API

Fetch: GET https://www.loganbase.com/api/scores

From the JSON response:
- Locate the card where `id = "leadership"` (Card 02)
- Extract the full card object including: `status`, `rows[]`, `delta`
- Also extract: `timestamp` from the top-level response

---

## STEP 2 — Freshness & Source Check

CHECK F1: Is `timestamp` from today's date (UTC)?
  PASS = timestamp date matches today
  FAIL = timestamp is stale (yesterday or older) — data has not refreshed

CHECK F2: Is the top-level `source` field present and valid?
  Extract: source from the top-level response (not inside a card)
  Expected values: "d1" | "yahoo" | "d1+yahoo"
  PASS = field exists and contains one of these three values
  NOTE the value — it tells you whether D1 is being used:
    "d1"      → All data served from Cloudflare D1 (fully seeded, ideal)
    "d1+yahoo" → Partial D1 coverage; some symbols still falling back to Yahoo Finance
    "yahoo"   → D1 binding absent or empty; all data live from Yahoo Finance

---

## STEP 3 — Card Structure Check

CHECK S1: Does the card have exactly 3 rows?
  Expected: rows[0], rows[1], rows[2]
  FAIL if fewer or more rows exist

CHECK S2: Do the row labels match exactly?
  rows[0].label = "Market Breadth"
  rows[1].label = "Tech Breadth"
  rows[2].label = "Style Bias"

CHECK S3: Do the row indicators match exactly?
  rows[0].indicator = "RSP vs SPY — 20d Return"
  rows[1].indicator = "QQEW vs QQQ — 20d Return"
  rows[2].indicator = "IVW vs IVE — 20d Return"

---

## STEP 4 — Parse Raw Values from Row Display Strings

The API returns formatted display strings. Parse them as follows:

Row 0 value format: "RSP X.X%<br>SPY X.X%" (ignore &nbsp; and HTML tags)
  → Extract: RSP_20D and SPY_20D (signed percentages, e.g. +3.2 and +1.8)

Row 1 value format: "QQEW X.X%<br>QQQ X.X%"
  → Extract: QQEW_20D and QQQ_20D

Row 2 value format: "IVW X.X%<br>IVE X.X%"
  → Extract: IVW_20D and IVE_20D

NOTE: If any pair is unavailable (value = "—"), mark the associated checks as N/A
and note it in the report.

---

## STEP 5 — Row 0: Market Breadth Logic (RSP vs SPY)

Using RSP_20D and SPY_20D from Step 4:

CHECK R0A: Is the spread direction correct?
  IF RSP_20D > SPY_20D → rows[0].status must = "bullish"
  IF RSP_20D < SPY_20D → rows[0].status must = "bearish"

CHECK R0B: Is condition text correct?
  IF bullish → rows[0].condition must contain "Breadth Expanding"
  IF bearish → rows[0].condition must contain "Rally Narrowing"

CHECK R0C: Does condition text match full expected string?
  Bullish: "Breadth Expanding — Add Broadly"
  Bearish: "Rally Narrowing — Stay with Leaders"

---

## STEP 6 — Row 1: Tech Breadth Logic (QQEW vs QQQ)

Using QQEW_20D and QQQ_20D from Step 4:

CHECK R1A: Is the spread direction correct?
  IF QQEW_20D > QQQ_20D → rows[1].status must = "bullish"
  IF QQEW_20D < QQQ_20D → rows[1].status must = "bearish"
  IF data unavailable   → rows[1].status must = "neutral"

CHECK R1B: Is condition text correct?
  IF bullish → rows[1].condition must contain "Tech Broadening"
  IF bearish → rows[1].condition must contain "Mega-Cap Driven"

CHECK R1C: Does condition text match full expected string?
  Bullish: "Tech Broadening — Tech Healthy"
  Bearish: "Mega-Cap Driven — Favour Large Cap"

---

## STEP 7 — Row 2: Style Bias Logic (IVW vs IVE)

Using IVW_20D and IVE_20D from Step 4:

*** CRITICAL RULE: Value leading maps to NEUTRAL, not BEARISH ***
This row can only ever be "bullish" or "neutral" — never "bearish".

CHECK R2A: Is the status correct?
  IF IVW_20D > IVE_20D → rows[2].status must = "bullish"
  IF IVE_20D > IVW_20D → rows[2].status must = "neutral"  ← NOT bearish
  IF data unavailable   → rows[2].status must = "neutral"

CHECK R2B: Is condition text correct?
  IF bullish → rows[2].condition must contain "Growth Leading"
  IF neutral (value leading) → rows[2].condition must contain "Value Rotating"

CHECK R2C: Does condition text match full expected string?
  Bullish: "Growth Leading — Risk-On"
  Neutral:  "Value Rotating — Reduce Growth"

CHECK R2D: Is rows[2].status ever "bearish"?
  FAIL if rows[2].status = "bearish" under any condition — this is a bug.
  Value leading must always produce "neutral", never "bearish".

---

## STEP 8 — Card Status Logic (Majority-Wins, No Override)

Unlike Card 01 (Regime), Card 02 has NO override rules. Status is
determined purely by majority across all three rows.

Count statuses across rows[0..2]:
  BULLISH_COUNT = number of rows with status = "bullish"
  BEARISH_COUNT = number of rows with status = "bearish"

Note: Row 2 (Style Bias) can never be bearish, so the maximum possible
BEARISH_COUNT from all 3 rows is 2 (from rows 0 and 1 only).

Expected card.status:
  IF BULLISH_COUNT > BEARISH_COUNT → card.status = "bullish"
  IF BEARISH_COUNT > BULLISH_COUNT → card.status = "bearish"
  IF equal or all neutral          → card.status = "neutral"

CHECK C1: Does card.status match the majority-wins result?
  PASS = card status matches your calculated majority
  FAIL = card status does not match

---

## STEP 9 — Cross-Reference via Leadership API

Fetch: GET https://www.loganbase.com/api/leadership?range=5y

From this response extract:
  summary.rspLeading   (boolean: true if RSP is outperforming SPY)
  summary.streak       (integer: positive = RSP winning, negative = RSP losing)
  summary.currentRspVsSpy   (cumulative RSP vs SPY spread over the period)
  summary.currentQqewVsQqq  (cumulative QQEW vs QQQ spread over the period)

CHECK L1: Does summary.rspLeading match rows[0].status?
  IF summary.rspLeading = true  → rows[0].status should = "bullish"
  IF summary.rspLeading = false → rows[0].status should = "bearish"
  NOTE: This cross-references the deep dive API against the card API.
  A mismatch may indicate a timing difference between the two calls — note but do not
  hard-fail if the data was fetched at different times.

CHECK L2: Is summary.streak a non-zero integer?
  PASS = streak is a non-zero positive or negative integer
  FAIL = streak is 0 or null (would indicate a calculation error)

CHECK L3: Does the sign of summary.streak align with summary.rspLeading?
  IF streak > 0 → rspLeading should = true  (RSP winning daily)
  IF streak < 0 → rspLeading should = false (RSP losing daily)

CHECK L4: Are currentRspVsSpy and currentQqewVsQqq present and numeric?
  PASS = both values are non-null numbers
  FAIL = either value is null or missing

---

## STEP 10 — Cross-Reference Prices vs Yahoo Finance

Fetch RSP and SPY from Yahoo Finance to independently verify the 20d returns:
  GET https://query1.finance.yahoo.com/v8/finance/chart/RSP?interval=1d&range=30d
  GET https://query1.finance.yahoo.com/v8/finance/chart/SPY?interval=1d&range=30d

From each response, calculate the 20-day return:
  RETURN_20D = (most recent close / close 20 trading days ago - 1) × 100

CHECK X1: Does the Yahoo-calculated RSP 20d return approximately match RSP_20D from the API?
  Allow ±0.5% tolerance (different closing dates or calculation method may cause small differences)
  PASS = values match within tolerance
  FAIL = values diverge by more than 0.5%

CHECK X2: Does the Yahoo-calculated SPY 20d return approximately match SPY_20D from the API?
  Same ±0.5% tolerance
  PASS = values match within tolerance
  FAIL = values diverge by more than 0.5%

NOTE: The Market Hub API falls back to daily changePct when 20-day price history is unavailable
in D1. If the values diverge significantly, note whether D1 is fully seeded or still using
the Yahoo Finance fallback — this is expected behavior, not a bug.

---

## STEP 11 — Delta Field

CHECK D1: Is the `delta` field present on the card?
  Expected values: "up" | "down" | "same"
  PASS = field exists and contains one of these three values

---

## REPORT FORMAT

Produce your findings in this format:

### Card 02 Leadership — QA Results [DATE]

| Check | Description | Result | Notes |
|-------|-------------|--------|-------|
| F1  | Timestamp freshness | PASS/FAIL | |
| F2  | Source field present & valid | PASS/FAIL | Value: d1/yahoo/d1+yahoo |
| S1  | Row count = 3 | PASS/FAIL | |
| S2  | Row labels correct | PASS/FAIL | |
| S3  | Row indicators correct | PASS/FAIL | |
| R0A | Row 0 status (RSP vs SPY) | PASS/FAIL | RSP: X%, SPY: X% |
| R0B | Row 0 condition text | PASS/FAIL | |
| R0C | Row 0 full condition match | PASS/FAIL | |
| R1A | Row 1 status (QQEW vs QQQ) | PASS/FAIL | QQEW: X%, QQQ: X% |
| R1B | Row 1 condition text | PASS/FAIL | |
| R1C | Row 1 full condition match | PASS/FAIL | |
| R2A | Row 2 status (IVW vs IVE) | PASS/FAIL | IVW: X%, IVE: X% |
| R2B | Row 2 condition text | PASS/FAIL | |
| R2C | Row 2 full condition match | PASS/FAIL | |
| R2D | Row 2 never "bearish" | PASS/FAIL | CRITICAL |
| C1  | Card status majority-wins | PASS/FAIL | Bull: X, Bear: X, Neu: X |
| L1  | rspLeading matches row 0 | PASS/NOTE | |
| L2  | Streak is non-zero | PASS/FAIL | Value: X |
| L3  | Streak sign matches rspLeading | PASS/FAIL | |
| L4  | Spread values present | PASS/FAIL | RSP/SPY: X%, QQEW/QQQ: X% |
| X1  | RSP 20d return vs Yahoo | PASS/FAIL | Hub: X%, Yahoo: X% |
| X2  | SPY 20d return vs Yahoo | PASS/FAIL | Hub: X%, Yahoo: X% |
| D1  | Delta field present | PASS/FAIL | Value: up/down/same |

### Summary
- Total checks: 22
- Passed: X
- Failed: X
- N/A: X
- Notes: [anything unexpected not covered by a specific check]

### Critical Flags (fail-stop issues)
List any FAIL results for: R2D (Style Bias never bearish), C1 (card status logic), L3 (streak alignment)
These indicate logic bugs rather than data issues and should be investigated immediately.
