# QA Test: Card 07 — Global Flows ("The Tide")
# Market Hub — loganbase.com/market-hub

## Your Role
You are a QA reviewer for the Market Hub dashboard. You have no prior context.
Run every check below in order. Report PASS / FAIL / NOTE for each item.
At the end, produce a summary table of results.

---

## STEP 1 — Fetch the Scores API

Fetch: GET https://www.loganbase.com/api/scores

From the JSON response:
- Locate the card where `id = "globalflows"` (Card 07)
- Extract the full card object including: `status`, `rows[]`, `details[]`, `delta`, `note`
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

CHECK S1: Does the card have exactly 7 rows?
  Expected: rows[0] through rows[6]
  FAIL if fewer or more rows exist

CHECK S2: Do the row labels match exactly?
  rows[0].label = "Global"
  rows[1].label = "USA"
  rows[2].label = "Canada"
  rows[3].label = "Europe"
  rows[4].label = "Asia"
  rows[5].label = "LatAm"
  rows[6].label = "Emerging"

CHECK S3: Do the row indicators contain the correct ETF names and tickers?
  rows[0].indicator must contain "ACWI"
  rows[1].indicator must contain "SPY"
  rows[2].indicator must contain "GSPTSE"
  rows[3].indicator must contain "FEZ"
  rows[4].indicator must contain "AIA"
  rows[5].indicator must contain "ILF"
  rows[6].indicator must contain "EEM"

CHECK S4: Is the `note` field present and non-empty?
  PASS = card.note exists and contains text about "regional indexes" or "200d"
  FAIL = note missing or empty

CHECK S5: Is the `details` array present?
  PASS = card.details exists and is a non-empty array
  NOTE the count (should be ~19 countries across 4 geographic groups)

---

## STEP 4 — Parse vs200 Values from Condition Text

Each row condition text contains the vs200 deviation in parentheses.
Extract VS200 for each row:
  Format: "(+X.X%)" or "(-X.X%)" or "(+XX.X%)"

  rows[0] VS200_ACWI   — from Global condition
  rows[1] VS200_USA    — from USA condition
  rows[2] VS200_CAN    — from Canada condition
  rows[3] VS200_EUR    — from Europe condition
  rows[4] VS200_ASIA   — from Asia condition
  rows[5] VS200_LATAM  — from LatAm condition
  rows[6] VS200_EEM    — from Emerging condition

Mark any row with value "—" as UNAVAILABLE.

---

## STEP 5 — Row 0: ACWI (Global Benchmark — Special Condition Text)

ACWI uses unique condition text different from all other rows.

Using VS200_ACWI:

CHECK R0A: Is status correct?
  VS200_ACWI > 0  → rows[0].status must = "bullish"
  VS200_ACWI <= 0 → rows[0].status must = "bearish"

CHECK R0B: Is condition text correct?
  bullish → condition must contain "Bull Market Intact" and "Stay Invested"
  bearish → condition must contain "Bear Market Signal" and "Raise Cash"

CHECK R0C: Does the note reference ACWI's status?
  PASS = note contains "ACWI" with its above/below status
  NOTE if absent

---

## STEP 6 — Rows 1–5: Standard Regional Rows (USA, Canada, Europe, Asia, LatAm)

These five rows use identical condition text patterns.

For each of rows[1] through rows[5]:

CHECK R1-R5A: Is status correct?
  VS200 > 0  → status must = "bullish"
  VS200 <= 0 → status must = "bearish"

CHECK R1-R5B: Is condition text correct?
  bullish → condition must contain "Uptrend" and "Overweight"
  bearish → condition must contain "Downtrend" and "Underweight"

Run this check for all five rows and report any that fail separately.

---

## STEP 7 — Row 6: EEM (Emerging Markets — Special Condition Text)

EEM uses unique condition text different from standard rows.

Using VS200_EEM:

CHECK R6A: Is status correct?
  VS200_EEM > 0  → rows[6].status must = "bullish"
  VS200_EEM <= 0 → rows[6].status must = "bearish"

CHECK R6B: Is condition text correct?
  bullish → condition must contain "EM Risk-On" and "Add EM Exposure"
  bearish → condition must contain "EM Risk-Off" and "Reduce EM"

---

## STEP 8 — Card Status Logic

Card 7 uses a bull-count rule across all 7 rows:

  bull = count of rows where status = "bullish"

  bull >= 6 → card.status = "bullish"
  bull >= 4 → card.status = "neutral"
  bull < 4  → card.status = "bearish"

CHECK C1: Count bullish rows from rows[0..6] and verify card.status matches:
  PASS = card.status matches your calculated result
  FAIL = card.status does not match

