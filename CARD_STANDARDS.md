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
  sectorTable, details, flags, allRows,  // card-specific extras (Breadth, Global Flows, Sectors)
}
```

`market-hub-adapter.js`'s `mapCard()` reshapes each row into the **tuple** the UI actually consumes — note the reordering:

```
[label, value, condition, status, indicator]   //  r[0]      r[1]    r[2]      r[3]    r[4]
```

`IndicatorTable`, `ScoreTile`, and `OptionGlancePage` all read this tuple form directly (`r[0]`, `r[1]`, …) — never the original `{label, value, condition, status, indicator}` object shape from `scores.js`.

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

## Completion Tracker (V2)

| # | Card | Card status logic documented | Banding ladder (not just binary) | Terminology spelled out | Reviewed |
|---|------|---|---|---|---|
| 01 | Regime | ✅* (master override — see scores.js `buildRegime`) | ✅ (Stretch Risk, Trend Cross) | ✅ | ✅ |
| 02 | Leadership | — | — | — | — |
| 03 | Breadth | — | — | — | — |
| 04 | Valuations | — | — | — | — |
| 05 | Yield | — | — | — | — |
| 06 | Credit | — | — | — | — |
| 07 | Global Flows | ✅* (existing bull-count threshold override, predates this doc) | — | — | — |
| 08 | Sectors | — | — | — | — |
| 09 | Commodities | — | — | — | — |
| 10 | Equities | — | — | — | — |

`✅*` = intentional custom/override logic, not a plain `cardStatus(rows)` call — documented inline in `scores.js` with a why-comment.

---

## Update Process

1. Implement/refine the card's scoring logic in `functions/api/scores.js` (its `buildX(q, ctx)` function), following the banding pattern above.
2. If the card needs historical chart data, extra ranges, overlays, or tooltip rows in its deep-dive, see `DEEP_DIVE_STANDARDS.md`.
3. Bump the cache-bust version in `v2/index.html` for any `desktop-parts.jsx` / `desktop-app.jsx` / `market-hub-adapter.js` change.
4. Update the Completion Tracker row above and mark **Reviewed** once the user has confirmed the card's look and logic live in the browser.
