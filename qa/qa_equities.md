# QA Test: Card 10 — Equities ("The Execution Layer")
# Market Hub — loganbase.com/market-hub

## Your Role
You are a QA reviewer for the Market Hub dashboard. You have no prior context.
Run every check below in order. Report PASS / FAIL / NOTE for each item.
At the end, produce a summary table of results.

---

## STEP 1 — Fetch the Scores API

Fetch: GET https://www.loganbase.com/api/scores

From the JSON response:
- Locate the card where `id = "equities"` (Card 10)
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

CHECK S1: Does the card have exactly 10 rows?
  Expected: rows[0] through rows[9]
  FAIL if fewer or more rows exist

CHECK S2: Do the row labels match exactly?
  rows[0].label = "S&P 500"
  rows[1].label = "Russell 2000"
  rows[2].label = "Nvidia"
  rows[3].label = "JPMorgan"
  rows[4].label = "Caterpillar"
  rows[5].label = "Exxon Mobil"
  rows[6].label = "Freeport-Mc."
  rows[7].label = "Gold Miners"
  rows[8].label = "Cameco"
  rows[9].label = "Emerg. Markets"

CHECK S3: Do the row indicators (tickers) match exactly?
  rows[0].indicator = "SPY"
  rows[1].indicator = "IWM"
  rows[2].indicator = "NVDA"
  rows[3].indicator = "JPM"
  rows[4].indicator = "CAT"
  rows[5].indicator = "XOM"
  rows[6].indicator = "FCX"
  rows[7].indicator = "GDX"
  rows[8].indicator = "CCJ"
  rows[9].indicator = "EEM"

CHECK S4: Is the `note` field present?
  PASS = card.note contains "above both 50d & 200d" or similar
  FAIL = note missing or empty

---

## STEP 4 — Parse vs200 and Determine MA Position for Each Row

Each row's condition text contains the vs200 value in parentheses and one of three
position keywords. Extract for all 10 rows:

  VS200 value: from "(+X.X% vs 200d)" or "(-X.X% vs 200d)" in condition text
  MA position:
    "Trend Intact"   → above both 50d AND 200d (bullish)
    "Pulling Back"   → above 200d only — 50d not recaptured (neutral)
    "Below 200d"     → below 200d SMA (bearish)
    "—"              → data unavailable (neutral)

Build a table:
  Row | Ticker | VS200 | MA Position | Status

---

## STEP 5 — Row-Level Status Logic

Card 10 uses a THREE-STATE logic based on BOTH the 50d and 200d SMA positions.

*** CRITICAL: Unlike most cards, bullish requires BOTH 50d AND 200d above, not just 200d ***

For each of the 10 rows:

CHECK R-ALL-A: Is the status consistent with the MA position keyword?
  "Trend Intact"  keyword → status must = "bullish"
  "Pulling Back"  keyword → status must = "neutral"
  "Below 200d"    keyword → status must = "bearish"
  "—" condition   → status must = "neutral"

CHECK R-ALL-B: Is the condition text format correct?
  bullish → condition must match: "Trend Intact (+X.X% vs 200d) — Execute Long"
  neutral (pulling back) → "Pulling Back (+X.X% vs 200d) — Wait for 50d Recapture"
  bearish → "Below 200d (-X.X% vs 200d) — Step Aside"

Report any row where status and condition text are inconsistent.

---

## STEP 6 — Note Field Validation

The note has three components:
  1. "[X]/10 names above both 50d & 200d."
  2. "Themes firing: [comma-separated list]." (if any)
  3. "Themes stalled: [comma-separated list]." (if any)

The 10 themes and their corresponding tickers:
  market   → SPY     risk      → IWM     tech    → NVDA
  financials → JPM   capex     → CAT     energy  → XOM
  copper   → FCX     gold      → GDX     uranium → CCJ
  global   → EEM

CHECK N1: Does the X/10 count in the note match your bullish row count from Step 4?
  PASS = note count matches actual bullish rows
  FAIL = note count differs

CHECK N2: Do the "Themes firing" match the bullish rows by theme?
  For each bullish row, find its theme in the list above.
  Themes of bullish rows should appear in "Themes firing".
  Themes of non-bullish rows should NOT appear in "Themes firing".
  PASS = themes firing list matches bullish themes
  FAIL = any mismatch

CHECK N3: Do the "Themes stalled" match the non-bullish rows?
  Themes of neutral or bearish rows should appear in "Themes stalled".
  PASS = stalled list matches non-bullish themes
  FAIL = any theme in stalled that actually has a bullish row

