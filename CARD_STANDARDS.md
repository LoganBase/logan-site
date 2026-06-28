# Market Hub — Card Standards (V2 React/SVG Desktop Kit)

This documents the conventions actually implemented in the **V2** desktop kit — `ui_kits/desktop/desktop-parts.jsx`, `desktop-app.jsx`, `market-hub-adapter.js`, and `functions/api/scores.js`. It supersedes the old Chart.js/HTML V1 standards (legend config, `.modal-section-title`, `range-btn` CSS classes) — none of that applies here. Card 1 (Regime) is the reference implementation; use this file + `DEEP_DIVE_STANDARDS.md` to drive Cards 2–10 to match.

---

## System overview

- No build step: React 18 + Babel Standalone, loaded via `<script type="text/babel">` tags in `v2/index.html`.
- Shared UI components live in `ui_kits/desktop/desktop-parts.jsx`; page layout/shells in `desktop-app.jsx`.
- Data flow: `functions/api/scores.js` (`buildX(q, ctx)` per card → status/rows/stats/note) → `GET /api/scores` → `market-hub-adapter.js`'s `mapScores`/`mapCard` (reshapes into the kit's card shape) → React components read `window.GLANCE`-shaped data.
- **Cache-busting**: bump `?v=YYYYMMDD[suffix]` on all 4 script tags in `v2/index.html` together (`glance-data.js`, `market-hub-adapter.js`, `desktop-parts.jsx`, `desktop-app.jsx`) whenever any of those 3 files change. Not needed for server-only `functions/api/*.js` edits — those take effect on deploy with no client cache to bust.

---

## Design tokens (desktop-parts.jsx, top of file)

`DSIG` is the single source of truth for status color/label — never hardcode a status color anywhere; always read `DSIG[status].c` / `.glow` / `.fill` / `.line` / `.word`. This is what keeps card dots, table values, status pills, and chart glows all in sync.

```js
const DSIG = {
  bullish: { c: '#22c55e', glow: 'rgba(34,197,94,.35)', fill: 'rgba(34,197,94,.12)', line: 'rgba(34,197,94,.25)', word: 'BULLISH' },
  neutral: { c: '#f59e0b', glow: 'rgba(245,158,11,.35)', fill: 'rgba(245,158,11,.10)', line: 'rgba(245,158,11,.20)', word: 'NEUTRAL' },
  bearish: { c: '#ef4444', glow: 'rgba(239,68,68,.35)', fill: 'rgba(239,68,68,.10)', line: 'rgba(239,68,68,.20)', word: 'BEARISH' },
};
```

- `DMONO` — monospace stack, used for all numeric/value text.
- `DSANS` — Inter/sans stack, used for all labels and prose.
- Panel palette used throughout: background `#0d1520`, border `#1e2d3d`, divider `#16202e`, muted label `#475569`, secondary text `#94a3b8`, primary text `#e8edf5`.

---

## Card data shape

Each card builder in `scores.js` returns:

```js
{
  id, number, title, subtitle,
  status,             // 'bullish' | 'neutral' | 'bearish' — drives the card-level dot/pill color
  rows,               // [{ label, indicator, value, condition, status }, ...]
  stats,              // optional [[label, value, desc, tone], ...]  tone: 'pos' | 'neg' | null
  hideIndicator: true,
  note,               // dynamic narrative string for the Summary box
  deltas,             // 5-day directional deltas — present on Regime, Leadership, and Breadth
                      //   each value: 'up' | 'down' | 'flat' | null
                      //   drives the ▲/▼/— arrows and ⚠ warnings on the card's Metrics stat boxes
                      //   Regime:     { v200, crossSpread, duration, velocity }
                      //   Leadership: { rsp, qqew, style }          (null → falls back to spread sign)
                      //   Breadth:    { mmth, mmfi }                (null → falls back to 50% midpoint)
  sectorTable, details, flags, allRows,  // card-specific extras (Breadth, Global Flows, Sectors)
}
```

`market-hub-adapter.js`'s `mapCard()` reshapes each row into the **tuple** the UI actually consumes — note the reordering:

```
[label, value, condition, status, indicator]   //  r[0]      r[1]    r[2]      r[3]    r[4]
```

