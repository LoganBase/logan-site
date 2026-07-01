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
- Extract the full card object including: `status`, `rows[]`, `stats[]`, `note`, `delta`
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
    "d1"       → All data served from Cloudflare D1 (fully seeded, ideal)
    "d1+yahoo" → Partial D1 coverage; some symbols still falling back to Yahoo Finance
    "yahoo"    → D1 binding absent or empty; all data live from Yahoo Finance

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

Row values now use a two-line format. Line 1 is the spread; line 2 has individual returns.
The separator is either "\n" or "<br>" — handle both.

Row 0 value format (two lines):
  Line 1: "+X.X%"  or "-X.X%"           ← RSP minus SPY 20d spread
  Line 2: "RSP +X.X% SPY +X.X%"         ← individual 20d returns

  → Extract: SPREAD_RSP_SPY (line 1, signed float, e.g. +2.3)
  → Extract: RSP_20D and SPY_20D (from line 2)

Row 1 value format (two lines):
  Line 1: "+X.X%"  or "-X.X%"           ← QQEW minus QQQ 20d spread
  Line 2: "QQEW +X.X% QQQ +X.X%"
  → Extract: SPREAD_QQEW_QQQ, QQEW_20D, QQQ_20D

Row 2 value format (two lines):
  Line 1: "+X.X%"  or "-X.X%"           ← IVW minus IVE 20d spread
  Line 2: "IVW +X.X% IVE +X.X%"
  → Extract: SPREAD_IVW_IVE, IVW_20D, IVE_20D

CHECK P1: Does each row have a two-line value with the spread on line 1?
  PASS = line 1 is a signed percentage (e.g. "+2.3%" or "-1.1%")
  FAIL = line 1 is raw return or missing the spread

CHECK P2: Is the spread on line 1 equal to (primary_20D − secondary_20D) within ±0.15%?
  Row 0: SPREAD_RSP_SPY  ≈ RSP_20D − SPY_20D
  Row 1: SPREAD_QQEW_QQQ ≈ QQEW_20D − QQQ_20D
  Row 2: SPREAD_IVW_IVE  ≈ IVW_20D − IVE_20D
  PASS = each spread matches the arithmetic within tolerance
  FAIL = spread on line 1 does not match the difference of the two individual returns

NOTE: If any pair is unavailable (value = "—"), mark the associated checks as N/A.

---

## STEP 5 — Row 0: Market Breadth Logic (RSP vs SPY)

Using SPREAD_RSP_SPY from Step 4:

CHECK R0A: Is the spread direction reflected in status?
  IF SPREAD_RSP_SPY > 0 → rows[0].status must = "bullish"
  IF SPREAD_RSP_SPY < 0 → rows[0].status must = "bearish"

CHECK R0B: Is condition text correct?
  IF bullish → rows[0].condition must contain "Breadth Expanding"
  IF bearish → rows[0].condition must contain "Rally Narrowing"

CHECK R0C: Does condition text match full expected string?
  Bullish: "Breadth Expanding — Add Broadly"
  Bearish: "Rally Narrowing — Stay with Leaders"

---

## STEP 6 — Row 1: Tech Breadth Logic (QQEW vs QQQ)

Using SPREAD_QQEW_QQQ from Step 4:

CHECK R1A: Is the spread direction reflected in status?
  IF SPREAD_QQEW_QQQ > 0 → rows[1].status must = "bullish"
  IF SPREAD_QQEW_QQQ < 0 → rows[1].status must = "bearish"
  IF data unavailable    → rows[1].status must = "neutral"

CHECK R1B: Is condition text correct?
  IF bullish → rows[1].condition must contain "Tech Broadening"
  IF bearish → rows[1].condition must contain "Mega-Cap Driven"

CHECK R1C: Does condition text match full expected string?
  Bullish: "Tech Broadening — Tech Healthy"
  Bearish: "Mega-Cap Driven — Favour Large Cap"

---

## STEP 7 — Row 2: Style Bias Logic (IVW vs IVE)

Using SPREAD_IVW_IVE from Step 4:

