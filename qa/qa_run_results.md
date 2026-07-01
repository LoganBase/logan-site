# Market Hub QA Results — 2026-06-26 02:55:53
Target URL: https://www.loganbase.com

### Live Values at Time of Check:
- **Weighted Composite Score:** 5.0/10 | **Glow:** red
- **Label:** "Risk-Off — Reduce Exposure"
- **Posture:** "Defensive, Raise Cash"
- **Chips:** 4 bullish, 2 neutral, 4 bearish
- **regimeBearish:** False
- **Trend / Momentum Score:** 2.5/4 (yellow)
- **Participation Score:** 1.5/3 (red)
- **Macro Conditions Score:** 1/3 (red)
- **Kalshi (top event):** FOMC Rate (fomc) - Cut 3.50% @ 79% confidence on JUL 29
- **Polymarket (top signal):** "Fed rate hike in 2026?" 52.5% volume=$2,950,711

---

## 1. Executive Summary QA Checks
| Check | Description | Result | Notes |
|-------|-------------|--------|-------|
| F1 | Timestamp freshness | PASS | Timestamp: 2026-06-26T06:55:51.563Z (Expected: 2026-06-26) |
| F2 | Source field valid | PASS | Value: d1+yahoo |
| A1 | aggregate object present | PASS |  |
| A2 | All required fields present | PASS |  |
| A3 | categories count = 3 | PASS | Count: 3 |
| A4 | Category keys correct | PASS | Keys: ['trend', 'participation', 'macro'] |
| A5 | Category weights correct | PASS | Trend: 0.4, Participation: 0.3, Macro: 0.3 |
| M1 | Trend cards correct (4) | PASS | Found: ['regime', 'leadership', 'sectors', 'equities'] |
| M2 | Participation cards correct (3) | PASS | Found: ['breadth', 'globalflows', 'commodities'] |
| M3 | Macro cards correct (3) | PASS | Found: ['valuations', 'yield', 'credit'] |
| C1 | Chip counts total 10 | PASS | Total: 10 |
| C2 | Chip counts match card statuses | PASS | Agg: 4/2/4, Cards: 4/2/4 |
| R1 | regimeBearish flag correct | PASS | Flag: False, Regime Status: bullish |
| SC1 | Trend sub-score math | PASS | Calc: 2.5/4 = 0.625, API: 0.625 |
| SC2 | Participation sub-score math | PASS | Calc: 1.5/3 = 0.500, API: 0.500 |
| SC3 | Macro sub-score math | PASS | Calc: 1.0/3 = 0.333, API: 0.333 |
| WC1 | Weighted composite math | PASS | Calc: 5.0/10, API: 5.0/10 |
| L1 | Glow matches threshold | PASS | Calc: 0.500 -> expected: red, API: red |
| L2 | Label correct | PASS | API: "Risk-Off — Reduce Exposure" |
| L3 | Posture correct | PASS | API: "Defensive, Raise Cash" |
| CG1 | Trend category glow | PASS | Pct: 0.625 -> expected: yellow, API: yellow |
| CG2 | Participation category glow | PASS | Pct: 0.500 -> expected: red, API: red |
| CG3 | Macro category glow | PASS | Pct: 0.333 -> expected: red, API: red |
| K1 | Kalshi events present | PASS | Count: 1 |
| K2 | Kalshi event fields complete | PASS |  |
| K3 | FOMC action derived correctly | PASS | Action: Cut, Consensus: 3.50%, Current: 3.75% (Expected: Cut) |
| K4 | FOMC confidence 1-99 | PASS | Value: 79% |
| K5 | CPI consensus format | N/A |  |
| P1 | Polymarket signals present | PASS |  |
| P2 | Signal count <= 5 | PASS | Count: 5 |
| P3 | Signals sorted by volume | PASS |  |
| P4 | Probabilities 0-1 | PASS |  |
| P5 | Sentiment values valid | PASS |  |
| P6 | Base-rate qualifying signals | PASS | Signals: "Will inflation reach more than 4.5% in 2026?": 19.5%, "Will annual inflation be 3.8% in June?": 51.9% |


