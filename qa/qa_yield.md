# QA Test: Card 05 — Yield ("The Cost of Capital")
# Market Hub — loganbase.com/market-hub

## Your Role
You are a QA reviewer for the Market Hub dashboard. You have no prior context.
Run every check below in order. Report PASS / FAIL / NOTE for each item.
At the end, produce a summary table of results.

---

## STEP 1 — Fetch the Scores API

Fetch: GET https://www.loganbase.com/api/scores

From the JSON response:
- Locate the card where `id = "yield"` (Card 05)
- Extract the full card object including: `status`, `rows[]`, `delta`
- Also extract: `timestamp` and `source` from the top-level response

---

## STEP 2 — Freshness & Source Check

CHECK F1: Is `timestamp` from today's date (UTC)?
  PASS = timestamp date matches today
  FAIL = timestamp is stale (yesterday or older)

CHECK F2: Is the top-level `source` field present and valid?
  Expected values: "d1" | "yahoo" | "d1+yahoo"
  PASS = field exists and contains one of these three values
  NOTE the value — for Card 05, all data comes from Yahoo Finance (^TYX, ^TNX, ^IRX, UUP
  are live-fetched); "yahoo" or "d1+yahoo" is expected until D1 is fully seeded for these symbols.

---

## STEP 3 — Card Structure Check

CHECK S1: Does the card have exactly 4 rows?
  Expected: rows[0], rows[1], rows[2], rows[3]
  FAIL if fewer or more rows exist

CHECK S2: Do the row labels match exactly?
  rows[0].label = "30Y Benchmark"
  rows[1].label = "10Y Benchmark"
  rows[2].label = "Yield Curve"
  rows[3].label = "Dollar Strength"

CHECK S3: Do the row indicators match exactly?
  rows[0].indicator = "US 30-Year Yield (^TYX)"
  rows[1].indicator = "US 10-Year Yield (^TNX)"
  rows[2].indicator = "3m–10Y Spread (Recession Signal)"
  rows[3].indicator = "UUP — US Dollar ETF (DXY proxy)"

---

## STEP 4 — Parse Raw Values from Row Display Strings

Row 0 value format: "X.XX%" (e.g., "4.87%") or "—" if unavailable
  → Extract: TYX_YIELD as a number (strip %)
  → If value = "—": mark YIELD_UNAVAILABLE = true

Row 1 value format: "X.XX%" (e.g., "4.32%") or "—" if unavailable
  → Extract: TNX_YIELD as a number (strip %)

Row 2 value format: "+X.XX%" or "-X.XX%" (e.g., "+0.34%" or "-0.41%") or "—"
  → Extract: CURVE_SPREAD as a signed number (strip % but keep sign)
  → If value = "—": mark CURVE_UNAVAILABLE = true
  NOTE: The Yield Curve row may display "—" if ^IRX (3-month T-bill) is not
  currently in the symbol fetch list. If so, mark all Row 2 checks as NOTE rather
  than FAIL — this is a known data gap, not a code bug.

Row 3 value format: "US$XX.XX" (e.g., "US$28.41") or "—" if unavailable
  → Extract: UUP_PRICE as a number (strip "US$")
  → If value = "—": mark UUP_UNAVAILABLE = true

---

## STEP 5 — Row 0: Long Bond Threshold Logic (^TYX)

This is the MASTER ROW — it drives the card-level override rule in Step 9.

IF YIELD_UNAVAILABLE = true: mark all R0 checks as NOTE

Otherwise, using TYX_YIELD:

CHECK R0A: Is the status correct?
  TYX_YIELD >= 5.0%           → rows[0].status must = "bearish"
  TYX_YIELD > 4.5% AND < 5%  → rows[0].status must = "neutral"
  TYX_YIELD <= 4.5%           → rows[0].status must = "bullish"

CHECK R0B: Is the condition text correct?
  bearish → rows[0].condition must contain "At/Above 5%"
  neutral → rows[0].condition must contain "Approaching 5%"
  bullish → rows[0].condition must contain "Below Threshold"

CHECK R0C: Does the condition text match exactly?
  bearish: "At/Above 5% — Equity Multiple Compression"
  neutral: "Approaching 5% Threshold"
  bullish: "Below Threshold"

---

## STEP 6 — Row 1: 10Y Benchmark Logic (^TNX)

Using TNX_YIELD from Step 4:

CHECK R1A: Is the status correct?
  TNX_YIELD >= 4.5%  → rows[1].status must = "bearish"
  TNX_YIELD >= 3.5%  → rows[1].status must = "neutral"
  TNX_YIELD >= 2.5%  → rows[1].status must = "neutral"
  TNX_YIELD < 2.5%   → rows[1].status must = "bullish"

