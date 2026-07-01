# Market Hub — Ideas Backlog 01

---

## Idea 01 · NYSE:ADID & NASDAQ:ADID — Breadth Deep-Dive Daily Context

**Status:** Under Review

**What it is:**
- `NYSE:ADID` — net difference between advancing and declining stocks on the NYSE for the day
- `NASDAQ:ADID` — same for Nasdaq

**Value add:**
- **Hollow up-day detection** — S&P closes green but ADID is -800, meaning the average stock lost money despite the headline gain
- **Speculative risk appetite** — NASDAQ ADID captures whether retail/growth names are participating or fleeing
- Complements $MMTH/$MMFI which are structural/cumulative — ADID is same-day and catches divergences immediately

**Infrastructure:** Straightforward extension of existing TradingView webhook pipeline
- Add 2 columns to `market_breadth` D1 table (`adid_nyse`, `adid_nasdaq`)
- Add 2 `else if` blocks in `workers/tv-webhook/index.js` (same pattern as MMFI)
- Create 2 new TradingView alerts on `NYSE:ADID` and `NASDAQ:ADID`
- Surface in Breadth **deep-dive only** (daily context panel, not card scorecard row)
- Note: ADID range is ~−3000 to +3000 — carve out from the `value > 100` breadth validation

**Placement:** Breadth card deep-dive — daily context panel alongside $MMTH/$MMFI chart

---

## Idea 02 · S&P 500 Sector Weightings — Sectors Deep-Dive Context

**Status:** Implemented (2026-07-01) — static weights; dynamic KV refresh still pending

**The idea:** Surface S&P 500 index weightings alongside sector relative-performance data so users can immediately gauge market impact, not just rotation direction.

**Recommendation: display only — do not change card scoring**
The Sectors card's value is its equal-weight rotation view, which intentionally strips out cap-weight distortion to show breadth of participation. The Regime card (SPY vs 200d SMA) already captures the cap-weighted result. Making Sectors cap-weighted would create overlap and reduce the information value of having both.

**Where to add it:** Sectors deep-dive sector table — add a "S&P Wt." column and a "Wtd Impact" column (weight × relative performance). Example: XLK lagging −2% = −0.62pt drag on SPY; XLU lagging −2% = −0.04pt drag. Immediately shows which sector moves matter.

**S&P 500 approximate weightings (SPDR tickers):**

| Ticker | Sector | S&P Weight |
|---|---|---|
| XLK | Technology | ~31% |
| XLF | Financials | ~13% |
| XLV | Health Care | ~12% |
| XLC | Comm. Services | ~9% |
| XLY | Consumer Disc. | ~10% |
| XLI | Industrials | ~9% |
| XLP | Consumer Staples | ~6% |
| XLE | Energy | ~4% |
| XLB | Materials | ~2% |
| XLRE | Real Estate | ~2% |
| XLU | Utilities | ~2% |

**Note on tickers:** XST, XEG, XRE, XUT are TSX/Canadian equivalents — the US SPDR tickers are XLP, XLE, XLRE, XLU. XME exists (Metals & Mining) but XLB is the standard Materials SPDR used in the scorecard.

**Infrastructure:** Dynamic weights via Yahoo Finance ETF AUM — no new data source needed.
- Yahoo Finance `quoteSummary?modules=summaryDetail` returns `totalAssets` for each sector ETF
- Normalize: `weight[XLK] = assets[XLK] / sum(all 11 sector ETF assets)` → live sector weight
- Cache result in KV (`sector-weights:current`), refreshed nightly alongside `/api/refresh`
- Deep-dive reads from KV; no per-request fetch needed
- Static fallback constants if KV is empty (first run)

**Why dynamic over static:** XLK has drifted from ~20% to ~31% over the past few years. A static table would already be materially wrong for historical context and requires manual maintenance as the index evolves.

---

## Idea 03 · Sector Cycle Positioning — Where in the Run? *(Priority 2)*

**Status:** Implemented (2026-07-01) — both 03A (RRG) and 03B (ratio charts) live in Sectors deep-dive

**The question it answers:** Is XLE (or any sector) at the beginning or end of its run? Requires two signals simultaneously: *position* (where is relative strength vs history?) and *direction* (is that RS accelerating or fading?).

---

### Idea 03A · Relative Rotation Graph (RRG)

**What it is:** The canonical professional tool for sector cycle positioning (Bloomberg, TradingView premium). Plots all 11 sectors on a 4-quadrant scatter:

- **X-axis — RS-Ratio:** smoothed relative strength vs SPY, normalised to 100 (>100 = outperforming)
- **Y-axis — RS-Momentum:** rate of change of RS-Ratio, normalised to 100 (>100 = momentum accelerating)
- **12-week trail per sector:** line showing the path — clockwise rotation is the typical cycle sequence

| Quadrant | Label | Cycle stage |
|---|---|---|
| Top-right | Leading | Active run — overweight |
| Bottom-right | Weakening | End of run — begin rotating out |
| Bottom-left | Lagging | Out of favour — avoid/watch |
| Top-left | Improving | Early stage — beginning of run |

A sector with a clockwise hook from Lagging → Improving is the "early run" buy signal. Weakening → Lagging is the exit signal.

**Infrastructure:**
- New `/api/sector-cycle` endpoint — computes weekly RS-Ratio + RS-Momentum from D1 (all sector + SPY daily prices already stored)
- JdK formula: RS-Line = sector/SPY; RS-Ratio = EWM smoothed RS vs 26-week baseline; RS-Momentum = 1-week ROC of RS-Ratio; both normalised to 100
- New `SectorRRG` SVG React component in Sectors deep-dive — scatter with per-sector trails and quadrant labels
- No new data sources or symbols needed

---

### Idea 03B · Cycle-Signal Ratio Charts *(simpler, do first)*

**What it is:** 3–4 ratio line charts in the Sectors deep-dive, each mapping to an economic cycle phase. The user's Commodities vs NASDAQ example belongs here.

| Ratio | Rising = | Falling = |
|---|---|---|
| XLY / XLP (Disc vs Staples) | Expansion, risk-on, mid-cycle | Contraction, defensive bid |
| XLE / XLK (Energy vs Tech) | Late cycle — inflation, real assets | Early cycle — disinflation, tech/growth |
| XLF / XLU (Financials vs Utilities) | Rising rates, growth | Falling rates, risk-off |
| USCI / QQQ (Commodities vs Nasdaq) | Macro late-cycle, commodity bid | Tech/growth dominance, disinflation |

**Infrastructure:** All symbols already in D1. Ratio = close[A] / close[B], rebased to 100. Reuses existing chart patterns. New endpoint or extend sectors-history to return ratio series.

**Implementation order:** 03B first (low complexity), then 03A (medium complexity, more powerful).

---