*** CRITICAL RULE: Value leading maps to NEUTRAL, not BEARISH ***
This row can only ever be "bullish" or "neutral" — never "bearish".
Positive spread = IVW outperforming IVE = growth leading = bullish.

CHECK R2A: Is the status correct?
  IF SPREAD_IVW_IVE > 0 → rows[2].status must = "bullish"
  IF SPREAD_IVW_IVE < 0 → rows[2].status must = "neutral"  ← NOT bearish
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

## STEP 8 — Stats Array Check

The `stats` array drives the Leadership Metrics row 2 (contextual stat boxes).
Its shape depends on whether D1 leadership context (ctx) is available.

CHECK ST1: Does `stats` have exactly 3 entries?
  FAIL if stats is missing, null, or has fewer than 3 entries.

CHECK ST2: Identify which stats variant is present:
  Variant A (ctx available — preferred):
    stats[0][0] = "5Y Spread"        stats[0][2] = "RSP vs SPY cumulative"
    stats[1][0] = "Daily Streak"     stats[1][2] contains "days RSP"
    stats[2][0] = "5Y Tech Spread"   stats[2][2] = "QQEW vs QQQ cumulative"

  Variant B (ctx unavailable — fallback):
    stats[0][0] = "RSP vs SPY"       stats[0][2] = "20d breadth spread"
    stats[1][0] = "QQEW vs QQQ"      stats[1][2] = "20d tech breadth"
    stats[2][0] = "Growth vs Value"  stats[2][2] = "20d style spread"

  PASS = matches either Variant A or Variant B exactly
  NOTE the variant — Variant A is preferred (D1 context seeded)

CHECK ST3: Are all stats[i][1] values present and numeric (not "—")?
  PASS = each stats[i][1] is a formatted percentage or integer (not "—")
  FAIL = any value is "—" (indicates a calculation failure)

CHECK ST4 (Variant A only): Is stats[1] (Daily Streak) a non-zero integer?
  PASS = |streak| ≥ 1
  FAIL = streak = 0 or null

---

## STEP 9 — Market Narrative (note field)

CHECK N1: Is the `note` field present and non-empty on the leadership card?
  PASS = note is a non-empty string
  FAIL = note is null, missing, or an empty string

CHECK N2: Does the note contain at least 3 sentences?
  Count sentence-ending punctuation (". ").
  PASS = 3 or more sentences present
  FAIL = fewer than 3 sentences (indicates narrative generation failed)

CHECK N3: Does the note reference at least one of the three spread pairs?
  PASS = note contains any of: "RSP", "SPY", "QQEW", "QQQ", "IVW", "IVE"
  FAIL = note is generic and contains none of these symbols

---

## STEP 10 — Card Status Logic (Majority-Wins, No Override)

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

## STEP 11 — Cross-Reference via Leadership API

Fetch: GET https://www.loganbase.com/api/leadership?range=1y

CHECK L1: Does the response contain a `prices` field?
  Expected shape: { dates: [...], prices: { SPY, RSP, QQQ, QQEW, IVW, IVE }, rspVsSpy, qqewVsQqq, ... }
  PASS = prices object present with at least RSP and SPY arrays
  FAIL = prices field missing or empty (the deep-dive Quality Check chart will not render)

CHECK L2: Is summary.rspLeading internally consistent with summary.streak and currentRspVsSpy?
  NOTE: summary.rspLeading reflects long-run cumulative RSP vs SPY performance (1Y range),
  NOT the 20D spread used by rows[0].status. A mismatch between rspLeading and rows[0].status
  is EXPECTED and correct — they measure different timeframes.
  CHECK only that rspLeading is internally consistent:
    IF rspLeading = true  → currentRspVsSpy should be > 0
    IF rspLeading = false → currentRspVsSpy should be < 0
  PASS = rspLeading sign matches the sign of currentRspVsSpy
  FAIL = rspLeading=true but currentRspVsSpy < 0, or vice versa

CHECK L3: Is summary.streak a non-zero integer?
  PASS = streak is a non-zero positive or negative integer
  FAIL = streak is 0 or null

CHECK L4: Does the sign of summary.streak align with summary.rspLeading?
  IF streak > 0 → rspLeading should = true  (RSP winning daily)
  IF streak < 0 → rspLeading should = false (RSP losing daily)