CHECK R1B: Is the condition text correct?
  TNX >= 4.5%   → condition must contain "Restrictive"
  TNX >= 3.5%   → condition must contain "Elevated"
  TNX >= 2.5%   → condition must contain "Neutral"
  TNX < 2.5%    → condition must contain "Accommodative"

CHECK R1C: Does the condition text match exactly?
  TNX >= 4.5%: "Restrictive — Compressing Equity Multiples"
  TNX >= 3.5%: "Elevated — Headwind for Growth"
  TNX >= 2.5%: "Neutral — Manageable"
  TNX < 2.5%:  "Accommodative — Tailwind for Equities"

---

## STEP 7 — Row 2: Yield Curve Logic (3m–10Y Spread)

IF CURVE_UNAVAILABLE = true:
  CHECK R2A: rows[2].status must = "neutral" (default when data unavailable)
  CHECK R2B: rows[2].condition should = "—"
  Mark all other R2 checks as NOTE — yield curve row requires ^IRX data
  which may not currently be in the symbol fetch list.

Otherwise, using CURVE_SPREAD from Step 4:

CHECK R2A: Is the status correct?
  CURVE_SPREAD < 0   → rows[2].status must = "bearish"
  CURVE_SPREAD < 1   → rows[2].status must = "neutral"  (0 to <1%)
  CURVE_SPREAD >= 1  → rows[2].status must = "bullish"

CHECK R2B: Is the condition text correct?
  CURVE_SPREAD < -0.5  → condition must contain "Deeply Inverted"
  CURVE_SPREAD < 0     → condition must contain "Inverted"
  CURVE_SPREAD < 1     → condition must contain "Flat"
  CURVE_SPREAD >= 1    → condition must contain "Steepening"

CHECK R2C: Does the condition text match exactly?
  < -0.5%: "Deeply Inverted — Recession Risk Elevated"
  -0.5% to 0%: "Inverted — Recession Warning"
  0% to +1%: "Flat — Watch for Steepening"
  >= +1%: "Steepening — Growth Expectations Returning"

CHECK R2D: Does the displayed value sign match the spread direction?
  Positive spread → value must start with "+"
  Negative spread → value must start with "-"

---

## STEP 8 — Row 3: Dollar Strength Logic (UUP)

*** CRITICAL: Dollar logic is INVERTED vs all other price-vs-200d rows ***
*** UUP BELOW 200d SMA = BULLISH (weak dollar = good for risk assets) ***
*** UUP ABOVE 200d SMA = BEARISH (strong dollar = headwind) ***

IF UUP_UNAVAILABLE = true: mark all R3 checks as NOTE

Otherwise, you need the UUP 200d SMA to verify. It is not directly in the
scores API response (the row value only shows the UUP price, not the SMA).
Infer direction from the condition text:

CHECK R3A: Is the condition text one of the two expected values?
  "Weakening — EM Positive"                    → status should = "bullish"
  "Strengthening — Multinational & EM Headwind" → status should = "bearish"
  FAIL if condition is any other string

CHECK R3B: Does rows[3].status match the condition direction?
  "Weakening" → rows[3].status must = "bullish"
  "Strengthening" → rows[3].status must = "bearish"

CHECK R3C: Cross-verify UUP vs its 200d SMA via Yahoo Finance
  Fetch: GET https://query1.finance.yahoo.com/v8/finance/chart/UUP?interval=1d&range=300d
  Calculate SMA200 from the last 200 daily closes.
  Compare to UUP_PRICE:
    IF UUP_PRICE > SMA200 → condition should contain "Strengthening" and status = "bearish"
    IF UUP_PRICE < SMA200 → condition should contain "Weakening" and status = "bullish"
  PASS = Yahoo-computed direction matches the card
  FAIL = direction mismatch

---

## STEP 9 — Card Override Rule (Critical — Same Pattern as Card 01)

*** This is the most important logic check for Card 05 ***

The 30-year yield carries a master override: if TYX_YIELD >= 5.0%,
the entire card must be "bearish" regardless of Rows 1, 2, and 3.

CHECK O1: If TYX_YIELD >= 5.0%, is card.status = "bearish"?
  IF TYX_YIELD >= 5% AND card.status ≠ "bearish" → FAIL (override rule broken)
  IF TYX_YIELD >= 5% AND card.status = "bearish" → PASS
  IF TYX_YIELD < 5% → mark O1 as N/A, proceed to O2

CHECK O2: If TYX_YIELD < 5.0%, does card.status reflect majority-wins across all 4 rows?
  Count bullish/neutral/bearish across rows[0..3]:
    IF more bullish than bearish → card.status should = "bullish"
    IF more bearish than bullish → card.status should = "bearish"
    IF tied or all neutral       → card.status should = "neutral"
  PASS = card status matches your calculated majority
  FAIL = card status does not match majority

