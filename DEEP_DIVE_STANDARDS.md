# Market Hub — Deep Dive (Modal) Standards

Standards for all chart modals across the 10 cards.

---

## Chart Legend

All multi-line charts must use **solid filled square** legend markers — no outline borders, no dashes.

| Property | Value | Reason |
|---|---|---|
| `backgroundColor` | same as `borderColor` | Chart.js fills the legend box with `backgroundColor` |
| `boxWidth` | `12` | Compact; consistent across all charts |
| `boxHeight` | `12` | Forces a perfect square (without it Chart.js renders a wide rectangle) |
| `usePointStyle` | `false` | Prevents point-style shapes overriding the box |
| `generateLabels` | strip `lineDash` | Datasets with `borderDash` cause Chart.js to draw a dashed stroke through the legend box even with `usePointStyle: false`; must be cleared explicitly |

**Full standard legend config (copy-paste):**

```js
legend: {
  labels: {
    color: '#94a3b8', font: { size: 10 }, boxWidth: 12, boxHeight: 12, padding: 10,
    usePointStyle: false,
    generateLabels: chart =>
      Chart.defaults.plugins.legend.labels.generateLabels(chart)
        .map(item => ({ ...item, lineDash: [] })),
  },
}
```

Set `backgroundColor: borderColor` on **every dataset**:

```js
datasets: items.map(s => ({
  borderColor: COLORS[s.sym],
  backgroundColor: COLORS[s.sym],   // ← fills the legend box
  ...
}))
```

**Why `generateLabels`?** When a dataset has `borderDash` (dashed line), Chart.js propagates that dash pattern to the legend item's `lineDash` property. This renders as a dashed stroke *through* the box, making it look like a non-square shape. The override strips `lineDash` to `[]` on every item, guaranteeing solid filled squares regardless of line style. This approach is safe — it delegates to the default generator and only clears one property.

---

## Chart Tooltip

Standard dark tooltip style applied to all charts:

```js
tooltip: {
  backgroundColor: '#0d1520', borderColor: '#1e2d3d', borderWidth: 1,
  titleColor: '#64748b', bodyColor: '#e8edf5', padding: 10,
}
```

---

## Section Title

Modal section headings use the `.modal-section-title` CSS class:

```html
<div class="modal-section-title" style="margin-top:24px">TITLE TEXT</div>
```

- All caps, spaced tracking, muted color — defined globally in CSS
- `margin-top: 24px` between consecutive sections, `margin-top: 20px` for the first

---

## Range Selector

- Range buttons use class `range-btn` (shared active state via `.range-btn.active`)
- Default range: `5y` for price/performance charts, `30y` for valuation charts
- Selecting a range reloads **all charts** in the modal simultaneously

---

## Normalized Price Charts

- Rebase to 100 at period start
- Y-axis label: `v.toFixed(0)` (no % suffix)
- Zero-line equivalent is 100 — highlight with `rgba(148,163,184,0.35)` at `tick.value === 100`
- Use `spanGaps: true` on all datasets to bridge missing trading days

---

## Compliance Tracker

| # | Card | Solid Legend | Std Tooltip | Section Titles | Range Selector |
|---|---|:-:|:-:|:-:|:-:|
| 01 | Regime | ✅ | ✅ | ✅ | ✅ |
| 02 | Leadership | ✅ | ✅ | ✅ | ✅ |
| 03 | Breadth | ✅ | ✅ | ✅ | ✅ |
| 04 | Valuations | ✅ | ✅ | ✅ | ✅ |
| 05 | Yield | ✅ | ✅ | ✅ | ✅ |
| 06 | Credit | ✅ | ✅ | ✅ | ✅ |
| 07 | Global Flows | ✅ | ✅ | ✅ | ✅ |
| 08 | Sectors | ✅ | ✅ | ✅ | ✅ |
| 09 | Commodities | ✅ | ✅ | ✅ | ✅ |
| 10 | Equities | ⏸ | ⏸ | ⏸ | ⏸ |