## 2. Card 01 — Regime Checks
| Check | Description | Result | Notes |
|-------|-------------|--------|-------|
| S1 | Row count = 3 | PASS | Count: 3 |
| S2 | Row labels correct | PASS | Found: ['SPY Regime', 'Stretch Risk', 'Trend Cross'] |
| S3 | Row indicators correct | PASS | Found: ['SPY vs 200d SMA', 'Distance from 200d SMA', '50d SMA vs 200d SMA'] |
| M1 | vs200 math correct | PASS | Calculated: 6.98%, Displayed: 6.98% (Derived 200d SMA: $686.39) |
| M2 | 50d/200d spread band & status | PASS | Spread: 6.7%, Status: neutral, Condition: "Cross Forming — Awaiting Confirmation" |
| R0A | Row 0 status correct | PASS | SPY: $734.30 vs 200d: $686.39 |
| R0B | Row 0 condition text | PASS | Condition: "Secular Bull — Stay Long" |
| R1A | Row 1 status (zone) | PASS | VS200: 6.98%, expected status: bullish |
| R1B | Row 1 condition text | PASS | Condition: "Normal Bull — Full Risk-On" |
| R2A | Row 2 status correct | PASS |  |
| R2B | Row 2 condition text | PASS |  |
| R2C | Spread % in condition | PASS | Condition: "Cross Forming — Awaiting Confirmation" |
| O1 | Override rule (bear) | PASS | SPY < 200d? False, Card Status: bullish |
| O2 | Majority-wins logic | PASS | Row statuses: ['bullish', 'bullish', 'neutral'], Card Status: bullish |
| D1 | Card delta field present | PASS | Value: same |
| D2 | Deltas object present | PASS | {'v200': 'down', 'crossSpread': 'up', 'duration': 'up', 'velocity': 'up'} |
| D3 | Deltas sub-fields plausible | PASS | v200: down, crossSpread: up, duration: up, velocity: up |


## 3. Card 02 — Leadership Checks
| Check | Description | Result | Notes |
|-------|-------------|--------|-------|
| S1 | Row count = 3 | PASS | Count: 3 |
| S2 | Row labels correct | PASS | Found: ['Market Breadth', 'Tech Breadth', 'Style Bias'] |
| S3 | Row indicators correct | PASS | Found: ['RSP vs SPY — 20d Return', 'QQEW vs QQQ — 20d Return', 'IVW vs IVE — 20d Return'] |
| P1 | Spread on line 1 formatted correctly | PASS |  |
| P2 | Spread arithmetic matches individual returns | PASS | All rows match |
| R0A | Row 0 status matches spread direction | PASS |  |
| R0B | Row 0 condition correct | PASS |  |
| R0C | Row 0 full condition matches standard | PASS | Condition: "Breadth Expanding — Add Broadly" |
| R1A | Row 1 status matches spread direction | PASS |  |
| R1B | Row 1 condition correct | PASS |  |
| R1C | Row 1 full condition matches standard | PASS | Condition: "Tech Broadening — Tech Healthy" |
| R2A | Row 2 status correct (neutral-only protection) | PASS | Spread: -2.7%, Status: neutral |
| R2B | Row 2 condition correct | PASS |  |
| R2C | Row 2 full condition matches standard | PASS | Condition: "Value Rotating — Reduce Growth" |


## 4. Card 03 — Breadth Checks
| Check | Description | Result | Notes |
|-------|-------------|--------|-------|
| S1 | Row count = 4 | PASS | Count: 4 |
| S2 | Row labels correct | PASS | Found: ['NYSE 200d', 'NYSE 50d', 'Sector Check', 'Consumer Signal'] |
| S3 | Row indicators correct | PASS | Found: ['$MMTH — % NYSE Stocks Above 200d SMA', '$MMFI — % NYSE Stocks Above 50d SMA', 'SPDR Sectors Above 200d SMA (11)', 'RSPD (Equal-Weight Consumer Disc.)'] |
| S4 | Note present and non-empty | PASS |  |
| S5 | Sector table present | PASS | Size: 11 |
| R0A | Row 0 status matches thresholds | PASS | MMTH: 55.6%, Status: neutral |
| R0B | Row 0 condition correct | PASS | Condition: "Mixed Breadth — Bifurcated Market" |
| R1A | Row 1 status matches thresholds | PASS | MMFI: 53.7%, Status: neutral |
| R1B | Row 1 condition correct | PASS | Condition: "Mixed Momentum — Watch Leaders" |
| R2A | Row 2 status matches thresholds | PASS | Sectors: 9/11, Status: bullish |
| R2B | Row 2 condition correct | PASS | Condition: "Broad Participation — Stay Long" |
| R3A | Row 3 status matches position | PASS | Status: bearish, Condition: "Below 200d — Risk Rising" |
| R3B | Row 3 condition text | PASS |  |


## 5. Card 04 — Valuations Checks
| Check | Description | Result | Notes |
|-------|-------------|--------|-------|
| S1 | Row count = 4 | PASS | Count: 4 |
| S2 | Row labels correct | PASS | Found: ['Trailing P/E', 'CAPE', 'Buffett Ind.', 'Japan P/E'] |
| S3 | Row indicators correct | PASS | Found: ['S&P 500 Trailing P/E (Shiller, 1-2mo lag)', 'Shiller CAPE (10yr)', 'Mkt Cap / GDP (Buffett)', 'EWJ (Japan ETF) vs S&P 500'] |
| R0A | Row 0 status matches thresholds | PASS | P/E: 22.7, Status: bearish |
| R0B | Row 0 condition correct | PASS | Condition: "Elevated — Favour Value Over Growth" |
| R1A | Row 1 status matches thresholds | PASS | CAPE: 41.6, Status: bearish |
| R1B | Row 1 condition correct | PASS | Condition: "Extreme — Near 2000 Peak, Limit Exposure" |
| R2A | Row 2 status matches thresholds | PASS | Buffett: 233.0%, Status: bearish |
| R2B | Row 2 condition correct | PASS | Condition: "Extreme — Near Peak, Limit Exposure" |
| O1 | Card status excludes Japan P/E | PASS | Status: bearish, Expected: bearish (Rows: ['bearish', 'bearish', 'bearish']) |


