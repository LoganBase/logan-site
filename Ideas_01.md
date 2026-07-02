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

## Idea 04 · Historical Scorecard Chart *(Priority 1 recommendation)*

**Status:** Under Review

**The gap:** The 0–10 aggregate score is computed daily but never stored or visualised over time. A historical chart would immediately add context to every reading — "score was 7.8 in January when the market peaked, dropped to 2.4 in April, currently recovering at 5.3."

**What to store:** On each `/api/refresh` run, write the day's aggregate score + 3 category scores (Trend, Participation, Macro) to a new D1 table `scorecard_history (date, score, trend_score, participation_score, macro_score)`.

**What to show:** A new chart in the Exec Summary / aggregate view:
- Primary line: composite 0–10 score over time
- Optional overlays: 3 category lines (toggle-able)
- Colour-coded background bands: red (<4), yellow (4–7), green (≥7)
- Range selector: 1Y / 2Y / 5Y

**Infrastructure:** No new data source. D1 write on each refresh, new `/api/scorecard-history` endpoint, new chart component in the desktop Exec Summary.

**Complexity:** Low. **Value:** Very high — makes every other card more interpretable by showing where the composite score has been.

---

## Idea 05 · VIX Term Structure Panel

**Status:** Under Review

**The signal:** The shape of the VIX term structure tells you whether the market fears the near term or the medium term:
- **Backwardation** (VIX > VIX3M): acute near-term fear spike — historically a contrarian buy signal
- **Deep contango** (VIX3M >> VIX): complacency — warning when equity signals are bullish

**What to show:** A compact bar or stepped-line chart showing the term structure curve: VIX9D → VIX → VIX3M → VIX6M. Colour-coded by shape (backwardation = amber/red, contango = green/neutral).

**Infrastructure:** All tickers available free from Yahoo Finance (`^VIX9D`, `^VIX`, `^VIX3M`). Same fetch pattern already used everywhere. Would live in the Equities deep-dive or as a standalone panel.

**Complexity:** Low. **Value:** High — adds forward-looking options-market fear dimension not captured by any current card.

---

## Idea 06 · FRED Credit Spreads

**Status:** Under Review

**The gap:** The Credit card uses HYG price vs 200d SMA, but the actual spread in basis points is more informative and historically interpretable.

**FRED series (free API, no cost):**
- `BAMLH0A0HYM2` — ICE BofA US High Yield OAS (bps)
- `BAMLC0A0CM` — ICE BofA US Corporate Investment Grade OAS (bps)

**Historical thresholds:**
- HY OAS > 500bps: historically precedes equity drawdowns by 4–8 weeks
- HY OAS < 300bps: complacency / late-cycle compression
- IG OAS > 150bps: credit stress bleeding into investment grade

**Where to add it:** Enhance the existing Credit card deep-dive with a proper spread chart in bps alongside the current HYG price chart.

**Infrastructure:** FRED API (free, requires API key stored as Worker secret). New `/api/credit-spreads` endpoint. New chart component.

**Complexity:** Low–Medium. **Value:** High — turns the Credit card from a price proxy into a true spread monitor.

---

## Idea 07 · COT Positioning (Commitment of Traders)

**Status:** Under Review

**The signal:** CFTC publishes weekly positioning data every Friday for the prior Tuesday. Tracks what speculative (hedge fund) vs commercial (hedger) participants hold in futures markets. Extreme net-long speculative positioning = crowded trade = potential reversal. Extreme net-short = potential bottom.

**Key contracts:**
- S&P 500 e-mini futures (speculative positioning as % of open interest)
- Gold futures (safe-haven demand signal)
- WTI Crude (commodity cycle confirmation)

**Unique angle:** Shows *what institutional money is positioned for*, not what it has already done — a leading rather than lagging signal.

**Infrastructure:** CFTC publishes free downloadable CSVs at cftc.gov. Could fetch weekly and store in D1. Alternatively, Quandl/Nasdaq Data Link has a free COT API. New card or supplemental panel in Breadth or Commodities deep-dive.

**Complexity:** Medium. **Value:** High — unique institutional positioning angle not available from price data alone.

---

## Idea 08 · Earnings Revision Breadth

**Status:** Under Review

**The signal:** Whether Wall Street analysts are collectively revising S&P 500 EPS estimates up or down is a leading indicator for price:
- Rising price + rising estimates = healthy, confirmed bull
- Rising price + falling estimates = multiple expansion only, vulnerable
- Flat price + rising estimates = undervalued, potential catalyst

**Proxy approaches (without paid data):**
- Track divergence between CAPE (trailing) and forward P/E (already fetched) — widening gap signals estimate cuts
- Yardeni Research publishes weekly forward P/E and EPS estimates (scrapeable)
- Full breadth data (% of S&P 500 stocks with upward revisions) requires paid source (FactSet, Bloomberg)

**Where to add it:** Valuations card deep-dive — a "Earnings Revision" row or supplemental panel.

**Complexity:** Medium–High (depends on data source). **Value:** Medium — complements existing Valuations card; identifies whether current multiples are justified.

---
