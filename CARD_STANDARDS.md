# Market Hub — Card Format Standards

## Format Spec

Every card return object in `scores.js` must satisfy:

| Requirement | Implementation | Notes |
|-------------|---------------|-------|
| 3-column layout | `hideIndicator: true` on return object | Removes indicator column from card face; deep dive modal still shows all 4 columns |
| Computed status | `status: cardStatus(rows)` | Never hardcode `'neutral'`, `'bullish'`, or `'bearish'` unless custom scoring logic is intentional (e.g. GlobalFlows bull-count threshold) |
| Short labels | `row.label` ≤ 3 words | Card face is space-constrained — "SPY Regime" not "Market Status" |
| Actionable conditions | `"Signal — Action"` format | e.g. `"Secular Bull — Stay Long"`, `"Rally Narrowing — Stay with Leaders"` |
| Stacked values | `<br>` + `&nbsp;` between ticker and value | When showing two related numbers e.g. `RSP&nbsp;+3.0%<br>SPY&nbsp;+4.2%` |
| No `US$` prefix | Use `$` prefix directly | `$759.57` not `US$759.57` in card face values |

---

## Completion Tracker

| # | Card | `hideIndicator` | `cardStatus()` | Short Labels | Actionable Conditions | Stacked Values | Reviewed |
|---|------|:-:|:-:|:-:|:-:|:-:|:-:|
| 01 | Regime | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| 02 | Leadership | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| 03 | Breadth | ✅ | ✅ | ✅ | ⏸ rows 1–3 manual | — | ⏸ parked |
| 04 | Valuations | ✅ | ✅* | ✅ | ✅ | — | ✅ |
| 05 | Yield | ✅ | ✅* | ✅ | ✅ | — | ✅ |
| 06 | Credit | ✅ | ✅* | ✅ | ✅ | ✅ | ✅ |
| 07 | Global Flows | ✅ | ✅* | ❌ | ❌ | — | ❌ |
| 08 | Sectors | ✅ | ✅* | ❌ | ❌ | — | ❌ |
| 09 | Commodities | ✅ | ✅* | ❌ | ❌ | — | ❌ |
| 10 | Equities | ✅ | ✅* | ❌ | ❌ | — | ❌ |

✅* = custom scoring logic (intentional, not hardcoded neutral)

---

## Deep Dive Standards

Applied during card review — tracked separately per card.

| # | Card | Stat boxes correct | Chart thresholds aligned | Reference lines | Range-independent stats |
|---|------|:-:|:-:|:-:|:-:|
| 01 | Regime | ✅ | ✅ | ✅ RSI 30/70 | ✅ |
| 02 | Leadership | ✅ | — | — | ✅ |
| 03–10 | Remaining | ❌ | ❌ | ❌ | ❌ |

---

## Update Process

When completing a card review:
1. Apply all format changes
2. Check off the relevant columns in the tracker above
3. Commit with message: `[CardName] card: apply format standards + review fixes`
