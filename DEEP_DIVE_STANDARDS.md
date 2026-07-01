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

- `ranges` defaults to `['1W','1M','3M','6M','1Y','5Y','10Y']` (cards 1–4 fallback). **Cards 5–10 standard: `['20D','1W','1M','3M','6M','1Y','5Y','10Y']`** — set via `(cardId === 'commodities' || cardId === 'equities') ? [...] : undefined` for the shared `DeepChartLg` call, and baked directly into each card's custom chart component (YieldChart, CreditChart, CreditSpreadChart, GlobalFlowsChart, CycVsDefChart, SectorsWatchlistChart, CountryWatchlistChart, CommoditiesWatchlistChart, EquitiesChart). Exception: `EquitiesFocusChart` retains `['20D','50D','100D']`. Regime retains `['20D','1W','1M','3M','6M','1Y','5Y','10Y','20Y']` (includes 20Y).
- `conf` is the fallback `{ range: [n, vol] }` map used to generate a synthetic series when `live` data is absent — add an entry here for any new range token before wiring it into the UI. Current entries: `'20D': [20, 0.18]`, `'1W': [7, 0.09]`, `'1M': [24, 0.16]`, `'3M': [44, 0.135]`, `'6M': [56, 0.115]`, `'1Y': [64, 0.10]`, `'5Y': [70, 0.082]`, `'10Y': [80, 0.07]`, `'20Y': [90, 0.06]`.
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

## Tab buttons (selector buttons)

Charts with multiple views use tab/selector buttons (e.g., "Risk / Quality / Global" in GlobalFlowsChart, "10Y−2Y / 10Y−3M" in YieldSpreadChart). The button style is:

| State    | Background      | Border                   |
|---|---|---|
| Active   | `#1b2736`       | `1px solid #243446`      |
| Inactive | `transparent`   | `1px solid transparent`  |

**The border color is always the static grey `#243446` — it never changes to the active tab's accent color.** Only the background changes. Reference implementation is `CreditChart`; the pattern is also in `YieldChart`, `YieldSpreadChart`, and `GlobalFlowsChart`.

```js
const tabBtn = (active) => ({
  background: active ? '#1b2736' : 'transparent',
  border: `1px solid ${active ? '#243446' : 'transparent'}`,
  // ... padding, borderRadius, color, cursor, fontSize
});
```

---

## Live / Stale / Sample indicator

Every chart renders a status dot + label below the range buttons to show data freshness.

| State   | Dot color | Glow                          | Label                  |
|---|---|---|---|
| No data | `#64748b` | none                          | `Sample` or `Loading…` |
| Stale   | `#f59e0b` | `0 0 6px rgba(245,158,11,.6)` | `Stale · YYYY-MM-DD`   |
| Live    | `#22c55e` | `0 0 6px #22c55e`             | `Live`                 |

**Stale logic** — compare the last date in the data against the previous business day (not today):

```js
const lastDate = live?.dates?.[live.dates.length - 1];
const todayStr = (() => {
  const d = new Date(), dw = d.getDay();
  d.setDate(d.getDate() - (dw === 1 ? 3 : dw >= 2 ? 1 : 0));
  return d.toISOString().slice(0, 10);
})();
const dow     = new Date().getDay();
const isStale = live && lastDate && lastDate < todayStr && dow !== 0 && dow !== 6;
```

Key detail: on Monday `dw === 1`, subtract 3 days → Friday, so Friday data correctly reads as "Live" rather than "Stale". On Tue–Fri subtract 1 day (yesterday). Weekends are guarded by `dow !== 0 && dow !== 6` and never show Stale.

