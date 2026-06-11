# QA Test: Executive Summary Card
# Market Hub — loganbase.com/market-hub

## Your Role
You are a QA reviewer for the Market Hub dashboard. You have no prior context.
Run every check below in order. Report PASS / FAIL / NOTE for each item.
At the end, produce a summary table of results.

---

## STEP 1 — Fetch All Three APIs

Fetch these three endpoints in parallel:

  A: GET https://www.loganbase.com/api/scores
  B: GET https://www.loganbase.com/api/kalshi
  C: GET https://www.loganbase.com/api/polymarket

From response A, extract:
- `timestamp` (top-level)
- `source` (top-level)
- `aggregate` (the full object)
- `cards[]` (all 10 card objects — you will need their `id` and `status`)

From response B, extract:
- `events[]`

From response C, extract:
- `signals[]`

---

## STEP 2 — Freshness & Source Check

CHECK F1: Is `timestamp` from today's date (UTC)?
  PASS = timestamp date matches today
  FAIL = timestamp is stale (yesterday or older) — data has not refreshed

CHECK F2: Is the top-level `source` field present and valid?
  Expected values: "d1" | "yahoo" | "d1+yahoo"
  PASS = field exists and contains one of these three values
  NOTE the value

---

## STEP 3 — Aggregate Object Structure

CHECK A1: Does `aggregate` exist in the response?
  FAIL if absent

CHECK A2: Do all required fields exist on `aggregate`?
  Required fields: score, glow, label, posture, bullish, neutral, bearish, regimeBearish, categories
  PASS = all 9 fields present
  FAIL = any field missing (name the missing ones)

CHECK A3: Does `aggregate.categories` contain exactly 3 items?
  PASS = categories.length === 3
  FAIL = any other count

CHECK A4: Are the category keys correct?
  Expected (in any order): "trend", "participation", "macro"
  PASS = all three keys present
  FAIL = any key missing or misspelled

CHECK A5: Are the category weights correct?
  trend.weight     = 0.4
  participation.weight = 0.3
  macro.weight     = 0.3
  PASS = all three match exactly
  FAIL = any mismatch

---

## STEP 4 — Card Membership

The 10 cards must be allocated to categories as follows:

  Trend / Momentum (4 cards):  regime, leadership, sectors, equities
  Participation     (3 cards):  breadth, globalflows, commodities
  Macro Conditions  (3 cards):  valuations, yield, credit

For each category in `aggregate.categories`, read the `cards[]` array (each entry has `id` and `status`).

CHECK M1: Does Trend contain exactly these 4 card IDs?
  Expected: regime, leadership, sectors, equities
  PASS = all 4 present, no extras
  FAIL = any ID missing or wrong

CHECK M2: Does Participation contain exactly these 3 card IDs?
  Expected: breadth, globalflows, commodities
  PASS = all 3 present, no extras
  FAIL = any ID missing or wrong

CHECK M3: Does Macro contain exactly these 3 card IDs?
  Expected: valuations, yield, credit
  PASS = all 3 present, no extras
  FAIL = any ID missing or wrong

---

## STEP 5 — Chip Count Integrity

CHECK C1: Do the chip counts total 10?
  FORMULA: aggregate.bullish + aggregate.neutral + aggregate.bearish
  PASS = total equals 10
  FAIL = total is anything other than 10 (cards may have been added/removed without updating)

CHECK C2: Do the chip counts match the actual card statuses?
  From `cards[]` in the scores response, count how many cards have status "bullish", "neutral", "bearish"
  Compare to aggregate.bullish, aggregate.neutral, aggregate.bearish
  PASS = all three counts match
  FAIL = any count diverges (scoring engine not matching the aggregate builder)

---

## STEP 6 — Regime Warning Flag

CHECK R1: Is `regimeBearish` correct?
  From `cards[]`, find the card where `id = "regime"`
  IF regime.status = "bearish"  → aggregate.regimeBearish must = true
  IF regime.status = "bullish"  → aggregate.regimeBearish must = false
  IF regime.status = "neutral"  → aggregate.regimeBearish must = false
  PASS = flag matches regime card status
  FAIL = mismatch (warning banner will show/hide incorrectly)

---

## STEP 7 — Category Sub-Score Math

For each of the three categories, verify the sub-score calculation.

**Scoring rules:**
  bullish = 1.0 point
  neutral = 0.5 points  ← not zero; mixed signal ≠ risk-off
  bearish = 0.0 points

**Per-category formula:**
  raw   = category.bullish + (category.neutral × 0.5)
  total = number of cards in category (Trend=4, Participation=3, Macro=3)
  pct   = raw / total   (this is the normalised 0–1 value)

Using the category.bullish / neutral / bearish counts from the aggregate response:

