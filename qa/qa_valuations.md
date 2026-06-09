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

## STEP 3 — Card Structure Check

CHECK S1: Does the card have exactly 4 rows?
  Expected: rows[0], rows[1], rows[2], rows[3]
  NOTE: Card 04 has 3 active rows + 1 context-only row (Japan P/E)
  FAIL if fewer than 4 rows exist

CHECK S2: Do the row labels match exactly?
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
  PASS = card.note exists and contains "not a market-timing tool"
  FAIL = note field is missing or empty

---

## STEP 4 — Parse Raw Values from Row Display Strings

Value formats for this card differ from market-price cards — all are ratio/percentage strings:

Row 0 value format: "X.X×" (e.g., "28.3×") or placeholder "~28×"
  → Extract: TRAILING_PE_VAL as a number (strip × and ~)
  → If value starts with "~": mark as PLACEHOLDER_PE = true (D1 not seeded for this metric)

Row 1 value format: "X.X×" or "X.X× *" (stale flag) or placeholder "~37×"
  → Extract: CAPE_VAL as a number (strip ×, *, and ~)
  → If value contains " *": mark CAPE_STALE = true
  → If value starts with "~": mark as PLACEHOLDER_CAPE = true

Row 2 value format: "XXX%" (e.g., "195%") or placeholder "~230%"
  → Extract: BUFFETT_VAL as a number (strip % and ~)
  → If value starts with "~": mark as PLACEHOLDER_BUFFETT = true

Row 3 value format: "X.X×" (e.g., "15.2×") or placeholder "~15×"
  → Extract: JAPAN_PE_VAL as a number (strip × and ~)
  → If value starts with "~": mark as PLACEHOLDER_JAPAN = true

NOTE: Placeholder values ("~XX") mean D1 has not been seeded for that metric yet.
Placeholder rows should still have the correct status and condition — check them but
note the placeholder in your report.

---

## STEP 5 — Row 0: Trailing P/E Zone Logic

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

---

## STEP 6 — Row 1: CAPE Zone Logic

Using CAPE_VAL from Step 4:

CHECK C1: If CAPE_STALE = true, is the staleness asterisk (*) visible in the value?
  PASS = rows[1].value contains "* " or "×*" when data is 2+ months old
  NOTE = If you cannot determine the data date here, this check will be confirmed via
         the valuations-history API in Step 9

IF PLACEHOLDER_CAPE = true: mark R1A and R1B as NOTE

Otherwise:

CHECK R1A: Is the status correct for the parsed CAPE value?
  CAPE > 35×     → rows[1].status must = "bearish"
  CAPE 20–35×    → rows[1].status must = "neutral"
  CAPE ≤ 20×     → rows[1].status must = "bullish"

CHECK R1B: Is the condition text correct?
  CAPE > 40×     → condition must contain "Extreme"
  CAPE 35–40×    → condition must contain "Very High"
  CAPE 25–35×    → condition must contain "Elevated"
  CAPE 20–25×    → condition must contain "Elevated"
  CAPE ≤ 20×     → condition must contain "Normal"

CHECK R1C: Does the condition text include the date label (e.g., "May 2026")?
  PASS = condition contains a month + year string (e.g., "Jun 2026")
  NOTE = if absent, the date label logic may have failed in D1 lookup

---

## STEP 7 — Row 2: Buffett Indicator Zone Logic

Using BUFFETT_VAL from Step 4:

IF PLACEHOLDER_BUFFETT = true: mark R2A and R2B as NOTE

Otherwise:

CHECK R2A: Is the status correct for the parsed Buffett ratio?
  BUFFETT > 115%  → rows[2].status must = "bearish"
  BUFFETT 80–115% → rows[2].status must = "neutral"
  BUFFETT < 80%   → rows[2].status must = "bullish"

  NOTE: Both >160% and 115–160% map to "bearish". Verify the condition text
  distinguishes between the two:
    > 160%        → condition must contain "Extreme"
    115–160%      → condition must contain "Overvalued"

CHECK R2B: Is the condition text present and non-empty?
  PASS = rows[2].condition is a non-empty string

---

## STEP 8 — Row 3: Japan P/E (Context Only)

Using JAPAN_PE_VAL from Step 4:

*** CRITICAL RULE: Row 3 (Japan P/E) must NOT be counted in card.status ***
*** It is a context-only row — its status is irrelevant to the card score ***

CHECK J1: Does rows[3] exist in the response?
  PASS = rows[3] is present
  FAIL = Japan P/E row is missing entirely

CHECK J2: Does rows[3].condition contain "International" or "In Line"?
  PASS = condition is non-empty and contains one of these terms

