# QA Test: Card 07 — Currency ("The FX Pulse")
# Market Hub — loganbase.com/market-hub

## Your Role
You are a QA reviewer for the Market Hub dashboard. You have no prior context.
Run every check below in order. Report PASS / FAIL / NOTE for each item.
At the end, produce a summary table of results.

---

## ARCHITECTURE NOTE — Read Before Starting

The Currency card has a two-layer data architecture that is unlike the other cards:

**Layer 1 — Card tile & summary (SEED DATA)**
The currency card is not yet returned by the live `/api/scores` endpoint. When the scores
API is fetched, `id = "currency"` will be absent from the response. The adapter injects
the card from `glance-data.js` seed data instead. This means the card tile values
(UUP/FXE/FXY vs 200d, card status, rows, stats) are STATIC and do NOT update
automatically with live market prices.

**Layer 2 — Deep-dive Metrics Boxes (LIVE DATA)**
The 3×3 Metrics grid in the deep dive fetches live data independently from
`/api/history?symbol=X&range=1y` for each of UUP, FXE, and FXY. These values
ARE live and will differ from the seed values on the card tile.

This split is intentional during the build-out phase. Keep it in mind when comparing
tile values to deep-dive metrics — discrepancies between the two are expected and not bugs.

---

## STEP 1 — Fetch the Scores API

Fetch: GET https://www.loganbase.com/api/scores

CHECK A1: Is `id = "currency"` ABSENT from the live scores response?
  PASS = currency card is NOT in the API response (expected — seed-only card)
  NOTE = if currency IS in the API response, the card has been promoted to live;
         update this QA file and remove the seed-data caveats below.

Also extract: `timestamp` and `source` from the top-level response.

CHECK F1: Is `timestamp` from today's date (UTC)?
  PASS = timestamp date matches today
  FAIL = timestamp is stale (yesterday or older)

CHECK F2: Is the top-level `source` field present and valid?
  Expected values: "d1" | "yahoo" | "d1+yahoo"
  PASS = field exists and contains one of these three values

---

## STEP 2 — Verify Seed Card Is Injected