CHECK C2: Does the note correctly state the bull count?
  Extract the "X/7" number from the note
  Verify X matches your bullish row count
  PASS = note count matches actual bullish rows

---

## STEP 9 — Details Array Validation

Using card.details (the 19-country deep dive array):

CHECK D1: Are all 4 geographic groups present?
  Expected group names: "North America", "Europe", "Asia Pacific", "Latin America"
  PASS = all 4 groups present in details entries
  FAIL = any group missing

CHECK D2: Is the count of details entries reasonable?
  Expected: 19 entries (2 N.America + 7 Europe + 7 Asia Pacific + 3 Latin America)
  PASS = 17–21 entries (allow for data availability variation)
  NOTE = exact count

CHECK D3: Spot-check one details entry — does it have required fields?
  Each entry should have: group, label, sym, value, vs200, above
  PASS = required fields present on first non-null entry
  FAIL = missing fields

---

## STEP 10 — Cross-Reference via Yahoo Finance

Verify two regional ETFs against Yahoo Finance.

Fetch ACWI:
  GET https://query1.finance.yahoo.com/v8/finance/chart/ACWI?interval=1d&range=300d
  Extract: meta.regularMarketPrice
  Calculate SMA200 from last 200 daily closes

CHECK X1: Does ACWI price match the card value?
  Allow ±$0.10 tolerance
  PASS = prices match

CHECK X2: Does ACWI above/below 200d direction match Yahoo calculation?
  PASS = both agree on direction
  FAIL = mismatch — data source or calculation issue

Fetch EEM:
  GET https://query1.finance.yahoo.com/v8/finance/chart/EEM?interval=1d&range=300d

CHECK X3: Does EEM vs200 direction match Yahoo calculation?
  PASS = both agree on direction

---

## STEP 11 — Delta Field

CHECK DL1: Is the `delta` field present on the card?
  Expected values: "up" | "down" | "same"
  PASS = field exists and contains one of these three values

---

## REPORT FORMAT

### Card 07 Global Flows — QA Results [DATE]

| Check | Description | Result | Notes |
|-------|-------------|--------|-------|
| F1   | Timestamp freshness | PASS/FAIL | |
| F2   | Source field valid | PASS/FAIL | Value: X |
| S1   | Row count = 7 | PASS/FAIL | |
| S2   | Row labels correct | PASS/FAIL | |
| S3   | Row indicators contain correct tickers | PASS/FAIL | |
| S4   | Note field present | PASS/FAIL | |
| S5   | Details array present | PASS/NOTE | Count: X |
| R0A  | ACWI status correct | PASS/FAIL | vs200: X% |
| R0B  | ACWI condition text (special) | PASS/FAIL | |
| R0C  | Note references ACWI | PASS/NOTE | |
| R1-5A | Standard rows status correct | PASS/FAIL | List any failures |
| R1-5B | Standard rows condition text | PASS/FAIL | |
| R6A  | EEM status correct | PASS/FAIL | vs200: X% |
| R6B  | EEM condition text (special) | PASS/FAIL | |
| C1   | Card status (bull count) | PASS/FAIL | Bull: X/7, Status: X |
| C2   | Note bull count correct | PASS/FAIL | Note: X/7, Actual: X/7 |
| D1   | All 4 geographic groups present | PASS/FAIL | |
| D2   | Details entry count reasonable | PASS/NOTE | Count: X |
| D3   | Details fields valid | PASS/FAIL | |
| X1   | ACWI price vs Yahoo | PASS/FAIL | Hub: $X, Yahoo: $X |
| X2   | ACWI direction vs Yahoo | PASS/FAIL | |
| X3   | EEM direction vs Yahoo | PASS/FAIL | |
| DL1  | Delta field present | PASS/FAIL | Value: X |

### Regional Summary
  - Global (ACWI):  vs200: X%  → bullish/bearish
  - USA (SPY):      vs200: X%  → bullish/bearish
  - Canada:         vs200: X%  → bullish/bearish
  - Europe (FEZ):   vs200: X%  → bullish/bearish
  - Asia (AIA):     vs200: X%  → bullish/bearish
  - LatAm (ILF):    vs200: X%  → bullish/bearish
  - Emerging (EEM): vs200: X%  → bullish/bearish
  - Bull count: X/7 → Status: Bullish/Neutral/Bearish

### Summary
- Total checks: 22
- Passed: X
- Failed: X
- Notes: [anything unexpected]

### Critical Flags
List any FAIL for: R0B (ACWI special text), R6B (EEM special text), C1 (card status)