CHECK L5: Are currentRspVsSpy and currentQqewVsQqq present and numeric?
  PASS = both values are non-null numbers
  FAIL = either value is null or missing

CHECK L6: Compute the 20D RSP vs SPY spread from the prices arrays.
  The prices arrays contain 1Y of daily closes in ascending date order.
  Use the FULL prices arrays (not a pre-sliced window) and take the last 21 values:
    slice_RSP = prices.RSP.slice(-21)    ← 21 elements: base=[0], current=[20]
    slice_SPY = prices.SPY.slice(-21)
    rebase(sym) = (slice[20] / slice[0] - 1) × 100
    spread20D  = rebase(RSP) − rebase(SPY)
  This gives a true 20-trading-day return (20 intervals between 21 data points),
  matching the calculation used in scores.js (closes[0] / closes[20] − 1).
  Compare spread20D to SPREAD_RSP_SPY from Step 4 (allow ±0.3% tolerance).
  PASS = values match within tolerance
  FAIL = values diverge by more than 0.3% (indicates a lookback mismatch)

---

## STEP 12 — Cross-Reference Prices vs Yahoo Finance

Fetch RSP and SPY from Yahoo Finance to independently verify the 20d returns:
  GET https://query1.finance.yahoo.com/v8/finance/chart/RSP?interval=1d&range=45d
  GET https://query1.finance.yahoo.com/v8/finance/chart/SPY?interval=1d&range=45d

From each response extract the closing prices array (result[0].indicators.quote[0].close).
Calculate the 20-day return using the last 21 closing prices:
  RETURN_20D = (closes[last] / closes[last-20] - 1) × 100

CHECK X1: Does the Yahoo-calculated RSP 20d return approximately match RSP_20D from the API?
  Allow ±0.5% tolerance
  PASS = values match within tolerance
  FAIL = values diverge by more than 0.5%

CHECK X2: Does the Yahoo-calculated SPY 20d return approximately match SPY_20D from the API?
  Allow ±0.5% tolerance
  PASS = values match within tolerance
  FAIL = values diverge by more than 0.5%

NOTE: During market hours the API may use a live Yahoo Finance price (when D1 data is
stale > 3 calendar days), which mixes a live price with a historical close. If X1 or X2
fail while source = "d1+yahoo" or "yahoo", note it as an expected live-vs-close divergence.

---

## STEP 13 — Delta Fields

CHECK D1: Is the `delta` field present on the card?
  Expected values: "up" | "down" | "same"
  PASS = field exists and contains one of these three values

CHECK D2: Is the `deltas` object present on the card?
  The `deltas` object drives the directional arrows on the Leadership Metrics row 1 stat boxes.
  Expected shape: { rsp, qqew, style }
  Each value: 'up' | 'down' | null
  Source: 5-day spread delta computed server-side using price5d (close 5 trading days ago)
  and price25d (close 25 trading days ago) for each symbol pair in D1.
  PASS = object is present
  NOTE = null values are acceptable when price5d/price25d unavailable in D1 (first few seeder runs)

CHECK D3: Are the `deltas` sub-field values plausible given recent performance?
  rsp   = direction of (RSP 20d return − SPY 20d return) spread change over 5 trading days
  qqew  = direction of (QQEW 20d return − QQQ 20d return) spread change over 5 trading days
  style = direction of (IVW 20d return − IVE 20d return) spread change over 5 trading days
  Thresholds:
    spread delta > +0.3pp → 'up'   (breadth/quality momentum improving this week)
    spread delta < -0.3pp → 'down' (breadth/quality momentum deteriorating this week)
    |delta| ≤ 0.3pp       → null   (flat — falls back to orientation-based direction in UI)
  PASS = each non-null sub-field is directionally consistent with the past week's trend
  NOTE = null is valid when the pair's 5-day spread change is within ±0.3pp

---

## STEP 14 — UI Visual Checks

Open the live dashboard at https://www.loganbase.com/market-hub
Click on Card 02 (Leadership) to open the deep-dive panel.
Verify cache version: page source should show ?v=20260624ag on the script tags.