CHECK SC1: Trend sub-score
  Calculate: raw = trend.bullish + (trend.neutral × 0.5)
  Calculate: pct = raw / 4
  Verify: trend.pct reported in API matches your calculated pct (allow ±0.001 tolerance)
  Verify: trend.score string matches "X/4" or "X.X/4" where X = raw
  PASS = both match
  FAIL = either diverges

CHECK SC2: Participation sub-score
  Calculate: raw = participation.bullish + (participation.neutral × 0.5)
  Calculate: pct = raw / 3
  Verify: participation.pct reported in API matches your calculated pct (allow ±0.001)
  Verify: participation.score string matches "X/3" or "X.X/3" where X = raw
  PASS = both match
  FAIL = either diverges

CHECK SC3: Macro sub-score
  Calculate: raw = macro.bullish + (macro.neutral × 0.5)
  Calculate: pct = raw / 3
  Verify: macro.pct reported in API matches your calculated pct (allow ±0.001)
  Verify: macro.score string matches "X/3" or "X.X/3" where X = raw
  PASS = both match
  FAIL = either diverges

---

## STEP 8 — Weighted Composite Score Math

This is the most critical calculation check.

**Formula:**
  weightedPct = (trend.pct × 0.4) + (participation.pct × 0.3) + (macro.pct × 0.3)
  displayScore = (weightedPct × 10).toFixed(1)   → e.g. "5.5"
  score string = displayScore + "/10"             → e.g. "5.5/10"

Using the pct values you calculated in Step 7:

CHECK WC1: Recalculate the weighted composite
  Calculate weightedPct from your Step 7 pct values
  Calculate displayScore = (weightedPct × 10) rounded to 1 decimal place
  Compare to aggregate.score (strip "/10" suffix before comparing)
  PASS = values match (allow ±0.05 for floating-point rounding)
  FAIL = values diverge by more than 0.05
  NOTE the full calculation: e.g. "(0.875×0.4) + (0.5×0.3) + (0.167×0.3) = 0.55 → 5.5/10"

---

## STEP 9 — Label, Posture, and Glow Logic

Using weightedPct from Step 8:

Expected mappings:
  weightedPct ≥ 0.75  → glow = "green",  label = "Risk-On — Broad Participation",    posture = "Risk-On, Not Complacent"
  weightedPct ≥ 0.55  → glow = "yellow", label = "Mixed Signals — Selective",         posture = "Selective, Not Aggressive"
  weightedPct <  0.55 → glow = "red",    label = "Risk-Off — Reduce Exposure",         posture = "Defensive, Raise Cash"

CHECK L1: Does aggregate.glow match the expected value for the calculated weightedPct?
  PASS = matches
  FAIL = does not match (glow threshold logic broken)

CHECK L2: Does aggregate.label match the expected string exactly?
  PASS = exact string match
  FAIL = wrong label or old label present (e.g. "Secular Bull Intact" = FAIL — that label was retired)

CHECK L3: Does aggregate.posture match the expected string exactly?
  PASS = exact string match
  FAIL = wrong posture

---

## STEP 10 — Category Glow Logic

For each category, the glow should reflect its normalised pct:
  pct ≥ 0.75 → "green"
  pct ≥ 0.55 → "yellow"
  pct <  0.55 → "red"

CHECK CG1: Does trend.glow match expected for trend.pct?
  PASS = matches
  FAIL = mismatch

CHECK CG2: Does participation.glow match expected for participation.pct?
  PASS = matches
  FAIL = mismatch

CHECK CG3: Does macro.glow match expected for macro.pct?
  PASS = matches
  FAIL = mismatch

---

## STEP 11 — Kalshi Event Checks

Using response B (`/api/kalshi`):

CHECK K1: Is `events` array present and non-empty?
  PASS = events exists and has at least 1 item
  FAIL = missing, null, or empty array
  NOTE = empty array may mean Kalshi API is down or no open events

CHECK K2: Does each event have all required fields?
  Required: label, date, action, consensus, confidence, type
  PASS = all fields present on every event
  FAIL = any field missing

CHECK K3: Is the FOMC event action derived (not hardcoded)?
  Find the event where type = "fomc"
  Check action field value: must be "Cut", "Hold", or "Hike"
  FAIL if action = "Hold" AND this seems implausible given the consensus rate vs current rate
  To verify: the action should be:
    "Hike" if consensus % > current rate (4.50% as of 2026-06-10)
    "Cut"  if consensus % < current rate
    "Hold" if consensus % ≈ current rate (within 0.01%)
  PASS = action is consistent with consensus value
  NOTE the action and consensus values (e.g. "Cut 3.75%")

CHECK K4: Is the FOMC confidence value between 1 and 99?
  PASS = 1 ≤ confidence ≤ 99
  FAIL = 0, 100, or out of range (the cap at 99 ensures ≤99)

