# QA Test: Card 09 — Commodities ("The Growth Engine")
# Market Hub — loganbase.com/market-hub

## Your Role
You are a QA reviewer for the Market Hub dashboard. You have no prior context.
Run every check below in order. Report PASS / FAIL / NOTE for each item.
At the end, produce a summary table of results.

---

## STEP 1 — Fetch the Scores API

Fetch: GET https://www.loganbase.com/api/scores

From the JSON response:
- Locate the card where `id = "commodities"` (Card 09)
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

CHECK S1: Does the card have exactly 8 rows?
  Expected: rows[0] through rows[7]
  FAIL if fewer or more rows exist

CHECK S2: Do the row labels match exactly?
  rows[0].label = "Commodities"
  rows[1].label = "Copper"
  rows[2].label = "Gold"
  rows[3].label = "Silver"
  rows[4].label = "Energy"
  rows[5].label = "Agriculture"
  rows[6].label = "Steel"
  rows[7].label = "Uranium"

CHECK S3: Do the row indicators match exactly?
  rows[0].indicator = "USCI"
  rows[1].indicator = "HG=F"
  rows[2].indicator = "GLD"
  rows[3].indicator = "SLV"
  rows[4].indicator = "IXC"
  rows[5].indicator = "DBA"
  rows[6].indicator = "SLX"
  rows[7].indicator = "URA"

CHECK S4: Is the `note` field present and non-empty?
  PASS = card.note exists and contains text about "macro-positive" or "commodity signals"
  FAIL = note missing or empty

---

## STEP 4 — Parse vs200 Values from Row Display Strings

Each row condition text contains the vs200 deviation in parentheses.
Extract VS200 for each row from the condition text:
  Format: "(+X.X% vs 200d)" or "(-X.X% vs 200d)" or "(+X.X%)" depending on row
  
  rows[0] VS200_USCI   — from USCI condition
  rows[1] VS200_COPPER — from Copper condition
  rows[2] VS200_GOLD   — from Gold condition
  rows[3] VS200_SILVER — from Silver condition
  rows[4] VS200_ENERGY — from Energy condition
  rows[5] VS200_AG     — from Agriculture condition
  rows[6] VS200_STEEL  — from Steel condition
  rows[7] VS200_URA    — from Uranium condition

If any row shows "—" for its condition, mark that instrument as UNAVAILABLE.

---

## STEP 5 — Row 0: USCI Benchmark Logic

Using VS200_USCI:

CHECK R0A: Is status correct?
  VS200_USCI > 0  → rows[0].status must = "bullish"
  VS200_USCI <= 0 → rows[0].status must = "bearish"

CHECK R0B: Is condition text correct?
  bullish → condition must contain "Above 200d" and "Real Assets Favourable"
  bearish → condition must contain "Below 200d" and "Real Assets Under Pressure"

---

## STEP 6 — Row 1: Copper (Growth Barometer)

Using VS200_COPPER:

CHECK R1A: Is status correct?
  VS200_COPPER > 0  → rows[1].status must = "bullish"
  VS200_COPPER <= 0 → rows[1].status must = "bearish"

CHECK R1B: Is condition text correct?
  bullish → condition must contain "Growth Confirmed" and "Risk-On"
  bearish → condition must contain "Growth Warning" and "Caution"

CHECK R1C: Does the note field reference copper's status?
  If copper above 200d → note must contain "Copper above 200d"
  If copper below 200d → note must contain "Copper below 200d"
  PASS = note contains the correct copper phrase

---

## STEP 7 — Row 2: Gold (Safe Haven — INVERTED LOGIC)

*** CRITICAL: Gold uses INVERTED signal logic ***
*** Below 200d = BULLISH (safe haven fading = risk-on confirmed) ***
*** Above 200d by >5% = BEARISH (safe haven bid = risk-off warning) ***
*** Above 200d by 0–5% = NEUTRAL (watch) ***

Using VS200_GOLD:

CHECK R2A: Is status correct given the INVERTED logic?
  VS200_GOLD < 0          → rows[2].status must = "bullish"    ← INVERTED
  VS200_GOLD > 5          → rows[2].status must = "bearish"    ← INVERTED
  0 <= VS200_GOLD <= 5    → rows[2].status must = "neutral"

CHECK R2B: Is condition text correct?
  bullish (gold below 200d) → condition must contain "Safe Haven Fading" and "Risk-On Confirmed"
  neutral (gold 0–5% above) → condition must contain "Gold Holding"
  bearish (gold >+5% above) → condition must contain "Safe Haven Bid" and "Risk-Off Warning"

CHECK R2C: CONSISTENCY — does the gold status contradict the usual price-vs-200d expectation?
  IF VS200_GOLD > 0 AND rows[2].status = "bullish" → FAIL (gold above 200d cannot be bullish)
  IF VS200_GOLD < 0 AND rows[2].status = "bearish" → FAIL (gold below 200d cannot be bearish)
  PASS = status correctly reflects the inverted logic