This block is duplicated in `DeepChartLg` and in every custom chart component (`EquitiesChart`, `SectorsWatchlistChart`, `CommoditiesWatchlistChart`, `CountryWatchlistChart`) — update all occurrences together if the logic ever changes.

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
ranges={
  cardId === 'leadership' ? ['20D','50D','200D']
  : cardId === 'regime' ? ['20D','1W','1M','3M','6M','1Y','5Y','10Y','20Y']
  : (cardId === 'commodities' || cardId === 'equities') ? ['20D','1W','1M','3M','6M','1Y','5Y','10Y']
  : undefined  // cards 3–4 fall through to default ['1W','1M','3M','6M','1Y','5Y','10Y']
}
```
```jsx
{id === 'regime' ? <RegimeMiniSpark seed={c.seed} trend={c.trend} color={sg.c} .../> : <SparkD seed={c.seed} trend={c.trend} color={sg.c} .../>}
```

This is the established pattern for both the 20Y range button and the live-data sparkline (`RegimeMiniSpark` in `desktop-app.jsx` — fetches real **20D** SPY history and falls back to the synthetic `SparkD` while loading). New cards should follow the same scoping approach rather than forking the shared component or adding card-specific branches inside it.

### RegimeMiniSpark — dual-line implementation

`RegimeMiniSpark` (in `desktop-app.jsx`) loads from `/api/history?symbol=SPY&range=20d` and renders a **dual-line SVG** on the collapsed card tile:

| Series | Color | Source |
|---|---|---|
| SPY price (primary) | `#22d3ee` (cyan) | `r.values` |
| 200d SMA (overlay) | `#a855f7` (purple) | `r.overlays[1].values` (label `'200d SMA'`) |

Both lines share the same Y axis (scaled together across all non-null values). SPY is drawn on top (rendered last). The component falls back to the synthetic `SparkD` during the async load and when the history API returns fewer than 2 data points.

---

## Metrics stat boxes — direction arrows and warnings (Cards 01, 02, 03)

Cards 01 (Regime), 02 (Leadership), and 03 (Breadth) all render **Metrics** stat boxes using the 8-field tuple format. See `CARD_STANDARDS.md` — "StatBoxes — extended 8-field tuple" for the full direction source and warning threshold tables.

Key implementation notes for deep-dive rendering:
- The direction badge (`▲`/`▼`/`—`) and warning badge (`⚠`) render in the top-right corner of each stat box and are **hidden** when the trigger tooltip overlay is open.
- The amber `⚠` badge co-exists with the direction badge — both can show simultaneously.
- The amber box border (`#78350f`) activates only when `warn = true`; normal border is `#1e2d3d`.
- For Leadership and Breadth, the direction field in each tuple is computed inside the client-side builder functions (`buildLeadershipMetrics`, `BreadthStatBoxes`) using `card.deltas` as the preferred source, with orientation-based fallback.

---

## Adapter wiring (`market-hub-adapter.js`)

- Add any new range token to `RANGE_MAP` (UI label → API token) before wiring a new range button.
- Add an entry to `HISTORY[cardId]` — either `{ url, field }` for a flat numeric series, or `{ url, extract(data) }` when building overlays/colorBy/percentage fields. `HISTORY.regime` is the fullest example to copy from.
- Verify the underlying API/D1 source actually has the history before exposing a new range in the UI — for Regime's 20Y option this was confirmed via a direct D1 query showing `daily_prices` has SPY history back to 2006-06-05.
- **Backend range support per endpoint** (as of 2026-06-23):

  | API endpoint | Supported range tokens |
  |---|---|
  | `/api/history` | `20d`, `1wk`, `1mo`, `3mo`, `6mo`, `1y`, `5y`, `10y`, `20y` |
  | `/api/sectors` | `20d`, `1wk`, `1mo`, `3mo`, `6mo`, `1y`, `5y`, `10y` |
  | `/api/equities-history` | `20d`, `1wk`, `1mo`, `3mo`, `6mo`, `1y`, `5y`, `10y` |
  | `/api/global-flows-history` | `20d`, `1wk`, `1mo`, `3mo`, `6mo`, `1y`, `5y`, `10y` |

  Custom chart components that don't route through `market-hub-adapter.js` build their own RMAP (`{ '20D': '20d', '1W': '1wk', ... }`) and pass the mapped token directly to the fetch URL.