CHECK K5: Is the CPI consensus in the correct format?
  Find the event where type = "cpi"
  Expected format: "~+X.X%" or "~-X.X%" (tilde prefix, sign, one decimal)
  PASS = format matches
  NOTE = may be absent if no open CPI markets

---

## STEP 12 — Polymarket Signal Checks

Using response C (`/api/polymarket`):

CHECK P1: Is `signals` array present?
  PASS = signals exists (may be empty if API is down)
  FAIL = field missing from response

CHECK P2: Are there 5 or fewer signals?
  PASS = signals.length ≤ 5
  FAIL = more than 5 (slice not being applied)

CHECK P3: Are signals sorted by volume descending?
  Extract volume from each signal
  Verify signals[0].volume ≥ signals[1].volume ≥ ... for all consecutive pairs
  PASS = sorted correctly
  FAIL = any pair out of order

CHECK P4: Is each signal's probability between 0 and 1?
  Check all signals
  PASS = 0 ≤ probability ≤ 1 for every signal
  FAIL = any value outside 0–1 range

CHECK P5: Is each signal's sentiment a valid value?
  Expected values: "bullish" | "bearish" | "neutral"
  PASS = all signals have one of these three values
  FAIL = any other value

CHECK P6: For signals containing "recession", "inflation" (without "rate"), or "negative gdp" in the question — is probability a number between 0 and 1?
  These signals should display base-rate context on the frontend.
  PASS = probability is a valid number (frontend can compute the diff)
  NOTE which qualifying signals are present and their probabilities

---

## REPORT FORMAT

Produce your findings in this format:

### Executive Summary — QA Results [DATE]

**Live values at time of check:**
- Score: X.X/10 | Glow: green/yellow/red
- Label: "..."
- Posture: "..."
- Chips: X bullish, X neutral, X bearish
- regimeBearish: true/false
- Category scores: Trend X.X/4, Participation X.X/3, Macro X.X/3
- Kalshi: [action] [consensus] [confidence]% — [date]
- Polymarket: [N] signals, top signal: "[label]" [probability]%

| Check | Description | Result | Notes |
|-------|-------------|--------|-------|
| F1  | Timestamp freshness | PASS/FAIL | |
| F2  | Source field valid | PASS/FAIL | Value: |
| A1  | aggregate object present | PASS/FAIL | |
| A2  | All required fields present | PASS/FAIL | |
| A3  | categories count = 3 | PASS/FAIL | |
| A4  | Category keys correct | PASS/FAIL | |
| A5  | Category weights correct | PASS/FAIL | |
| M1  | Trend cards correct (4) | PASS/FAIL | |
| M2  | Participation cards correct (3) | PASS/FAIL | |
| M3  | Macro cards correct (3) | PASS/FAIL | |
| C1  | Chip counts total 10 | PASS/FAIL | Total: |
| C2  | Chip counts match card statuses | PASS/FAIL | |
| R1  | regimeBearish flag correct | PASS/FAIL | Regime status: |
| SC1 | Trend sub-score math | PASS/FAIL | Calc: X raw / 4 = X pct |
| SC2 | Participation sub-score math | PASS/FAIL | Calc: X raw / 3 = X pct |
| SC3 | Macro sub-score math | PASS/FAIL | Calc: X raw / 3 = X pct |
| WC1 | Weighted composite math | PASS/FAIL | Calc: X.X/10, Displayed: X.X/10 |
| L1  | Glow matches threshold | PASS/FAIL | weightedPct: X |
| L2  | Label correct (no retired labels) | PASS/FAIL | |
| L3  | Posture correct | PASS/FAIL | |
| CG1 | Trend category glow | PASS/FAIL | pct: X → expected: |
| CG2 | Participation category glow | PASS/FAIL | pct: X → expected: |
| CG3 | Macro category glow | PASS/FAIL | pct: X → expected: |
| K1  | Kalshi events present | PASS/FAIL | Count: |
| K2  | Kalshi event fields complete | PASS/FAIL | |
| K3  | FOMC action derived correctly | PASS/FAIL | Action: , Consensus: |
| K4  | FOMC confidence 1–99 | PASS/FAIL | Value: |
| K5  | CPI consensus format | PASS/FAIL/N-A | Value: |
| P1  | Polymarket signals present | PASS/FAIL | |
| P2  | Signal count ≤ 5 | PASS/FAIL | Count: |
| P3  | Signals sorted by volume | PASS/FAIL | |
| P4  | Probabilities 0–1 | PASS/FAIL | |
| P5  | Sentiment values valid | PASS/FAIL | |
| P6  | Base-rate qualifying signals | NOTE | Signals: |

### Summary
- Total checks: 31
- Passed: X
- Failed: X
- Notes: [anything unexpected not covered by a specific check]
