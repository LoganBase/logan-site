# Market Hub — Deep Dive Standards (V2 React/SVG Desktop Kit)

Documents the conventions for each card's expanded deep-dive view — `DeepDiveContent` in `ui_kits/desktop/desktop-parts.jsx`, built on the shared `DeepChartLg` SVG chart. Supersedes the old Chart.js/V1 standards (solid-square legend config, `.modal-section-title` CSS class, `range-btn` class) — none of that applies to V2. Card 1 (Regime) is the reference implementation.

---

## Section order (`DeepDiveContent`, desktop-parts.jsx)

Default path (most cards):

1. **Chart card** — title/subtitle/value header + `DeepChartLg`.
2. **`{Card Title} History`** — `RegimeTimeline`, always pinned to **1Y** data, independent of the chart's own range selector.
3. **Flags row** — Global Flows only (`card.flags`).
4. **Indicators** — `IndicatorTable` (`card.rows`).
5. **Country Breakdown** — Global Flows only (`card.details`).
6. **Key Metrics** (or **Regime Metrics** for Regime specifically) — `StatBoxes` (`card.stats`).
7. **Summary** — `card.note`, with Regime's Q&A box (`buildRegimeQA`) prepended above the note paragraph.

Breadth and Equities have fully custom paths (`cardId === 'breadth'` / `'equities'` branches) — they replace the chart card with a dedicated component (`NyseBreadthChart` / `EquitiesChart`) and reorder sections to fit. Breadth's order: NYSE Breadth chart → Breadth History → Sector ETF Breadth chart → Sector Breakdown → Indicators → Key Metrics → Summary. A new card only needs a custom path if it has more than one chart or a non-standard breakdown table; otherwise use the default path.

---

## `DeepChartLg` (desktop-parts.jsx)

Shared SVG line/area chart. Key props: `card, cardId, color, height, range, setRange, live, ranges`.

- `ranges` defaults to `['1W','1M','3M','6M','1Y','5Y','10Y']`. Override per-card via the `cardId`-scoped ternary at the call site (see "Scoping a feature to one card" below) — Regime currently adds `'20Y'`.
- `conf` is the fallback `{ range: [n, vol] }` map used to generate a synthetic series when `live` data is absent — add an entry here for any new range token before wiring it into the UI.
- `live` object shape (built by `market-hub-adapter.js`'s `HISTORY[cardId].extract()`):
  ```js
  {
    values: number[],            // primary series
    dates: string[],
    label: string,                 // primary series legend label, default 'SPY'
    format: 'price'|'pct'|'pct_abs'|'count',  // controls tooltip value formatting
    lineColor: string,             // optional override of the primary line color
    overlays: [{ label, values, color, dash }],  // e.g. 50d/200d SMA lines
    colorBy: number[],             // optional — drives segment-by-segment line coloring
    colorByFn: (v) => color,       // optional custom function for colorBy
    thresholds: [{ y, color }],    // optional dashed horizontal reference lines
    rsi: number[],                 // optional — renders the RSI sub-panel + tooltip row
    vs200, vs50: number[],         // Regime-specific — drive the tooltip's % rows (see below)
  }
  ```
- Legend renders only when `overlays.length > 0`; clicking a legend item toggles that series via internal `hidden` state.
- Hover tooltip always shows: date header, then primary + overlay rows (dot-colored, formatted per `live.format` via `fmtVal`). Below that, two **optional** sections:
  1. **Percentage rows** — rendered only if `live.vs200` or `live.vs50` is present. Each row gets its **own independently-defined** banding/tone function — do not reuse another row's tone function just because the values or names look similar; two metrics can legitimately have different thresholds even when they sound alike (e.g. "% above 200d" vs. the Trend Cross row's 50d-vs-200d spread are two different numbers). Pattern:
     ```js
     const someTone = (v) => v > HI ? 'bearish' : v > MID ? 'neutral' : v >= 0 ? 'bullish' : v >= -MID ? 'neutral' : 'bearish';
     // then: color: DSIG[someTone(value)].c
     ```
  2. **RSI row** — rendered only if `rsiData` is present. Fixed bands: `>70` Overbought, `>50` Bullish Momentum, `>40` Neutral, `>30` Bearish Momentum, else Oversold; color via `rsiCol(v)`.
- Range buttons + a "Live"/"Sample" data-source indicator render below the chart; the legend (if any) renders below that.

---

## Established Regime (Card 1) banding reference

Copy the *shape* of these — not necessarily the exact numbers — when a new card needs a 3- or 5-band classifier on its chart or tooltip:

- Row 1 "SPY Regime" (binary, no neutral): `price > sma200` → bullish, else bearish.
- Row 2 "Stretch Risk" (vs200, 5-band): `>14` bearish, `>10` neutral, `>=0` bullish, `>=-10` neutral, else bearish.
- Row 3 "Trend Cross" (50d-vs-200d spread, 3-band): `>8` bullish, `>=-8` neutral, else bearish.
- Tooltip-only "% above 50d" (price vs 50d SMA, 5-band — a distinct metric from Row 3): `>8` bearish, `>5` neutral, `>=0` bullish, `>=-5` neutral, else bearish.
- Card-level master override: `status = isBull ? cardStatus(rows) : 'bearish'`.

---

## Scoping a feature to a single card

When adding a feature (extra range button, extra tooltip row, upgraded sparkline) that should apply to only one card, scope it with a ternary on `cardId` (or `id`) at the call site — don't change the shared component's default behavior for every card.

```jsx
ranges={cardId === 'regime' ? ['1W','1M','3M','6M','1Y','5Y','10Y','20Y'] : undefined}
```
```jsx
{id === 'regime' ? <RegimeMiniSpark seed={c.seed} trend={c.trend} color={sg.c} .../> : <SparkD seed={c.seed} trend={c.trend} color={sg.c} .../>}
```

This is the established pattern for both the 20Y range button and the live-data sparkline (`RegimeMiniSpark` in `desktop-app.jsx` — fetches real 1W SPY history and falls back to the synthetic `SparkD` while loading). New cards should follow the same scoping approach rather than forking the shared component or adding card-specific branches inside it.

---

## Adapter wiring (`market-hub-adapter.js`)

- Add any new range token to `RANGE_MAP` (UI label → API token) before wiring a new range button.
- Add an entry to `HISTORY[cardId]` — either `{ url, field }` for a flat numeric series, or `{ url, extract(data) }` when building overlays/colorBy/percentage fields. `HISTORY.regime` is the fullest example to copy from.
- Verify the underlying API/D1 source actually has the history before exposing a new range in the UI — for Regime's 20Y option this was confirmed via a direct D1 query showing `daily_prices` has SPY history back to 2006-06-05.

---

## Summary Q&A box pattern (`buildRegimeQA`, desktop-parts.jsx)

Currently Regime-only. Generates 3 fixed framing questions, answered dynamically from `card.rows` / `card.stats`:

1. "Classification of the current market?" ← Row 1's condition text, toned by Row 1's status.
2. "Define the current period in context to historical precedents?" ← built from the `Percentile Rank` + `Regime Duration` stats.
3. "Assess the strength and maturity of the prevailing trend?" ← built from Row 2 + Row 3 condition text plus the `Extension Velocity` stat.

If a new card needs a similar Q&A framing box, write an analogous `buildXQA(card)` function and gate its rendering the same way Regime's is gated in `DeepDiveContent` (`cardId === 'x' && (...)`). Don't generalize this into one shared function until at least 2–3 cards actually need it.

---

## Compliance Tracker (V2)

| # | Card | `DeepChartLg` wired (live + ranges) | Tooltip extra rows documented | Custom `DeepDiveContent` path | Reviewed |
|---|------|---|---|---|---|
| 01 | Regime | ✅ (incl. 20Y, RSI, % above 200d/50d rows) | ✅ | No (default path + Q&A box) | ✅ |
| 02 | Leadership | ✅ (RSP vs SPY + QQEW overlay) | — | No | — |
| 03 | Breadth | ✅ (custom `NyseBreadthChart` + `SectorBreadthChart`) | — | Yes | — |
| 04 | Valuations | — | — | — | — |
| 05 | Yield | — | — | — | — |
| 06 | Credit | — | — | — | — |
| 07 | Global Flows | ✅ (ACWI series) | — | No | — |
| 08 | Sectors | ✅ (cycVsDef series) | — | No | — |
| 09 | Commodities | ✅ (USCI series) | — | No | — |
| 10 | Equities | ✅ (custom `EquitiesChart`, multi-series) | — | Yes | — |

---

## Update Process

1. Build/extend the chart wiring in `market-hub-adapter.js` (`HISTORY[cardId]`).
2. Reuse `DeepChartLg` via the default `DeepDiveContent` path unless the card genuinely needs multiple charts or a non-standard breakdown table.
3. Scope any card-specific chart feature (extra range, extra tooltip row, custom legend) via a `cardId` ternary, per "Scoping a feature to a single card" above.
4. Update the Compliance Tracker row above once verified live in the browser.