CHECK R2D: Does the note reference the copper/gold relationship when applicable?
  If copper above 200d AND gold below 200d →
    note must contain "Gold fading" (or similar)
  If copper below 200d AND gold above 200d →
    note must contain "Gold leading copper" (or similar)
  NOTE this combination — it is the key macro diagnostic.

---

## STEP 8 — Row 3: Silver (Industrial/Fear Balance)

Silver requires >+2% above 200d for bullish. Between 0% and +2% = neutral.

Using VS200_SILVER:

CHECK R3A: Is status correct?
  VS200_SILVER > 2   → rows[3].status must = "bullish"
  VS200_SILVER > 0 AND VS200_SILVER <= 2 → rows[3].status must = "neutral"
  VS200_SILVER <= 0  → rows[3].status must = "bearish"

CHECK R3B: Is condition text correct?
  bullish → condition must contain "Industrial Metals Bid" and "Growth > Fear"
  neutral → condition must contain "Silver Holding" and "Neutral"
  bearish → condition must contain "Silver Weak" and "Fear > Growth"

---

## STEP 9 — Row 4: Energy

Using VS200_ENERGY:

CHECK R4A: Is status correct?
  VS200_ENERGY > 0  → rows[4].status must = "bullish"
  VS200_ENERGY <= 0 → rows[4].status must = "bearish"

CHECK R4B: Is condition text correct?
  bullish → condition must contain "Energy Trending" and "Overweight Energy"
  bearish → condition must contain "Energy Weak" and "Underweight Energy"

---

## STEP 10 — Row 5: Agriculture (Food Inflation)

Agriculture requires >+2% above 200d for bullish. Between 0% and +2% = neutral.

Using VS200_AG:

CHECK R5A: Is status correct?
  VS200_AG > 2   → rows[5].status must = "bullish"
  VS200_AG > 0 AND VS200_AG <= 2 → rows[5].status must = "neutral"
  VS200_AG <= 0  → rows[5].status must = "bearish"

CHECK R5B: Is condition text correct?
  bullish → condition must contain "Ag Trending" and "Food Inflation Watch"
  neutral → condition must contain "Ag At 200d" and "Neutral"
  bearish → condition must contain "Ag Weak" and "Benign Food Prices"

---

## STEP 11 — Row 6: Steel (Capex Cycle)

Using VS200_STEEL:

CHECK R6A: Is status correct?
  VS200_STEEL > 0  → rows[6].status must = "bullish"
  VS200_STEEL <= 0 → rows[6].status must = "bearish"

CHECK R6B: Is condition text correct?
  bullish → condition must contain "Capex Cycle Active" and "Overweight Industrials"
  bearish → condition must contain "Capex Weak" and "Reduce Industrial Exposure"

---

## STEP 12 — Row 7: Uranium (Energy Transition)

Uranium requires >+5% above 200d for bullish. Between 0% and +5% = neutral.

Using VS200_URA:

CHECK R7A: Is status correct?
  VS200_URA > 5   → rows[7].status must = "bullish"
  VS200_URA > 0 AND VS200_URA <= 5 → rows[7].status must = "neutral"
  VS200_URA <= 0  → rows[7].status must = "bearish"

CHECK R7B: Is condition text correct?
  bullish → condition must contain "Nuclear Demand Active" and "Energy Transition Bid"
  neutral → condition must contain "Uranium Holding" and "Neutral"
  bearish → condition must contain "Uranium Weak" and "Nuclear Demand Fading"

---

## STEP 13 — Card Status Logic

Card 9 uses a bull-count rule. Gold's inverted logic is already reflected in its
row status — count the statuses as displayed.

  bull = count of rows where status = "bullish" across rows[0..7]

  bull >= 6 → card.status = "bullish"
  bull >= 4 → card.status = "neutral"
  bull < 4  → card.status = "bearish"

CHECK C1: Does card.status match the bull-count rule?
  Count bullish rows from rows[0..7] and verify card.status matches threshold
  PASS = card.status matches your calculated result
  FAIL = card.status does not match

CHECK C2: Does card.note state the correct bull count?
  Extract the "X/8" number from the note
  Verify X matches your bullish row count
  PASS = note count matches actual bullish rows
  FAIL = note count differs from actual count

---

## STEP 14 — Cross-Reference via Yahoo Finance

Verify the two most critical instruments — Copper and Gold.

Fetch Copper from Yahoo Finance:
  GET https://query1.finance.yahoo.com/v8/finance/chart/HG%3DF?interval=1d&range=300d
  Extract: meta.regularMarketPrice (current price in $/lb)
  Calculate SMA200 from last 200 daily closes
  Compute vs200: ((price - SMA200) / SMA200) × 100

CHECK X1: Does copper price from Market Hub match Yahoo?
  Allow ±$0.05/lb tolerance
  PASS = prices match; FAIL = diverge by more than $0.05