`IndicatorTable`, `ScoreTile`, and `OptionGlancePage` all read this tuple form directly (`r[0]`, `r[1]`, …) — never the original `{label, value, condition, status, indicator}` object shape from `scores.js`.

---

## StatBoxes — extended 8-field tuple (Regime, Leadership, Breadth)

The Metrics stat boxes for Cards 01, 02, and 03 use an **8-field tuple** rather than the standard 4-field form. These are constructed in card-specific builder functions in `desktop-parts.jsx` — they are not built in `scores.js` or `mapCard`.

```
[label, value, indicator, tone, condition, triggers, direction, warn]
//  0       1       2       3       4         5          6        7
```

- `[6]` **direction** — `'up' | 'down' | 'flat' | null`; source: `card.deltas.*`; drives the ▲/▼/— arrow badge
- `[7]` **warn** — `boolean`; drives the ⚠ amber badge + amber border (`#78350f`) on the box

`StatBoxes` reads `st[6]` and `st[7]` and renders both badges in the top-right corner of the box (hidden when trigger overlay is open). The border is `#78350f` when `warn` is true, normal `#1e2d3d` otherwise.

**Warning thresholds** (defined in each card's builder function in `desktop-parts.jsx`):

*Regime — `buildRegimeMetrics`:*

| Box | Trigger margin |
|---|---|
| SPY Regime | within ±2% of 0, trending toward 0 |
| Stretch Risk | within 1.5% of 14%, 10%, 0%, or -10% |
| Trend Cross | within 1% of 0, trending toward 0 |
| Percentile Rank | within 5 points of 80 or 20 |
| Regime Duration | within 10 days of 30, 150, or 400 |
| Extension Velocity | within 0.5 of any key ROC level |

*Leadership — `buildLeadershipMetrics`:*

| Box | Trigger margin |
|---|---|
| Market Breadth, Tech Breadth, Style Bias (row 1) | spread within ±0.5% of 0 (near neutral) |
| Market Spread, Tech Spread (row 2) | value within ±R2.warn of 0 (scales with range: 0.5 @ 20D, 2 @ 50D, 6 @ 200D) |
| Daily Streak (row 2) | no warning — streak is not proximity-based |

**Direction source for Leadership:** `card.deltas.rsp/.qqew/.style` (5-day spread delta, computed server-side from `price5d`/`price25d`). Falls back to spread-sign orientation when delta is null ('flat').

*Breadth — `BreadthStatBoxes`:*

| Box | Trigger margin |
|---|---|
| NYSE 200d (MMTH) | within ±4 percentage points of 70% or 40% |
| NYSE 50d (MMFI) | within ±4 percentage points of 70% or 40% |
| Sector Breadth | count = 6 or 7 (approaching the ≥8 or ≤5 thresholds) |
| Days boxes, Consumer Signal | no warning |

**Direction source for Breadth:** `card.deltas.mmth/.mmfi` (5-day MMTH/MMFI delta, from `breadth-history` API `summary.mmthDir/.mmfiDir`). Falls back to 50% midpoint (≥50% → ▲, <50% → ▼) when delta is 'flat' or null.

Other cards keep the standard `[label, value, desc, tone]` 4-field form in their stats arrays.

---

## Status / banding pattern

Use a threshold ladder, not a single boolean, whenever a metric has a meaningful "too close to call" middle zone. Always classify into exactly `'bullish' | 'neutral' | 'bearish'`.

```js
let status, condition;
if (v == null)          { status = 'neutral'; condition = '—'; }
else if (v > HI)         { status = 'bearish'; condition = '...'; }
else if (v > MID)        { status = 'neutral'; condition = '...'; }
else if (v >= 0)         { status = 'bullish'; condition = '...'; }
else if (v >= -MID)      { status = 'neutral'; condition = '...'; }
else                      { status = 'bearish'; condition = '...'; }
```

- Each `condition` string is a short, actionable directive ("Golden Cross — Confirmed"), not a restatement of the math or the indicator name.
- **Card-level status** defaults to `cardStatus(rows)` (scores.js, `cardStatus` helper) — majority vote: bearish wins if it outnumbers bullish; bullish wins if present with zero bearish; otherwise neutral.
- **Master override pattern** (Regime, Global Flows): when one row is a structural gate that should dominate the whole card, bypass `cardStatus(rows)` entirely:
  ```js
  // Card is bearish only when SPY is in a secular bear (below 200d SMA)
  const status = isBull ? cardStatus(rows) : 'bearish';
  ```
  Always put a one-line comment directly above the override explaining *why* it overrides, and mark it `✅*` (not plain `✅`) in the Completion Tracker below.

---

## Terminology

Spell out abbreviations in any user-facing text — "Rate of Change", not "ROC" — unless space genuinely forces an abbreviation (e.g. a narrow table header).

---

## IndicatorTable (desktop-parts.jsx, `IndicatorTable` component)

4-column fixed layout. Do not let column widths float per-card — this fixed-width contract is what prevents row misalignment when condition text length varies between cards.

| Column | Width | Source |
|---|---|---|
| Signal | 175px | `r[0]` (label) |
| Indicator | 285px | `r[4]` (indicator name) |
| Condition | flex: 1 | `r[2]` (condition text) |
| Value | 100px, right-aligned | `r[1]` (value), colored via `DSIG[r[3]].c` |

Value text color is **always** driven by the row's own status (`r[3]`) — there is no independent per-value coloring mechanism. If a value seems to need different coloring logic than its row's classification, that's a sign the row's banding is wrong, not that the table needs a new mechanism.

---

## Note field — leading sentence format

Several cards embed counts in the opening sentence of the `note` field. These are live-computed from the card's data and must include the actual count, not a bare "/":

| Card | Note opening pattern |
|---|---|
| 07 Global Flows | `"${bull}/${total} regional indexes are above their 200d SMA — ..."` |
| 08 Sectors | `"Cyclicals are leading defensives by ${spreadStr} ..."` or `"parity (${spreadStr} spread, ...)"` |
| 09 Commodities | `"${bull}/${COM_META.length} commodity signals are macro-positive — ..."` |
| 10 Equities | `"${bull}/${total} names in the watchlist are above both their 50d and 200d SMA — ..."` |

These four cards had a template interpolation bug (count was missing from the string) which was fixed 2026-06-20. The QA S4 checks for each card verify the count is present in the note.

---

## Completion Tracker (V2)

| # | Card | Card status logic documented | Banding ladder (not just binary) | Terminology spelled out | Reviewed |
|---|------|---|---|---|---|
| 01 | Regime | ✅* (master override — see scores.js `buildRegime`) | ✅ (Stretch Risk, Trend Cross) | ✅ | ✅ |
| 02 | Leadership | ✅ (majority-wins, no override; Style Bias neutral-only, never bearish) | ✅ (3-band spreads R1/R2; streak tone-based) | ✅ | ✅ |
| 03 | Breadth | ✅ (majority-wins across 4 rows, no override) | ✅ (MMTH/MMFI 3-band; sector count 3-band) | ✅ | ✅ |
| 04 | Valuations | ✅ (majority-wins on rows[0..2] only; Japan P/E excluded — deep-dive context only) | ✅ (Trailing P/E 3-band; CAPE 4-band; Buffett 3-band; Japan P/E relative) | ✅ | ✅ |
| 05 | Yield | ✅* (partial override: if 30Y ≥ 5% → card bearish; else majority-wins) | ✅ (30Y 3-band; 10Y 3-band; Curve 3-band) | ✅ | ✅ |
| 06 | Credit | ✅ (threshold: ≥3 bullish → bullish; ≥2 → neutral; else bearish) | ✅ (EMB 3-tier below-200d conditions) | ✅ | ✅ |
| 07 | Currency | ✅* (JPY override: carry unwind trumps USD/EUR balance; else majority-wins on 3 tones) | ✅ (UUP/FXE 2-band above/below 200d; FXY 2-band >+3% threshold; FX Regime 5-state composite) | ✅ | ✅ |
| 08 | Global Flows | ✅* (bull-count threshold: ≥6 → bullish, ≥4 → neutral, else bearish) | ✅ (ACWI/EEM binary; all others above/below 200d) | ✅ | ✅ |
| 09 | Sectors | ✅* (cycVsDef spread: >+1% → bullish, <-1% → bearish, else neutral) | ✅ (cyclical 3-way; defensive 3-way; Gold/Silver inverted) | ✅ | ✅ |
| 10 | Commodities | ✅ (bull-count: ≥6 → bullish, ≥4 → neutral, else bearish; Gold/Silver use macro-signal status) | ✅ (Gold 3-band inverted; Agriculture 3-band; Uranium 3-band) | ✅ | ✅ |
| 11 | Equities | ✅ (bull-count of above-both-MAs: ≥7 → bullish, ≥5 → neutral, else bearish) | ✅ (3-tier: above-both / above-200d-only / below-200d) | ✅ | ✅ |

`✅*` = intentional custom/override logic, not a plain `cardStatus(rows)` call — documented inline in `scores.js` with a why-comment.

---

## Mini sparkline colors (desktop-app.jsx)

Each card tile has a mini sparkline in the top-right corner. Most are multi-series SVG components defined in `desktop-app.jsx`; two fall back to the generic `SparkD` (single line, card status color). Colors are fixed per-series and must match the corresponding deep-dive chart.

**Color standard** — 1 line: purple. 2 lines: purple + cyan. 3 lines: purple + cyan + green. The bottom layer (drawn first) is always purple so it reads as the primary series.

| Card | Component | Series | Color |
|---|---|---|---|
| 01 Regime | `RegimeMiniSpark` | 200d SMA | `#a855f7` purple |
| | | SPY | `#22d3ee` cyan |
| 02 Leadership | `LeadershipMiniSpark` | RSP (equal-weight) | `#a855f7` purple |
| | | SPY (cap-weight) | `#22d3ee` cyan |
| 03 Breadth | `BreadthMiniSpark` | MMTH (% above 200d) | `#a855f7` purple |
| | | MMFI (% above 50d) | `#22d3ee` cyan |
| 04 Valuations | `SparkD` | CAPE (single line) | `#a855f7` purple |
| 05 Yield | `YieldMiniSpark` | 30Y `^TYX` | `#a855f7` purple |
| | | 10Y `^TNX` | `#22d3ee` cyan |
| | | 2Y treasury | `#22c55e` green |
| 06 Credit | `CreditMiniSpark` | HYG (high yield) | `#a855f7` purple |
| | | LQD (investment grade) | `#22d3ee` cyan |
| | | EMB (EM bonds) | `#22c55e` green |
| 07 Currency | `SparkD` | UUP (single line) | `#a855f7` purple |
| 08 Global Flows | `GlobalFlowsMiniSpark` | ACWI (global) | `#a855f7` purple |
| | | EEM (emerging) | `#22d3ee` cyan |
| 09 Sectors | `SectorsMiniSpark` | Cyclicals | `#a855f7` purple |
| | | Defensives | `#22d3ee` cyan |
| 10 Commodities | `CommoditiesMiniSpark` | USCI | `#22d3ee` cyan |
| | | 200d SMA | `#a855f7` purple |
| 11 Equities | `EquitiesMiniSpark` | IWM (Russell 2000) | `#a855f7` purple |
| | | FCX (Freeport) | `#22d3ee` cyan |
| | | GDX (Gold Miners) | `#22c55e` green |

**Rule:** when adding a new `MiniSpark` component, update the ternary in **all three** locations in `desktop-app.jsx` — `ScoreTile`, `OptionWorkspace`, and `OptionGlancePage`. Missing one causes the sparkline to silently fall back to `SparkD` in that layout.

---

## Update Process

1. Implement/refine the card's scoring logic in `functions/api/scores.js` (its `buildX(q, ctx)` function), following the banding pattern above.
2. If the card needs historical chart data, extra ranges, overlays, or tooltip rows in its deep-dive, see `DEEP_DIVE_STANDARDS.md`.
3. Bump the cache-bust version in `v2/index.html` for any `desktop-parts.jsx` / `desktop-app.jsx` / `market-hub-adapter.js` change.
4. Update the Completion Tracker row above and mark **Reviewed** once the user has confirmed the card's look and logic live in the browser.