---

## STEP 7 — Card Status Logic

Card 10 uses a bull-count rule based on rows above BOTH moving averages:

  bull = count of rows where status = "bullish" (above both 50d & 200d)

  bull >= 7 → card.status = "bullish"
  bull >= 5 → card.status = "neutral"
  bull < 5  → card.status = "bearish"

CHECK C1: Count bullish rows and verify card.status matches:
  PASS = card.status matches the threshold rule
  FAIL = card.status does not match

---

## STEP 8 — Cross-Reference via Yahoo Finance

Verify two names against Yahoo Finance — one bullish, one neutral or bearish.

Select: rows[0] (SPY — should always be available and reliable) and one of the
neutral/bearish rows if any exist.

Fetch SPY:
  GET https://query1.finance.yahoo.com/v8/finance/chart/SPY?interval=1d&range=300d
  Extract: meta.regularMarketPrice (current price)
  Calculate SMA200 from last 200 daily closes
  Calculate SMA50 from last 50 daily closes

CHECK X1: Does SPY price match rows[0].value?
  Allow ±$0.10 tolerance
  PASS = prices match

CHECK X2: Is SPY above BOTH its 50d and 200d SMA per Yahoo?
  IF Yahoo confirms SPY above both → rows[0].status should = "bullish"
  IF Yahoo shows SPY below either  → rows[0].status should NOT be "bullish"
  PASS = Yahoo MA position matches card row status
  FAIL = mismatch

If a neutral or bearish row exists, spot-check one:
  Fetch that ticker using the same methodology.

CHECK X3: Does the spot-checked name's MA position match Yahoo?
  PASS = Yahoo confirms the "Pulling Back" or "Below 200d" condition
  FAIL = Yahoo shows a different position than the card

---

## STEP 9 — Delta Field

CHECK D1: Is the `delta` field present on the card?
  Expected values: "up" | "down" | "same"
  PASS = field exists and contains one of these three values

---

## REPORT FORMAT

### Card 10 Equities — QA Results [DATE]

| Check | Description | Result | Notes |
|-------|-------------|--------|-------|
| F1   | Timestamp freshness | PASS/FAIL | |
| F2   | Source field valid | PASS/FAIL | Value: X |
| S1   | Row count = 10 | PASS/FAIL | |
| S2   | Row labels correct | PASS/FAIL | |
| S3   | Row indicators correct | PASS/FAIL | |
| S4   | Note field present | PASS/FAIL | |
| R-A  | All row statuses match MA position | PASS/FAIL | List failures |
| R-B  | All condition text formats correct | PASS/FAIL | List failures |
| N1   | Note X/10 count correct | PASS/FAIL | Note: X, Actual: X |
| N2   | Themes firing matches bullish rows | PASS/FAIL | |
| N3   | Themes stalled matches non-bullish | PASS/FAIL | |
| C1   | Card status (bull count) | PASS/FAIL | Bull: X/10, Status: X |
| X1   | SPY price vs Yahoo | PASS/FAIL | Hub: $X, Yahoo: $X |
| X2   | SPY MA position vs Yahoo | PASS/FAIL | |
| X3   | Spot-check non-bullish name | PASS/FAIL/N-A | Ticker: X |
| D1   | Delta field present | PASS/FAIL | Value: X |

### Watchlist Summary
  | Ticker | Theme | VS200 | MA Position | Status |
  |--------|-------|-------|-------------|--------|
  | SPY    | market | X% | Trend Intact/Pulling Back/Below 200d | B/N/B |
  | IWM    | risk   | X% | ... | ... |
  | NVDA   | tech   | X% | ... | ... |
  | JPM    | financials | X% | ... | ... |
  | CAT    | capex  | X% | ... | ... |
  | XOM    | energy | X% | ... | ... |
  | FCX    | copper | X% | ... | ... |
  | GDX    | gold   | X% | ... | ... |
  | CCJ    | uranium | X% | ... | ... |
  | EEM    | global | X% | ... | ... |

  Themes firing: [list]
  Themes stalled: [list]
  Bull count: X/10 → Status: Bullish/Neutral/Bearish

### Summary
- Total checks: 16
- Passed: X
- Failed: X
- Notes: [anything unexpected]

### Critical Flags
List any FAIL for: C1 (status), N2/N3 (theme accuracy), R-A (status consistency)
The most important check unique to this card is N2 — if themes firing doesn't match
the bullish rows exactly, the note is misleading investors about which themes are active.