CHECK V1: Does the "Leadership Price History" chart appear at the top of the deep dive?
  It should have a pair selector (Market / Tech / Style) and a range selector (20D / 50D / 200D).
  PASS = chart renders with both selectors visible
  FAIL = chart absent or controls missing

CHECK V2: In the Style tab of the Price History chart, is IVW shown as the PRIMARY line
  (listed first in the tooltip/legend) and IVE as the SECONDARY (overlay)?
  PASS = IVW appears first, IVE appears second
  FAIL = order is reversed (IVE first, IVW second) — label consistency bug

CHECK V3: Does the Quality Check chart appear with a 20D / 50D / 200D range selector?
  PASS = chart renders with the three range buttons
  FAIL = chart absent or range selector missing

CHECK V4: In the "Leadership Metrics" section — Row 1 (Market Breadth, Tech Breadth, Style Bias):
  Hover over any stat box to reveal the trigger table.
  At 20D range: triggers should show ±1% and ±3% as zone boundaries.
  PASS = trigger popup shows "+3%" and "-3%" as the strong signal thresholds
  FAIL = trigger popup shows different thresholds (e.g. ±5% instead of ±3%)

CHECK V5: In the "Leadership Metrics" section — Row 2 (Market Spread, Daily Streak, Tech Spread):
  Switch the Quality Check chart to 50D range.
  Hover over the Market Spread stat box to reveal its trigger table.
  At 50D: triggers should show ±2% (mild) and ±12% (strong) as zone boundaries.
  PASS = trigger popup shows "+12%" and "-12%" as the strong signal thresholds
  FAIL = trigger popup still shows 20D thresholds (±3% or ±5%)

CHECK V6: At 20D range, are the Row 1 and Row 2 trigger tables IDENTICAL for the same metric?
  Hover the Market Breadth box (row 1) then the Market Spread box (row 2).
  Both should show the same zone labels and thresholds (e.g. "Broad Participation > +3%").
  PASS = trigger tables are identical between row 1 and row 2 at 20D
  FAIL = trigger labels or thresholds differ between the two rows

CHECK V7: Does the "Market Diagnostics" section appear above the Market Narrative?
  It should show 6 items: Market Breadth, Tech Breadth, Style Bias,
  Market Spread, Tech Spread, Daily Streak — each with a question and answer.
  PASS = all 6 items present with non-empty answers
  FAIL = section missing or any item shows "—" for the answer

CHECK V8: Does the "Market Narrative" section render a multi-sentence paragraph?
  It should contain at least 3 sentences referencing spread direction and streak.
  PASS = paragraph present with 3+ sentences
  FAIL = narrative absent or truncated to one sentence

CHECK V9: Do the spread values in the Leadership Metrics row 2 update when the
  Quality Check range changes from 20D → 50D → 200D?
  At 20D the spread will be small; at 200D it will typically be much larger in magnitude.
  PASS = the stat box values visibly change when switching ranges
  FAIL = values stay the same across all three ranges (lpriceData not loading)

CHECK V10: Do directional arrows render on Leadership Metrics row 1 (Market Breadth, Tech Breadth, Style Bias)?
  Each of the three stat boxes in row 1 should show a small arrow badge (▲ green / ▼ red).
  Direction source: card.deltas.rsp / .qqew / .style (5-day spread delta, preferred).
  Falls back to spread-sign orientation (spread ≥ 0 → ▲, < 0 → ▼) when delta is null.
  PASS = all three row 1 boxes show arrows
  FAIL = no arrows showing on any row 1 box