CHECK J3: (Logic verification — if JAPAN_PE_VAL and TRAILING_PE_VAL both available)
  Japan status logic uses US P/E as the comparison reference:
    Japan P/E < US P/E × 0.8   → status = "bullish"
    Japan P/E < US P/E          → status = "neutral"
    Japan P/E ≥ US P/E          → status = "bearish"
  Verify rows[3].status is consistent with this comparison.
  NOTE: US P/E used may be the forward P/E (not displayed on card) if available in D1;
  if values seem off, this is likely the cause — mark as NOTE rather than FAIL.

---

## STEP 9 — Card Status Logic (Critical: Japan P/E Excluded)

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

## STEP 10 — Cross-Reference via Valuations History API

Fetch: GET https://www.loganbase.com/api/valuations-history?range=30y

From the response extract:
  summary.currentCape   (latest CAPE from D1)
  summary.currentPe     (latest trailing P/E from D1)
  summary.latestDate    (date of the most recent data row)
  summary.avgCape       (30-year average CAPE)
  summary.percentile    (current CAPE percentile over 30 years)

CHECK V1: Does summary.currentCape match CAPE_VAL parsed from the card in Step 4?
  Allow ±0.1× tolerance
  PASS = values match within tolerance
  FAIL = values diverge — inconsistency between scores API and valuations-history API
  N/A  = if PLACEHOLDER_CAPE = true (D1 not seeded)

CHECK V2: Does summary.currentPe match TRAILING_PE_VAL from the card in Step 4?
  Allow ±0.5× tolerance (P/E calculation may use slightly different earnings rows)
  PASS = values match within tolerance
  NOTE = minor divergence is acceptable if data dates differ between the two endpoints
  N/A  = if PLACEHOLDER_PE = true

CHECK V3: Is summary.latestDate recent (within 2 months of today)?
  PASS = latestDate is within 2 months of today's date
  FAIL = latestDate is more than 2 months old — D1 Shiller data needs re-seeding
  (If latestDate IS more than 2 months old, this confirms the CAPE_STALE asterisk
   on the card is working correctly — note this as PASS for check C1)

CHECK V4: Is summary.percentile a number between 0 and 100?
  PASS = percentile is a valid number
  FAIL = percentile is null or outside 0–100 range

---

## STEP 11 — Delta Field

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
| S1  | Row count = 4 | PASS/FAIL | |
| S2  | Row labels correct | PASS/FAIL | |
| S3  | Row indicators correct | PASS/FAIL | |
| S4  | Note field present | PASS/FAIL | |
| C1  | CAPE stale flag (*) if applicable | PASS/NOTE/N-A | |
| R0A | Row 0 (Trailing P/E) status | PASS/FAIL/NOTE | PE: X× |
| R0B | Row 0 condition text | PASS/FAIL/NOTE | |
| R1A | Row 1 (CAPE) status | PASS/FAIL/NOTE | CAPE: X× |
| R1B | Row 1 condition text | PASS/FAIL/NOTE | |
| R1C | Row 1 condition has date label | PASS/FAIL | e.g., "Jun 2026" |
| R2A | Row 2 (Buffett) status | PASS/FAIL/NOTE | Buffett: X% |
| R2B | Row 2 condition text present | PASS/FAIL/NOTE | |
| J1  | Row 3 (Japan P/E) exists | PASS/FAIL | |
| J2  | Row 3 condition text valid | PASS/FAIL | |
| J3  | Row 3 logic consistent | PASS/NOTE | Japan: X×, US: X× |
| O1  | Card status = majority rows 0–2 | PASS/FAIL | Bull:X Bear:X Neu:X |
| O2  | Japan P/E correctly excluded | PASS/FAIL | CRITICAL |
| V1  | CAPE matches valuations-history | PASS/FAIL/N-A | Card:X× API:X× |
| V2  | P/E matches valuations-history | PASS/FAIL/N-A | Card:X× API:X× |
| V3  | Shiller data recency | PASS/FAIL | Latest: [date] |
| V4  | Percentile is valid number | PASS/FAIL | Value: X |
| D1  | Delta field present | PASS/FAIL | Value: up/down/same |

### Placeholder Summary
  - PLACEHOLDER_PE:      true / false
  - PLACEHOLDER_CAPE:    true / false
  - PLACEHOLDER_BUFFETT: true / false
  - PLACEHOLDER_JAPAN:   true / false
  (Any "true" means D1 has not been seeded for that metric — card is using fallback values)

### Summary
- Total checks: 23
- Passed: X
- Failed: X
- N/A: X
- Notes: [anything unexpected not covered by a specific check]

### Critical Flags (fail-stop issues)
List any FAIL results for: O1 (card status logic), O2 (Japan excluded from score)
These indicate logic bugs and should be investigated immediately.
Any PLACEHOLDER = true entries should be noted as infrastructure items (D1 seeding
incomplete) rather than code bugs.
