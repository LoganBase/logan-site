# QA Test: Card 01 — Regime ("The Anchor")
# Market Hub — loganbase.com/market-hub

## Your Role
You are a QA reviewer for the Market Hub dashboard. You have no prior context.
Run every check below in order. Report PASS / FAIL / NOTE for each item.
At the end, produce a summary table of results.

---

## STEP 1 — Fetch the Scores API

Fetch: GET https://www.loganbase.com/api/scores

From the JSON response:
- Locate the card where `id = "regime"` (Card 01)
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
  rows[0].label = "SPY Regime"
  rows[1].label = "Stretch Risk"
  rows[2].label = "Trend Cross"

CHECK S3: Do the row indicators match exactly?
  rows[0].indicator = "SPY vs 200d SMA"
  rows[1].indicator = "Distance from 200d SMA"
  rows[2].indicator = "50d SMA vs 200d SMA"

---

## STEP 4 — Parse Raw Values from Row Display Strings

The API returns formatted display strings. Parse them as follows:

Row 0 value format: "SPY $XXX.XX<br>200d $XXX.XX" (ignore &nbsp; and HTML tags)
  → Extract: SPY_PRICE and SMA200

Row 1 value format: "+X.XX%" or "-X.XX%"
  → Extract: VS200_DISPLAYED (the percentage shown)

Row 2 value format: "50d: $XXX.XX"
  → Extract: SMA50

---

## STEP 5 — Math Verification

Using the values parsed in Step 4:

CHECK M1: Recalculate vs200
  FORMULA: ((SPY_PRICE - SMA200) / SMA200) × 100
  Compare your result to VS200_DISPLAYED (allow ±0.05% tolerance for rounding)
  PASS = values match within tolerance
  FAIL = values diverge by more than 0.05%

CHECK M2: Recalculate 50d vs 200d spread
  FORMULA: ((SMA50 - SMA200) / SMA200) × 100
  Verify the sign matches row 2 condition text:
    Positive spread → condition should contain "Golden Cross"
    Negative spread → condition should contain "Death Cross"

---

## STEP 6 — Row 0: SPY Regime Logic

Using SPY_PRICE and SMA200 from Step 4:

CHECK R0A: Is status correct?
  IF SPY_PRICE > SMA200 → rows[0].status must = "bullish"
  IF SPY_PRICE < SMA200 → rows[0].status must = "bearish"

CHECK R0B: Is condition text correct?
  IF bullish → rows[0].condition must contain "Secular Bull"
  IF bearish → rows[0].condition must contain "Secular Bear"

---

## STEP 7 — Row 1: Stretch Risk Zone Logic

Using VS200_DISPLAYED from Step 4:

Determine the expected zone:
  VS200 > +14%          → status = "bearish",  condition contains "Overextended"
  VS200 > +10% to +14%  → status = "neutral",  condition contains "Extended"
  VS200 >= 0% to +10%   → status = "bullish",  condition contains "Normal Bull"
  VS200 >= -10% to 0%   → status = "neutral",  condition contains "Bearish Retest"
  VS200 < -10%          → status = "bearish",  condition contains "Deeply Oversold"

CHECK R1A: Does rows[1].status match the expected zone status?
CHECK R1B: Does rows[1].condition contain the expected zone text?

---

## STEP 8 — Row 2: Trend Cross Logic

Using SMA50 and SMA200 from Step 4:

CHECK R2A: Is status correct?
  IF SMA50 > SMA200 → rows[2].status must = "bullish"
  IF SMA50 < SMA200 → rows[2].status must = "bearish"

CHECK R2B: Is condition text correct?
  IF bullish → rows[2].condition must contain "Golden Cross"
  IF bearish → rows[2].condition must contain "Death Cross"

CHECK R2C: Does the condition text include a spread percentage?
  Expected format: "Golden Cross — Confirmed (+X.X%)" or "Death Cross — De-Risk (-X.X%)"
  PASS = spread percentage is present in condition string

---

## STEP 9 — Card Override Rule (Critical)

This is the most important logic rule in Card 01.

CHECK O1: If SPY_PRICE < SMA200 (secular bear), is card.status = "bearish"?
  This must be true regardless of what rows[1] and rows[2] show.
  IF SPY is below 200d AND card.status ≠ "bearish" → FAIL (override rule broken)

CHECK O2: If SPY_PRICE > SMA200, does card.status reflect majority-wins across rows?
  Count bullish/neutral/bearish across rows[0..2]
  IF more bullish than bearish → card.status should = "bullish"
  IF more bearish than bullish → card.status should = "bearish"
  IF tied or mixed              → card.status should = "neutral"
  NOTE: When in secular bull, card status follows majority — verify it is consistent.

---

## STEP 10 — Cross-Reference Price vs Yahoo Finance

Fetch SPY's latest price from Yahoo Finance:
  GET https://query1.finance.yahoo.com/v8/finance/chart/SPY?interval=1d&range=5d

From the Yahoo response, extract:
  YAHOO_PRICE = meta.regularMarketPrice (or the most recent closing price)

CHECK X1: Does SPY_PRICE (from Market Hub API) match YAHOO_PRICE?
  Allow ±$0.05 tolerance (rounding differences between sources)
  PASS = prices match within tolerance
  FAIL = prices diverge by more than $0.05 — data source issue

---

## STEP 11 — Delta Field

CHECK D1: Is the `delta` field present on the card?
  Expected values: "up" | "down" | "same"
  PASS = field exists and contains one of these three values
  NOTE = if "same", that is normal (delta compares today vs previous trading day)

---

## REPORT FORMAT

Produce your findings in this format:

### Card 01 Regime — QA Results [DATE]

| Check | Description | Result | Notes |
|-------|-------------|--------|-------|
| F1  | Timestamp freshness | PASS/FAIL | |
| F2  | Source field present & valid | PASS/FAIL | Value: d1/yahoo/d1+yahoo |
| S1  | Row count = 3 | PASS/FAIL | |
| S2  | Row labels correct | PASS/FAIL | |
| S3  | Row indicators correct | PASS/FAIL | |
| M1  | vs200 math correct | PASS/FAIL | Calculated: X%, Displayed: Y% |
| M2  | 50d/200d spread sign | PASS/FAIL | |
| R0A | Row 0 status correct | PASS/FAIL | SPY $X vs 200d $Y |
| R0B | Row 0 condition text | PASS/FAIL | |
| R1A | Row 1 status (zone) | PASS/FAIL | VS200 = X%, zone = Y |
| R1B | Row 1 condition text | PASS/FAIL | |
| R2A | Row 2 status correct | PASS/FAIL | |
| R2B | Row 2 condition text | PASS/FAIL | |
| R2C | Spread % in condition | PASS/FAIL | |
| O1  | Override rule (bear) | PASS/FAIL/N-A | N/A if SPY in bull |
| O2  | Majority-wins logic | PASS/FAIL | |
| X1  | Price vs Yahoo | PASS/FAIL | Hub: $X, Yahoo: $Y |
| D1  | Delta field present | PASS/FAIL | Value: up/down/same |

### Summary
- Total checks: 18
- Passed: X
- Failed: X
- Notes: [anything unexpected not covered by a specific check]