## 6. Card 05 — Yield Checks
| Check | Description | Result | Notes |
|-------|-------------|--------|-------|
| S1 | Row count = 4 | PASS | Count: 4 |
| S2 | Row labels correct | PASS | Found: ['30Y Yield', '10Y Yield', 'Yield Curve', '2Y Trend'] |
| S3 | Row indicators correct | PASS | Found: ['US 30-Year Yield (^TYX)', 'US 10-Year Yield (^TNX)', '3m–10Y Spread (Recession Signal)', 'SHY — 1-3yr Treasury ETF vs 200d SMA'] |
| R0A | Row 0 status matches thresholds | PASS | 30Y: 4.86%, Status: neutral |
| R0B | Row 0 condition correct | PASS | Condition: "Approaching 5% — Reduce Duration Risk" |
| R1A | Row 1 status matches thresholds | PASS | 10Y: 4.39%, Status: neutral |
| R1B | Row 1 condition correct | PASS | Condition: "Elevated — Headwind for Growth" |
| R2A | Row 2 status matches thresholds | PASS | Curve: 0.71%, Status: neutral |
| R2B | Row 2 condition correct | PASS | Condition: "Flat — Watch for Steepening" |
| O1 | Card status or 30Y override correct | PASS | Status: bearish, 30Y: 4.86% |


## 7. Card 06 — Credit Checks
| Check | Description | Result | Notes |
|-------|-------------|--------|-------|
| S1 | Row count = 4 | PASS | Count: 4 |
| S2 | Row labels correct | PASS | Found: ['Risk Appetite', 'Credit Quality', 'Global Credit', 'Spread Signal'] |
| S3 | Row indicators correct | PASS | Found: ['HYG — High Yield Corp Bond ETF', 'LQD — Investment Grade Bond ETF', 'EMB — EM USD Bond ETF (JP Morgan)', 'HYG vs LQD — HY vs IG (200d basis)'] |
| R0A | Row 0 status correct | PASS | HYG vs200: 1.55%, Status: bullish |
| R0B | Row 0 condition correct | PASS | Condition: "Above 200d — Appetite Healthy" |
| R1A | Row 1 status correct | PASS | LQD vs200: 0.99%, Status: bullish |
| R1B | Row 1 condition correct | PASS | Condition: "Above 200d — Credit Quality Firm" |
| R2A | Row 2 status correct | PASS | EMB vs200: 2.6%, Status: bullish |
| R2B | Row 2 condition correct | PASS | Condition: "Above 200d — EM Credit Stable" |
| O1 | Card status bull-count rule matches | PASS | Status: bullish, Bull Count: 4 |


## 8. Card 08 — Global Flows Checks
| Check | Description | Result | Notes |
|-------|-------------|--------|-------|
| S1 | Row count = 8 | PASS | Count: 8 |
| S2 | Row labels correct | PASS | Found: ['Regional Bull', 'Global', 'Emerging', 'USA', 'Canada', 'Europe', 'Asia', 'LatAm'] |
| R0V | Row 0 displays correct bull count | PASS | Display: 7 / 7, Calc: 7 |
| O1 | Card status matches regional bull count | PASS | Status: bullish, Bull Regions: 7/7 |


## 9. Card 09 — Sectors Checks
| Check | Description | Result | Notes |
|-------|-------------|--------|-------|
| O1 | Sectors status matches rotation spread | PASS | Status: bearish, Spread: -2.8% |


## 10. Card 10 — Commodities Checks
| Check | Description | Result | Notes |
|-------|-------------|--------|-------|
| S1 | Row count = 8 | PASS | Count: 8 |
| S2 | Row labels correct | PASS | Found: ['USCI', 'Copper', 'Gold', 'Silver', 'Energy', 'Agriculture', 'Steel', 'Uranium'] |
| O1 | Card status matches sub-commodity bull count | PASS | Status: bearish, Sub-bulls: 2/7 |


## 11. Card 11 — Equities Checks
| Check | Description | Result | Notes |
|-------|-------------|--------|-------|
| S1 | Row count = 9 | PASS | Count: 9 |
| S2 | Row labels correct | PASS | Found: ['Russell 2000', 'Freeport', 'Gold Miners', 'S&P 500', 'Nvidia', 'JPMorgan', 'Caterpillar', 'Exxon Mobil', 'Emerging Markets'] |
| O1 | Card status matches watchlist bull count | PASS | Status: neutral, Bull Count: 5/9 |


---

### Overall QA Status Summary
- **Total Checks Evaluated:** 119
- **Passed Checks:** 118 (99.2%)
- **Failed Checks:** 0 (0.0%)
- **N/A / Warnings:** 1