CHECK V11: Do directional arrows render on Leadership Metrics row 2 (5Y Spread, Daily Streak, 5Y Tech Spread)?
  Row 2 direction uses the same card.deltas keys mapped by label:
    "5Y Spread" / market-related → card.deltas.rsp
    "Daily Streak"               → tone-based (pos streak → ▲, neg streak → ▼)
    "5Y Tech Spread"             → card.deltas.qqew
  Falls back to value-sign orientation when delta is null.
  PASS = all three row 2 boxes show arrows
  FAIL = no arrows showing on any row 2 box

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
| P1  | Row values have spread on line 1 | PASS/FAIL | |
| P2  | Spread = primary − secondary within ±0.15% | PASS/FAIL | Row 0: X, Row 1: X, Row 2: X |
| R0A | Row 0 status (RSP vs SPY spread) | PASS/FAIL | Spread: X% |
| R0B | Row 0 condition text | PASS/FAIL | |
| R0C | Row 0 full condition match | PASS/FAIL | |
| R1A | Row 1 status (QQEW vs QQQ spread) | PASS/FAIL | Spread: X% |
| R1B | Row 1 condition text | PASS/FAIL | |
| R1C | Row 1 full condition match | PASS/FAIL | |
| R2A | Row 2 status (IVW vs IVE spread) | PASS/FAIL | Spread: X% |
| R2B | Row 2 condition text | PASS/FAIL | |
| R2C | Row 2 full condition match | PASS/FAIL | |
| R2D | Row 2 never "bearish" | PASS/FAIL | CRITICAL |
| ST1 | Stats array has 3 entries | PASS/FAIL | |
| ST2 | Stats variant correct | PASS/NOTE | Variant A or B |
| ST3 | All stats values non-null | PASS/FAIL | |
| ST4 | Streak non-zero (Variant A) | PASS/FAIL/N-A | Value: X |
| N1  | Note field present | PASS/FAIL | |
| N2  | Note has 3+ sentences | PASS/FAIL | |
| N3  | Note references spread pairs | PASS/FAIL | |
| C1  | Card status majority-wins | PASS/FAIL | Bull: X, Bear: X, Neu: X |
| L1  | prices field in leadership API | PASS/FAIL | |
| L2  | rspLeading sign matches currentRspVsSpy | PASS/FAIL | rspLeading=X, currentRspVsSpy=X% |
| L3  | Streak non-zero | PASS/FAIL | Value: X |
| L4  | Streak sign matches rspLeading | PASS/FAIL | |
| L5  | Spread values present | PASS/FAIL | RSP/SPY: X%, QQEW/QQQ: X% |
| L6  | 20D spread from prices matches API | PASS/FAIL | API: X%, Calc: X% |
| X1  | RSP 20d return vs Yahoo | PASS/FAIL | Hub: X%, Yahoo: X% |
| X2  | SPY 20d return vs Yahoo | PASS/FAIL | Hub: X%, Yahoo: X% |
| D1  | Delta field present | PASS/FAIL | Value: up/down/same |
| D2  | Deltas object present | PASS/NOTE | rsp=X, qqew=X, style=X |
| D3  | Deltas sub-fields plausible | PASS/NOTE | |
| V1  | Price History chart renders | PASS/FAIL | |
| V2  | Style tab: IVW primary, IVE overlay | PASS/FAIL | |
| V3  | Quality Check chart + range selector | PASS/FAIL | |
| V4  | Row 1 triggers: 20D = ±1%/±3% | PASS/FAIL | |
| V5  | Row 2 triggers: 50D = ±2%/±12% | PASS/FAIL | |
| V6  | Row 1 and Row 2 triggers identical at 20D | PASS/FAIL | |
| V7  | Market Diagnostics section (6 items) | PASS/FAIL | |
| V8  | Market Narrative present (3+ sentences) | PASS/FAIL | |
| V9  | Row 2 spread values update with range | PASS/FAIL | |
| V10 | Direction arrows on row 1 boxes | PASS/FAIL | |
| V11 | Direction arrows on row 2 boxes | PASS/FAIL | |

### Summary
- Total checks: 47
- Passed: X
- Failed: X
- N/A: X
- Notes: [anything unexpected not covered by a specific check]

### Critical Flags (fail-stop issues)
List any FAIL results for: R2D (Style Bias never bearish), C1 (card status logic),
L2 (rspLeading internal consistency), L4 (streak alignment), L6 (20D spread lookback),
V6 (trigger sync at 20D).
These indicate logic bugs rather than data issues and should be investigated immediately.

NOTE: summary.rspLeading and rows[0].status measuring DIFFERENT timeframes (long-run vs 20D)
is correct and expected — do not flag as a failure.