---

## Market Diagnostics box (`buildRegimeDiagnostics`, desktop-parts.jsx)

Currently Regime-only. Renders immediately above the Market Narrative paragraph in the Summary section. Generates 3 diagnostic items, each answered dynamically from `card.rows` / `card.stats`.

**3-tier layout per item** (rendered in this order, top to bottom):

```
LABEL           ← 10px, 700 weight, letterspaced uppercase, color #334155 (muted slate)
Answer text     ← 13px, 600 weight, colored by status (DSIG[status].c), lineHeight 1.4
Question text   ← 11px, color #3d5166, lineHeight 1.4
```

Items are separated by a `1px solid #0d1e2e` divider (bottom border on all but the last). No divider after the last item.

The three diagnostics and their sources:

| # | Label | Answer source | Question |
|---|---|---|---|
| 1 | Market Classification | Row 0 condition text (e.g. "Secular Bull"), toned by Row 0 status | "How is the current market classified?" |
| 2 | Historical Context | Percentile Rank + Regime Duration stats combined into one sentence | "Where does the current period fit historically?" |
| 3 | Trend Strength | Row 1 + Row 2 condition text + Extension Velocity stat | "How strong and mature is the prevailing trend?" |

`buildRegimeDiagnostics(card)` returns `[{ label, q, a, c }]` where `c` is the color string (not a status token). `DeepDiveContent` maps over this array directly.

The section label **"Market Diagnostics"** renders above the items as a standard section header. The section label **"Market Narrative"** renders between the diagnostics and `card.note`.

If a new card needs a similar diagnostics box, write an analogous `buildXDiagnostics(card)` and gate it with `cardId === 'x'`. Do not generalize into a shared function until at least 2–3 cards need it.

---

## Compliance Tracker (V2)

| # | Card | `DeepChartLg` wired (live + ranges) | Tooltip extra rows documented | Custom `DeepDiveContent` path | Reviewed |
|---|------|---|---|---|---|
| 01 | Regime | ✅ (incl. 20Y, RSI, % above 200d/50d rows; RegimeMiniSpark dual-line on tile) | ✅ | No (default path + Q&A box) | ✅ |
| 02 | Leadership | ✅ (RSP vs SPY + QQEW overlay; 20D/50D/200D range; Leadership Metrics direction arrows + warnings) | ✅ | No | ✅ |
| 03 | Breadth | ✅ (custom `NyseBreadthChart` + `SectorBreadthChart`; Breadth Metrics direction arrows + warnings) | — | Yes | ✅ |
| 04 | Valuations | — | — | — | — |
| 05 | Yield | — | — | — | — |
| 06 | Credit | — | — | — | — |
| 07 | Global Flows | ✅ (ACWI series) | — | No | ✅ (QA 2026-06-20; note format fixed) |
| 08 | Sectors | ✅ (cycVsDef series) | — | No | ✅ (QA 2026-06-20; note format fixed) |
| 09 | Commodities | ✅ (USCI series) | — | No | ✅ (QA 2026-06-20; note format fixed) |
| 10 | Equities | ✅ (custom `EquitiesChart`, multi-series) | — | Yes | ✅ (QA 2026-06-20; note format fixed) |

---

## Update Process

1. Build/extend the chart wiring in `market-hub-adapter.js` (`HISTORY[cardId]`).
2. Reuse `DeepChartLg` via the default `DeepDiveContent` path unless the card genuinely needs multiple charts or a non-standard breakdown table.
3. Scope any card-specific chart feature (extra range, extra tooltip row, custom legend) via a `cardId` ternary, per "Scoping a feature to a single card" above.
4. Update the Compliance Tracker row above once verified live in the browser.