CHECK X2: Does copper vs200 direction (above/below) match Yahoo calculation?
  PASS = both agree on above or below 200d

Fetch Gold (GLD) from Yahoo Finance:
  GET https://query1.finance.yahoo.com/v8/finance/chart/GLD?interval=1d&range=300d
  Same calculation methodology as copper

CHECK X3: Does GLD price match Yahoo?
  Allow ±$0.10 tolerance
  PASS = prices match

CHECK X4: Does GLD vs200 direction match Yahoo — AND does the card's gold status
  correctly reflect the INVERTED logic?
  IF Yahoo shows GLD above 200d AND card shows gold status = "bullish" → FAIL
  IF Yahoo shows GLD below 200d AND card shows gold status = "bearish" → FAIL
  PASS = Yahoo direction and inverted card status are consistent

---

## STEP 15 — Delta Field

CHECK D1: Is the `delta` field present on the card?
  Expected values: "up" | "down" | "same"
  PASS = field exists and contains one of these three values

---

## REPORT FORMAT

Produce your findings in this format:

### Card 09 Commodities — QA Results [DATE]

| Check | Description | Result | Notes |
|-------|-------------|--------|-------|
| F1  | Timestamp freshness | PASS/FAIL | |
| F2  | Source field valid | PASS/FAIL | Value: d1/yahoo/d1+yahoo |
| S1  | Row count = 8 | PASS/FAIL | |
| S2  | Row labels correct | PASS/FAIL | |
| S3  | Row indicators correct | PASS/FAIL | |
| S4  | Note field present | PASS/FAIL | |
| R0A | USCI status correct | PASS/FAIL | vs200: X% |
| R0B | USCI condition text | PASS/FAIL | |
| R1A | Copper status correct | PASS/FAIL | vs200: X% |
| R1B | Copper condition text | PASS/FAIL | |
| R1C | Note references copper | PASS/FAIL | |
| R2A | Gold status correct (inverted) | PASS/FAIL | CRITICAL vs200: X% |
| R2B | Gold condition text | PASS/FAIL | |
| R2C | Gold status not contradicting 200d | PASS/FAIL | CRITICAL |
| R2D | Note copper/gold relationship | NOTE | Signal: [describe] |
| R3A | Silver status (>2% threshold) | PASS/FAIL | vs200: X% |
| R3B | Silver condition text | PASS/FAIL | |
| R4A | Energy status correct | PASS/FAIL | vs200: X% |
| R4B | Energy condition text | PASS/FAIL | |
| R5A | Agriculture status (>2% threshold) | PASS/FAIL | vs200: X% |
| R5B | Agriculture condition text | PASS/FAIL | |
| R6A | Steel status correct | PASS/FAIL | vs200: X% |
| R6B | Steel condition text | PASS/FAIL | |
| R7A | Uranium status (>5% threshold) | PASS/FAIL | vs200: X% |
| R7B | Uranium condition text | PASS/FAIL | |
| C1  | Card status (bull count) | PASS/FAIL | Bull: X, Status: X |
| C2  | Note bull count correct | PASS/FAIL | Note: X/8, Actual: X/8 |
| X1  | Copper price vs Yahoo | PASS/FAIL | Hub: $X, Yahoo: $X |
| X2  | Copper direction vs Yahoo | PASS/FAIL | |
| X3  | GLD price vs Yahoo | PASS/FAIL | Hub: $X, Yahoo: $X |
| X4  | GLD inverted logic vs Yahoo | PASS/FAIL | CRITICAL |
| D1  | Delta field present | PASS/FAIL | Value: up/down/same |

### Commodity Summary
  - USCI:        vs200: X%  → [bullish/bearish]
  - Copper:      vs200: X%  → [bullish/bearish]
  - Gold:        vs200: X%  → [bullish/neutral/bearish] (INVERTED)
  - Silver:      vs200: X%  → [bullish/neutral/bearish] (>2% threshold)
  - Energy:      vs200: X%  → [bullish/bearish]
  - Agriculture: vs200: X%  → [bullish/neutral/bearish] (>2% threshold)
  - Steel:       vs200: X%  → [bullish/bearish]
  - Uranium:     vs200: X%  → [bullish/neutral/bearish] (>5% threshold)
  - Bull count: X/8
  - Copper/Gold signal: [Growth confirmed + safe haven fading / Growth confirmed + safe haven bid / Growth warning + safe haven bid / Growth warning + safe haven fading]

### Summary
- Total checks: 30
- Passed: X
- Failed: X
- N/A: X
- Notes: [anything unexpected]

### Critical Flags (fail-stop issues)
List any FAIL for: R2A, R2C, X4 (Gold inverted logic), C1 (card status)
The Gold inversion is the most important and most error-prone check on this card.
Any failure where gold's status does not correctly reflect its inverted role
means the card is misrepresenting the macro signal — specifically, showing
a safe-haven bid as bullish when it should be a risk-off warning, or vice versa.