CHECK O3: TRAP CHECK — does the 30yr override fire correctly when other rows are bullish?
  If TYX_YIELD >= 5% but rows[1], rows[2], rows[3] are all "bullish",
  card.status must STILL = "bearish" (override ignores all other rows).
  This is the most common logic bug to watch for.
  N/A if TYX_YIELD < 5%.

---

## STEP 10 — Cross-Reference Yields vs Yahoo Finance

Fetch the 30-year and 10-year yields directly from Yahoo Finance:
  GET https://query1.finance.yahoo.com/v8/finance/chart/%5ETYX?interval=1d&range=5d
  GET https://query1.finance.yahoo.com/v8/finance/chart/%5ETNX?interval=1d&range=5d

From each response extract:
  YAHOO_TYX = meta.regularMarketPrice (current 30yr yield)
  YAHOO_TNX = meta.regularMarketPrice (current 10yr yield)

CHECK X1: Does TYX_YIELD match YAHOO_TYX?
  Allow ±0.05% tolerance (rounding)
  PASS = values match within tolerance
  FAIL = values diverge by more than 0.05%

CHECK X2: Does TNX_YIELD match YAHOO_TNX?
  Allow ±0.05% tolerance
  PASS = values match within tolerance
  FAIL = values diverge by more than 0.05%

NOTE: Yield values from Yahoo Finance's meta.regularMarketPrice reflect
the current trading day. After 4pm ET, these should match the closing yield
shown in the Market Hub card.

---

## STEP 11 — Delta Field

CHECK D1: Is the `delta` field present on the card?
  Expected values: "up" | "down" | "same"
  PASS = field exists and contains one of these three values

---

## REPORT FORMAT

Produce your findings in this format:

### Card 05 Yield — QA Results [DATE]

| Check | Description | Result | Notes |
|-------|-------------|--------|-------|
| F1  | Timestamp freshness | PASS/FAIL | |
| F2  | Source field valid | PASS/FAIL | Value: d1/yahoo/d1+yahoo |
| S1  | Row count = 4 | PASS/FAIL | |
| S2  | Row labels correct | PASS/FAIL | |
| S3  | Row indicators correct | PASS/FAIL | |
| R0A | Row 0 (30yr) status correct | PASS/FAIL/NOTE | TYX: X.XX% |
| R0B | Row 0 condition text | PASS/FAIL/NOTE | |
| R0C | Row 0 full condition match | PASS/FAIL/NOTE | |
| R1A | Row 1 (10yr) status correct | PASS/FAIL | TNX: X.XX% |
| R1B | Row 1 condition text | PASS/FAIL | |
| R1C | Row 1 full condition match | PASS/FAIL | |
| R2A | Row 2 (curve) status correct | PASS/FAIL/NOTE | Spread: X.XX% |
| R2B | Row 2 condition text | PASS/FAIL/NOTE | |
| R2C | Row 2 full condition match | PASS/FAIL/NOTE | |
| R2D | Row 2 value sign correct | PASS/FAIL/NOTE | |
| R3A | Row 3 (UUP) condition valid | PASS/FAIL/NOTE | |
| R3B | Row 3 status matches condition | PASS/FAIL/NOTE | |
| R3C | UUP direction vs Yahoo SMA200 | PASS/FAIL/NOTE | Hub: X, Yahoo SMA: X |
| O1  | 30yr override (if >= 5%) | PASS/FAIL/N-A | TYX: X.XX% |
| O2  | Majority-wins (if < 5%) | PASS/FAIL/N-A | Bull:X Bear:X Neu:X |
| O3  | Override fires even if other rows bullish | PASS/FAIL/N-A | CRITICAL |
| X1  | 30yr yield vs Yahoo | PASS/FAIL | Hub: X%, Yahoo: X% |
| X2  | 10yr yield vs Yahoo | PASS/FAIL | Hub: X%, Yahoo: X% |
| D1  | Delta field present | PASS/FAIL | Value: up/down/same |

### Yield Curve Row Status
  - CURVE_UNAVAILABLE: true / false
  - If true: ^IRX (3-month T-bill) is not in the symbol fetch list.
    The yield curve card row will always show "—" and neutral.
    The deep dive chart still computes the curve independently — this is a
    card-level data gap, not a deep dive bug. Flag as infrastructure item.

### Summary
- Total checks: 23
- Passed: X
- Failed: X
- N/A: X
- Notes: [anything unexpected not covered by a specific check]

### Critical Flags (fail-stop issues)
List any FAIL results for: O1/O3 (30yr override), R3B (UUP inverted logic)
These indicate logic bugs and should be investigated immediately.
A CURVE_UNAVAILABLE = true result is an infrastructure gap (^IRX missing
from ALL_SYMBOLS in scores.js) — log it separately as a known limitation.