Open the Market Hub dashboard (https://loganbase.com/market-hub).

CHECK SI1: Is the Currency card visible in the "Macro Pricing" group on the dashboard?
  PASS = Currency card appears as the 4th card in the Macro Pricing row
  FAIL = Currency card is missing entirely

CHECK SI2: Does the card tile show a UUP vs 200d value as the metric?
  Expected label on tile: "US Dollar Index" / "UUP" / "vs 200-day SMA" (or similar)
  PASS = a percentage value is displayed (e.g. "+4.2%")
  FAIL = tile shows "—" or no metric value

---

## STEP 3 — Seed Card Structure

The seed card (from glance-data.js) is the source of truth for the card tile.
Retrieve it from the dashboard's loaded data or verify visually.

Expected seed structure:
  rows[0]: label = "UUP (Dollar)",  indicator relates to 200d SMA, status = "bearish"
  rows[1]: label = "FXE (Euro)",    indicator relates to 200d SMA, status = "bearish" or "bullish"
  rows[2]: label = "FXY (Yen)",     indicator relates to 200d SMA, status = "neutral"
  rows[3]: label = "FX Regime",     value = "Mixed" or "Aligned", status = "neutral"

  stats[0]: label = "UUP vs 200d",  value = signed % (e.g. "+0.8%"), tone = "neg" or "pos"
  stats[1]: label = "FXE vs 200d",  value = signed % (e.g. "−1.2%")
  stats[2]: label = "FXY vs 200d",  value = signed % (e.g. "−0.6%")

CHECK S1: Does the card have exactly 4 rows in the seed data?
  PASS = 4 rows present
  FAIL = row count differs

CHECK S2: Does rows[3] label = "FX Regime"?
  PASS = label is "FX Regime"
  NOTE = FX Regime is a context-only row — its status does NOT count toward card.status

CHECK S3: Does the card have at least 3 stats entries (UUP/FXE/FXY vs 200d)?
  PASS = stats[0], stats[1], stats[2] all present
  FAIL = stats missing or fewer than 3 entries

---

## STEP 4 — Fetch Live History API for UUP, FXE, FXY

These three calls are the source of truth for the deep-dive Metrics section.

Fetch:
  GET https://www.loganbase.com/api/history?symbol=UUP&range=1y
  GET https://www.loganbase.com/api/history?symbol=FXE&range=1y
  GET https://www.loganbase.com/api/history?symbol=FXY&range=1y

From each response, extract the `summary` object:
  currentClose    — latest ETF close price
  currentSma200   — current 200-day simple moving average
  currentVs200    — % distance above/below 200d SMA (positive = above, negative = below)
  currentRoc10    — 10-day rate of change (Ext. Velocity)
  daysInZone      — consecutive trading days on current side of 200d SMA
  zone            — "mild-bull" | "bull" | "mild-bear" | "bear"
  percentile      — historical percentile (may be null for FXE and FXY — this is expected)

CHECK H1: Does the UUP history response contain a `summary` object with all expected fields?
  PASS = summary exists with currentVs200, currentRoc10, daysInZone, zone
  FAIL = summary missing or fields null/undefined (excluding percentile which may be null)

CHECK H2: Does the FXE history response contain the expected summary fields?
  PASS = summary exists with currentVs200, currentRoc10, daysInZone, zone
  NOTE = percentile may be null for FXE — this is expected behaviour

CHECK H3: Does the FXY history response contain the expected summary fields?
  PASS = summary exists with currentVs200, currentRoc10, daysInZone, zone
  NOTE = percentile may be null for FXY — this is expected behaviour

Record the live values for use in later checks:
  UUP_VS200    = summary.currentVs200   (e.g. +4.20)
  UUP_ROC10    = summary.currentRoc10   (e.g. +1.37)
  UUP_ZONE     = summary.zone           (e.g. "mild-bull")
  UUP_DAYS     = summary.daysInZone     (e.g. 99)
  FXE_VS200    = summary.currentVs200   (e.g. -2.33)
  FXE_ROC10    = summary.currentRoc10   (e.g. -1.16)
  FXE_ZONE     = summary.zone           (e.g. "mild-bear")
  FXE_DAYS     = summary.daysInZone     (e.g. 27)
  FXY_VS200    = summary.currentVs200   (e.g. -3.71)
  FXY_ROC10    = summary.currentRoc10   (e.g. -0.81)
  FXY_ZONE     = summary.zone           (e.g. "mild-bear")
  FXY_DAYS     = summary.daysInZone     (e.g. 179)

---

## STEP 5 — Deep Dive: History Timeline

Open the Currency deep dive by clicking the Currency card.

The history timeline (RegimeTimeline) uses UUP closing prices, coloured by the
INVERTED vs200 signal: USD above 200d = tighter financial conditions = bearish (red),
USD below 200d = loosening = bullish (green).

CHECK TL1: Does the history timeline render with colour data (not all grey)?
  PASS = timeline shows coloured segments (green and/or red bars)
  FAIL = timeline is all grey / all one colour / blank

CHECK TL2: Is the colour direction INVERTED relative to UUP's 200d position?
  UUP currently above 200d (UUP_VS200 > 0) → current period should be RED (bearish)
  UUP currently below 200d (UUP_VS200 < 0) → current period should be GREEN (bullish)
  PASS = current rightmost bar colour matches the above rule
  FAIL = colour is the wrong direction (would indicate colorBy inversion is broken)

CHECK TL3: Does the timeline respond to range changes (1M / 3M / 6M / 1Y / 3Y / 5Y)?
  PASS = timeline updates when range buttons are clicked
  FAIL = timeline does not respond or errors on range change

---

## STEP 6 — Deep Dive: Sparkline (3-Line)

CHECK SP1: Does the Currency sparkline in the score tile / deep dive header show 3 lines?
  Expected colours (bottom to top):
    FXY (Yen)   — #22c55e  (green)
    FXE (Euro)  — #22d3ee  (cyan)
    UUP (Dollar)— #a855f7  (purple)
  PASS = 3 distinct coloured lines visible
  FAIL = fewer than 3 lines, or lines are wrong colours

CHECK SP2: Do the sparkline lines show realistic FX movement (not flat or identical)?
  PASS = lines diverge from each other — each ETF has distinct price behaviour
  FAIL = all lines are flat, identical, or clearly synthetic

---

## STEP 7 — Deep Dive: Indicators Table (Must Be Hidden)

CHECK IND1: Is the "INDICATORS" section ABSENT from the Currency deep dive?
  PASS = no Indicators table visible in the Currency deep dive
  FAIL = an Indicators table appears (it is intentionally suppressed for this card —
         currency signals are surfaced through the Metrics Boxes instead)

---

## STEP 8 — Deep Dive: Currency Metrics 3×3 Grid

Open the Currency deep dive and scroll to the "Key Metrics" section.

The section must render 3 rows of 3 StatBoxes each (9 boxes total):
  Row 1 — vs 200d:        [UUP vs 200d]        [FXE vs 200d]        [FXY vs 200d]
  Row 2 — Days in Zone:   [UUP — Days in Zone]  [FXE — Days in Zone]  [FXY — Days in Zone]
  Row 3 — Ext. Velocity:  [UUP — Ext. Velocity] [FXE — Ext. Velocity] [FXY — Ext. Velocity]

CHECK M1: Do all 9 boxes render with non-"—" values?
  PASS = all 9 boxes show live values
  FAIL = any box shows "—" (data not loading or API error)
  NOTE: values come from /api/history, not the seed card — they will differ from the tile

CHECK M2: Are the vs 200d values (Row 1) consistent with the live API summary?
  UUP box value should match UUP_VS200 (allow ±0.05%)
  FXE box value should match FXE_VS200 (allow ±0.05%)
  FXY box value should match FXY_VS200 (allow ±0.05%)
  PASS = all 3 match within tolerance
  FAIL = values diverge significantly

CHECK M3: Are the Days in Zone values (Row 2) consistent with the live API summary?
  UUP box should show UUP_DAYS formatted as e.g. "99d"
  FXE box should show FXE_DAYS formatted as e.g. "27d"
  FXY box should show FXY_DAYS formatted as e.g. "179d"
  PASS = values match API summary (allow ±1 day for intraday timing)
  FAIL = values diverge significantly or format is wrong (must end in "d")

CHECK M4: Are the Ext. Velocity values (Row 3) consistent with the live API summary?
  UUP box should match UUP_ROC10 (allow ±0.05%)
  FXE box should match FXE_ROC10 (allow ±0.05%)
  FXY box should match FXY_ROC10 (allow ±0.05%)
  PASS = all 3 match within tolerance
  FAIL = values diverge significantly

CHECK M5: Are the box value colours correct for UUP (dollar strength = bad for risk assets)?
  UUP vs200 > 2%     → value text RED   (neg tone: strong dollar, bearish signal)
  UUP vs200 0–2%     → value text AMBER (neutral: mildly firm dollar)
  UUP vs200 < 0%     → value text GREEN (pos tone: weak dollar, bullish signal)
  PASS = UUP Row 1 box colour matches UUP_VS200 using the above rule
  FAIL = colour is wrong

  UUP roc10 > +1%    → value text RED   (accelerating dollar, bearish for risk)
  UUP roc10 -1–+1%   → value text AMBER
  UUP roc10 < -1%    → value text GREEN (dollar decelerating, bullish for risk)
  PASS = UUP Row 3 box colour matches UUP_ROC10

CHECK M6: Are the box value colours correct for FXE (euro strength = bullish for risk)?
  FXE vs200 > +2%    → value text GREEN (pos tone: euro strong, bullish signal)
  FXE vs200 -2–+2%   → value text AMBER (neutral)
  FXE vs200 < -2%    → value text RED   (neg tone: euro weak, bearish signal)
  PASS = FXE Row 1 box colour matches FXE_VS200

  FXE roc10 > +1%    → value text GREEN
  FXE roc10 -1–+1%   → value text AMBER
  FXE roc10 < -1%    → value text RED
  PASS = FXE Row 3 box colour matches FXE_ROC10

CHECK M7: Is FXY always shown in AMBER (neutral tone)?
  FXY boxes in all 3 rows should show AMBER value text (yen is context-dependent)
  PASS = all 3 FXY boxes have amber/yellow text
  FAIL = FXY shows red or green value text

CHECK M8: Are direction arrows present on all 9 boxes?
  Direction arrow semantics (positiveDir=false for UUP; positiveDir=true for FXE; none for FXY):
    UUP: neg tone → ▼ green arrow (strong dollar = signal pointing down for risk assets)
         pos tone → ▲ red arrow   (weak dollar = signal pointing up for risk assets)
    FXE: pos tone → ▲ green arrow (euro strong = bullish up)
         neg tone → ▼ red arrow   (euro weak = bearish down)
    FXY: no direction arrow on any FXY box (neutral / context-dependent)
  PASS = UUP and FXE boxes all have direction arrows; FXY boxes have none
  NOTE = flag if FXY shows arrows or if UUP/FXE are missing arrows

CHECK M9: Do hover tooltips (triggers) appear on vs 200d boxes (Row 1)?
  Hover over UUP vs 200d → threshold breakdown should appear ("Strong > +2%", etc.)
  Hover over FXE vs 200d → threshold breakdown should appear
  Hover over FXY vs 200d → threshold breakdown should appear
  PASS = tooltips appear on hover for all 3 Row 1 boxes
  FAIL = no tooltip, or tooltip appears on wrong boxes

CHECK M10: Do hover tooltips appear on Ext. Velocity boxes (Row 3)?
  Hover over UUP Ext. Velocity, FXE Ext. Velocity, FXY Ext. Velocity
  PASS = tooltips appear on hover for all 3 Row 3 boxes
  FAIL = tooltips missing on Row 3

CHECK M11: Do Days in Zone boxes (Row 2) show a zone description as the sub-label?
  Expected desc: "above 200d SMA" when zone includes "bull"; "below 200d SMA" when "bear"
  UUP zone "mild-bull" → desc = "above 200d SMA"
  FXE zone "mild-bear" → desc = "below 200d SMA"
  FXY zone "mild-bear" → desc = "below 200d SMA"
  PASS = all 3 zone descriptions are correct
  FAIL = desc says "above" when ETF is below 200d (or vice versa)

---

## STEP 9 — Seed Row Logic Verification

The card tile rows use seed values. Verify that the seed data is internally consistent.
(These checks will evolve to live API checks once the currency card is promoted to the scores API.)

Using seed values from the card tile:

CHECK R0A: UUP (Dollar) — status logic
  UUP above 200d (vs200 > 0) → rows[0].status must = "bearish"
    (strong dollar = tightening financial conditions = bearish for risk assets)
  UUP below 200d (vs200 < 0) → rows[0].status must = "bullish"
  PASS = status is consistent with the seed vs200 value
  FAIL = status contradicts the seed value

CHECK R0B: UUP condition text
  "bearish" → condition must contain "above 200d" and reference to tightening
  "bullish" → condition must contain "below 200d"

CHECK R1A: FXE (Euro) — status logic
  FXE above 200d → rows[1].status must = "bullish"
  FXE below 200d → rows[1].status must = "bearish"

CHECK R2A: FXY (Yen) — status always neutral in seed
  rows[2].status must = "neutral" (yen is context-dependent; not scored directionally)

CHECK R3A: FX Regime — context-only row
  rows[3].label must = "FX Regime"
  rows[3].status must = "neutral"
  NOTE: FX Regime does NOT count toward card.status

---

## STEP 10 — Card Status Logic

When currency is seed-only, card.status is hardcoded to the seed value.
When the card is promoted to the live scores API, verify the following rule:

Count bullish statuses across rows[0..2] ONLY (exclude FX Regime):
  BULLISH_COUNT = count of "bullish" among rows[0], rows[1], rows[2]
  BEARISH_COUNT = count of "bearish" among rows[0], rows[1], rows[2]

  BEARISH_COUNT > BULLISH_COUNT → card.status = "bearish"
  BULLISH_COUNT > BEARISH_COUNT → card.status = "bullish"
  equal or all neutral          → card.status = "neutral"

CHECK O1: (Seed-only) Does the seed card.status = "neutral"?
  PASS = card.status = "neutral" (expected seed value)
  NOTE = if card.status ≠ "neutral", the seed data may have been modified

CHECK O2: Is FX Regime (rows[3]) correctly excluded from card status scoring?
  PASS = card.status would not change if rows[3] were removed from the count
  FAIL = card.status depends on rows[3].status (this would be a logic bug)

---

## STEP 11 — Delta Field

CHECK D1: Is the `delta` field present on the seed card?
  Expected values: "up" | "down" | "same"
  PASS = field exists and contains one of these three values
  NOTE: delta is static in the seed — it will only become meaningful once the card
        is promoted to the live scores API

---

## REPORT FORMAT

Produce your findings in this format:

### Card 07 Currency — QA Results [DATE]

| Check | Description | Result | Notes |
|-------|-------------|--------|-------|
| A1   | Currency absent from live scores API | PASS/NOTE | (NOTE if promoted to live) |
| F1   | Scores API timestamp freshness | PASS/FAIL | |
| F2   | Source field valid | PASS/FAIL | Value: d1/yahoo/etc |
| SI1  | Currency card visible on dashboard | PASS/FAIL | |
| SI2  | Card tile shows UUP vs 200d metric | PASS/FAIL | Value: X% |
| S1   | Seed: 4 rows present | PASS/FAIL | |
| S2   | Seed: rows[3] = FX Regime | PASS/FAIL | |
| S3   | Seed: 3 stats entries | PASS/FAIL | |
| H1   | History API: UUP summary complete | PASS/FAIL | vs200: X%, roc10: X%, days: X |
| H2   | History API: FXE summary complete | PASS/FAIL | vs200: X%, roc10: X%, days: X |
| H3   | History API: FXY summary complete | PASS/FAIL | vs200: X%, roc10: X%, days: X |
| TL1  | Timeline renders with colour | PASS/FAIL | |
| TL2  | Timeline colour direction inverted correctly | PASS/FAIL | UUP vs200: X% → colour |
| TL3  | Timeline responds to range changes | PASS/FAIL | |
| SP1  | Sparkline: 3 lines with correct colours | PASS/FAIL | |
| SP2  | Sparkline: lines show distinct movement | PASS/FAIL | |
| IND1 | Indicators table absent from deep dive | PASS/FAIL | CRITICAL |
| M1   | Metrics: all 9 boxes render | PASS/FAIL | |
| M2   | Metrics: vs200 values match API | PASS/FAIL | UUP:X% FXE:X% FXY:X% |
| M3   | Metrics: Days in Zone match API | PASS/FAIL | UUP:Xd FXE:Xd FXY:Xd |
| M4   | Metrics: Ext. Velocity values match API | PASS/FAIL | UUP:X% FXE:X% FXY:X% |
| M5   | Metrics: UUP box colours correct | PASS/FAIL | |
| M6   | Metrics: FXE box colours correct | PASS/FAIL | |
| M7   | Metrics: FXY boxes always amber | PASS/FAIL | |
| M8   | Metrics: direction arrows correct | PASS/FAIL | UUP/FXE arrows present, FXY none |
| M9   | Metrics: Row 1 hover tooltips work | PASS/FAIL | |
| M10  | Metrics: Row 3 hover tooltips work | PASS/FAIL | |
| M11  | Metrics: Days in Zone desc correct | PASS/FAIL | |
| R0A  | Seed: UUP status consistent with vs200 | PASS/FAIL | |
| R0B  | Seed: UUP condition text correct | PASS/FAIL | |
| R1A  | Seed: FXE status consistent with vs200 | PASS/FAIL | |
| R2A  | Seed: FXY status = neutral | PASS/FAIL | |
| R3A  | Seed: FX Regime row = neutral | PASS/FAIL | |
| O1   | Card status = neutral (seed) | PASS/NOTE | |
| O2   | FX Regime excluded from status count | PASS/FAIL | |
| D1   | Delta field present | PASS/NOTE | Value: up/down/same |

### FX Snapshot (record live values at time of QA)
  - UUP:  close $X.XX | vs200 X.XX% | zone X | days in zone X | roc10 X.XX%
  - FXE:  close $X.XX | vs200 X.XX% | zone X | days in zone X | roc10 X.XX%
  - FXY:  close $X.XX | vs200 X.XX% | zone X | days in zone X | roc10 X.XX%
  - Dollar regime: Strong (UUP > 200d) / Weak (UUP < 200d)

### Architecture Notes
  - Seed-only card: YES (currency not yet in /api/scores)
  - Deep-dive metrics: LIVE (fetched from /api/history per ETF)
  - Indicators table: SUPPRESSED (intentional — replaced by Metrics Boxes)
  - When currency is promoted to live scores API: re-run all seed checks against live data
    and remove the A1 / O1 seed caveats from this file.

### Summary
- Total checks: 36
- Passed: X
- Failed: X
- N/A: X
- Notes: [anything unexpected not covered by a specific check]

### Critical Flags (fail-stop issues)
List any FAIL for: IND1 (Indicators table visible when it should be hidden),
TL2 (timeline colour wrong direction — inverted logic broken),
M2/M3/M4 (metrics values diverge from API — data pipeline broken),
O2 (FX Regime incorrectly included in card status scoring).
