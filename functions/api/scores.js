/**
 * Market Hub — Scores API
 * Cloudflare Pages Function: GET /api/scores
 *
 * Returns scored JSON for all 9 cards. Sources:
 *   1. Cloudflare D1 (historical + today's indicators if seeded)
 *   2. Yahoo Finance v8 chart API (live fallback)
 *
 * Response shape: { timestamp, aggregate, cards[] }
 */

const YF = 'https://query1.finance.yahoo.com/v8/finance/chart';
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
  'Accept': 'application/json',
  'Referer': 'https://finance.yahoo.com/',
};

// ── ALL SYMBOLS NEEDED ACROSS 9 CARDS ────────────────────────────────────────
const ALL_SYMBOLS = [
  'SPY','QQQ','RSP','QQEW','IVW','IVE',          // Regime + Leadership
  'RSPD',                                          // Breadth proxy
  '^TYX','^TNX','TLT','UUP',                      // Yield
  'HYG','LQD','JNK',                              // Credit
  '^GSPTSE','SPDW','EWT','EWY','AIA','EZU',       // Global Flows
  'VEU','EEM','^N225','EWW','EWZ','ILF',
  'XLI','XLK','XLF','XLE','XLU','XLRE','XLP',    // Sectors
  'XME','GDX','COPX','KBE',
  'USCI','HG=F','GLD','IXC','XES','DBA','SLX',   // Commodities
  'GEV','CAT','GRID','SU','TVE.TO',               // Equities
  'RIO','CCO.TO','AEM','LRCX','SITM','SOXX','ZEB.TO',
];

// ── MATH ─────────────────────────────────────────────────────────────────────
function sma(arr, n) {
  if (!arr || arr.length < n) return null;
  return arr.slice(-n).reduce((a, b) => a + b, 0) / n;
}

function rsi(closes, period = 14) {
  if (!closes || closes.length < period + 1) return null;
  let ag = 0, al = 0;
  for (let i = 1; i <= period; i++) {
    const d = closes[i] - closes[i - 1];
    if (d > 0) ag += d; else al += -d;
  }
  ag /= period; al /= period;
  for (let i = period + 1; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1];
    ag = (ag * (period - 1) + Math.max(d, 0)) / period;
    al = (al * (period - 1) + Math.max(-d, 0)) / period;
  }
  return al === 0 ? 100 : 100 - 100 / (1 + ag / al);
}

function vsMA(price, ma) {
  if (!price || !ma) return null;
  return ((price - ma) / ma) * 100;
}

function pct(n, dec = 2) {
  if (n == null) return '—';
  return (n >= 0 ? '+' : '') + n.toFixed(dec) + '%';
}

function usd(n) { return n != null ? `US$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'; }
function num(n, d = 1) { return n != null ? n.toFixed(d) : '—'; }

// ── D1 SOURCE ─────────────────────────────────────────────────────────────────
async function loadFromD1(db) {
  try {
    // Last 35 calendar days covers ~25 trading days — enough for 20-day return + changePct
    const { results: priceRows } = await db.prepare(
      `SELECT symbol, date, close FROM daily_prices
       WHERE date >= DATE('now', '-35 days')
       ORDER BY symbol, date DESC`
    ).all();

    // Latest indicator row per symbol
    const { results: indRows } = await db.prepare(
      `SELECT i.symbol, i.sma50, i.sma200, i.rsi14, i.vs200_pct
       FROM indicators i
       INNER JOIN (
         SELECT symbol, MAX(date) as max_date FROM indicators GROUP BY symbol
       ) latest ON i.symbol = latest.symbol AND i.date = latest.max_date`
    ).all();

    // Group closes by symbol (already DESC), keep up to 22 for 20-day return
    const bySymbol = {};
    const latestDate = {};
    for (const row of priceRows) {
      if (!bySymbol[row.symbol]) {
        bySymbol[row.symbol] = [];
        latestDate[row.symbol] = row.date; // first occurrence = most recent (DESC order)
      }
      if (bySymbol[row.symbol].length < 22) bySymbol[row.symbol].push(row.close);
    }

    const indMap = {};
    for (const row of indRows) indMap[row.symbol] = row;

    const q = {};
    for (const [sym, closes] of Object.entries(bySymbol)) {
      const ind = indMap[sym];
      if (!ind || closes.length === 0) continue;
      const price = closes[0];
      const prev  = closes[1] ?? price;
      q[sym] = {
        symbol: sym,
        price,
        changePct: ((price - prev) / prev) * 100,
        price20d:  closes[20] ?? null,
        sma50:  ind.sma50,
        sma200: ind.sma200,
        rsi14:  ind.rsi14,
        vs50:   ind.sma50  ? ((price - ind.sma50)  / ind.sma50)  * 100 : null,
        vs200:  ind.vs200_pct,
        latestDate: latestDate[sym],
      };
    }
    return q;
  } catch { return {}; }
}

// ── YAHOO FINANCE FETCH ───────────────────────────────────────────────────────
async function fetchSymbol(symbol) {
  try {
    const encoded = encodeURIComponent(symbol);
    // Single call with 300d — gives price + enough history for SMA200 + RSI
    const res = await fetch(`${YF}/${encoded}?interval=1d&range=300d`, { headers: HEADERS });
    if (!res.ok) return null;
    const data = await res.json();
    const result = data?.chart?.result?.[0];
    if (!result) return null;
    const meta   = result.meta;
    const closes = (result.indicators?.quote?.[0]?.close || []).filter(c => c != null);
    const price  = meta.regularMarketPrice;
    const prev   = meta.previousClose ?? meta.chartPreviousClose ?? closes[closes.length - 2];
    const s50    = sma(closes, 50);
    const s200   = sma(closes, 200);
    const r14    = rsi(closes, 14);
    return {
      symbol,
      price,
      changePct: prev ? ((price - prev) / prev) * 100 : 0,
      price20d:  closes.length >= 21 ? closes[closes.length - 21] : null,
      sma50:  s50,
      sma200: s200,
      rsi14:  r14,
      vs50:   vsMA(price, s50),
      vs200:  vsMA(price, s200),
    };
  } catch { return null; }
}

async function fetchAll(symbols) {
  const results = await Promise.all(symbols.map(fetchSymbol));
  const map = {};
  results.forEach(r => { if (r) map[r.symbol] = r; });
  return map;
}

// ── SCORING HELPERS ───────────────────────────────────────────────────────────
// Each returns 'bullish' | 'neutral' | 'bearish'
function aboveBelow(price, ma) {
  if (!price || !ma) return 'neutral';
  return price > ma ? 'bullish' : 'bearish';
}

function cardStatus(rows) {
  const counts = { bullish: 0, neutral: 0, bearish: 0 };
  rows.forEach(r => counts[r.status]++);
  if (counts.bearish > counts.bullish) return 'bearish';
  if (counts.bullish > 0 && counts.bearish === 0) return 'bullish';
  return 'neutral';
}

// ── CARD BUILDERS ─────────────────────────────────────────────────────────────

function buildRegime(q) {
  const spy = q['SPY'];
  if (!spy) return placeholderCard(1, 'Regime', 'The Anchor');

  // Row 1: SPY Regime — structural anchor
  const isBull = spy.price > spy.sma200;
  const r1 = {
    label: 'SPY Regime',
    indicator: 'SPY vs 200d SMA',
    value: spy.sma200 != null ? `SPY&nbsp;$${spy.price.toFixed(2)}<br>200d&nbsp;$${spy.sma200.toFixed(2)}` : usd(spy.price),
    condition: isBull ? 'Secular Bull — Stay Long' : 'Secular Bear — Reduce Exposure',
    status: isBull ? 'bullish' : 'bearish',
  };

  // Row 2: Stretch Risk — 4-band aligned with history.js zones
  const v200 = spy.vs200;
  let stretchStatus, stretchCondition;
  if (v200 == null)     { stretchStatus = 'neutral'; stretchCondition = '—'; }
  else if (v200 > 14)   { stretchStatus = 'bearish'; stretchCondition = 'Overextended — Protect Gains'; }
  else if (v200 > 10)   { stretchStatus = 'neutral'; stretchCondition = 'Extended — Reduce New Adds'; }
  else if (v200 >= 0)   { stretchStatus = 'bullish'; stretchCondition = 'Normal Bull — Full Risk-On'; }
  else if (v200 >= -10) { stretchStatus = 'neutral'; stretchCondition = 'Bearish Retest — Hold'; }
  else                  { stretchStatus = 'bearish'; stretchCondition = 'Deeply Oversold — Raise Cash'; }
  const r2 = {
    label: 'Stretch Risk',
    indicator: 'Distance from 200d SMA',
    value: pct(v200),
    condition: stretchCondition,
    status: stretchStatus,
  };

  // Row 3: Trend Cross — Golden Cross / Death Cross
  const s50 = spy.sma50, s200 = spy.sma200;
  const isGolden = s50 != null && s200 != null ? s50 > s200 : null;
  const crossSpread = s50 != null && s200 != null ? ((s50 - s200) / s200) * 100 : null;
  const spreadStr = crossSpread != null ? ` (${crossSpread >= 0 ? '+' : ''}${crossSpread.toFixed(1)}%)` : '';
  const r3 = {
    label: 'Trend Cross',
    indicator: '50d SMA vs 200d SMA',
    value: s50 != null ? `50d: $${s50.toFixed(2)}` : '—',
    condition: isGolden == null ? '—' : isGolden ? `Golden Cross — Confirmed${spreadStr}` : `Death Cross — De-Risk${spreadStr}`,
    status: isGolden == null ? 'neutral' : isGolden ? 'bullish' : 'bearish',
  };

  const rows = [r1, r2, r3];
  // Card is bearish only when SPY is in a secular bear (below 200d SMA)
  const status = isBull ? cardStatus(rows) : 'bearish';
  return { id: 'regime', number: 1, title: 'Regime', subtitle: 'The Anchor', status, rows, hideIndicator: true };
}

function buildLeadership(q) {
  const spy  = q['SPY'],  rsp  = q['RSP'];
  const qqq  = q['QQQ'],  qqew = q['QQEW'];
  const ivw  = q['IVW'],  ive  = q['IVE'];
  if (!spy || !rsp) return placeholderCard(2, 'Leadership', 'The Quality Check');

  // 20-day return — falls back to daily changePct when price20d unavailable
  function ret20(s) {
    return s?.price20d ? (s.price / s.price20d - 1) * 100 : s?.changePct ?? null;
  }

  const rsp20 = ret20(rsp), spy20  = ret20(spy);
  const qqew20 = ret20(qqew), qqq20 = ret20(qqq);
  const ivw20  = ret20(ivw),  ive20 = ret20(ive);

  const rspLead    = rsp20 != null && spy20  != null ? rsp20  > spy20  : rsp.changePct > spy.changePct;
  const qqewLead   = qqew20 != null && qqq20 != null ? qqew20 > qqq20  : (qqew && qqq ? qqew.changePct > qqq.changePct : null);
  const growthLead = ivw20  != null && ive20  != null ? ivw20  > ive20  : (ivw && ive ? ivw.changePct > ive.changePct : null);

  const rspSpread   = rsp20  != null && spy20  != null ? rsp20  - spy20  : null;
  const qqewSpread  = qqew20 != null && qqq20  != null ? qqew20 - qqq20  : null;
  const styleSpread = ivw20  != null && ive20  != null ? ivw20  - ive20  : null;

  const rspSpreadStr   = rspSpread   != null ? ` (${pct(rspSpread, 1)})` : '';
  const qqewSpreadStr  = qqewSpread  != null ? ` (${pct(qqewSpread, 1)})` : '';
  const styleSpreadStr = styleSpread != null ? ` (${pct(styleSpread, 1)})` : '';

  const rows = [
    {
      label: 'Market Breadth',
      indicator: 'RSP vs SPY — 20d Return',
      value: rsp20 != null && spy20 != null ? `RSP&nbsp;${pct(rsp20, 1)}<br>SPY&nbsp;${pct(spy20, 1)}` : '—',
      condition: rspLead ? 'Breadth Expanding — Add Broadly' : 'Rally Narrowing — Stay with Leaders',
      status: rspLead ? 'bullish' : 'bearish',
    },
    {
      label: 'Tech Breadth',
      indicator: 'QQEW vs QQQ — 20d Return',
      value: qqew20 != null && qqq20 != null ? `QQEW&nbsp;${pct(qqew20, 1)}<br>QQQ&nbsp;${pct(qqq20, 1)}` : '—',
      condition: qqewLead == null ? '—' : (qqewLead ? 'Tech Broadening — Tech Healthy' : 'Mega-Cap Driven — Favour Large Cap'),
      status: qqewLead == null ? 'neutral' : (qqewLead ? 'bullish' : 'bearish'),
    },
    {
      label: 'Style Bias',
      indicator: 'IVW vs IVE — 20d Return',
      value: ivw20 != null && ive20 != null ? `IVW&nbsp;${pct(ivw20, 1)}<br>IVE&nbsp;${pct(ive20, 1)}` : '—',
      condition: growthLead == null ? '—' : (growthLead ? 'Growth Leading — Risk-On' : 'Value Rotating — Reduce Growth'),
      status: growthLead == null ? 'neutral' : (growthLead ? 'bullish' : 'neutral'),
    },
  ];
  return { id: 'leadership', number: 2, title: 'Leadership', subtitle: 'The Quality Check', status: cardStatus(rows), rows, hideIndicator: true };
}

function buildBreadth(q) {
  const rspd = q['RSPD'];
  const rspdBull = rspd && rspd.price && rspd.sma200 && rspd.price > rspd.sma200;

  const rows = [
    {
      label: 'NYSE Participation',
      indicator: '% Stocks above 200d SMA ($NYA200R)',
      value: 'StockCharts',
      condition: 'Manual Check Required',
      status: 'neutral',
      link: 'https://stockcharts.com/h-sc/ui?s=%24NYA200R',
    },
    {
      label: 'Short-Term Momentum',
      indicator: '% Stocks above 50d SMA ($NYA50R)',
      value: 'StockCharts',
      condition: 'Manual Check Required',
      status: 'neutral',
      link: 'https://stockcharts.com/h-sc/ui?s=%24NYA50R',
    },
    {
      label: 'New Highs Expansion',
      indicator: '% Stocks making 52-week highs ($NYHGH)',
      value: 'StockCharts',
      condition: 'Manual Check Required',
      status: 'neutral',
      link: 'https://stockcharts.com/h-sc/ui?s=%24NYHGH',
    },
    {
      label: 'Consumer Signal',
      indicator: 'RSPD (Equal-Weight Consumer Disc.)',
      value: rspd ? usd(rspd.price) : '—',
      condition: rspdBull == null ? '—' : (rspdBull ? 'Above 200d — Healthy' : 'Below 200d — Watch'),
      status: rspdBull ? 'bullish' : (rspd ? 'bearish' : 'neutral'),
    },
  ];
  return { id: 'breadth', number: 3, title: 'Breadth', subtitle: 'The Early Warning', status: cardStatus(rows), rows, hideIndicator: true };
}

// ── SHILLER D1 SOURCE ─────────────────────────────────────────────────────────
async function loadShillerLatest(db) {
  try {
    const [capeRes, peRes] = await Promise.all([
      db.prepare(`SELECT date, price, earnings, cape FROM shiller_data
                  WHERE cape IS NOT NULL ORDER BY date DESC LIMIT 1`).all(),
      db.prepare(`SELECT price, earnings FROM shiller_data
                  WHERE earnings > 0 AND price > 0 ORDER BY date DESC LIMIT 1`).all(),
    ]);
    const row = capeRes.results?.[0] ?? null;
    if (!row) return null;
    // Latest CAPE row may not have earnings yet — attach latest valid P/E separately
    if ((!row.earnings || row.earnings <= 0) && peRes.results?.[0]) {
      row.pePrice    = peRes.results[0].price;
      row.peEarnings = peRes.results[0].earnings;
    }
    return row;
  } catch { return null; }
}

// ── FORWARD P/E D1 SOURCE ────────────────────────────────────────────────────
async function loadForwardPeLatest(db) {
  try {
    const { results } = await db.prepare(
      `SELECT date, pe FROM forward_pe_data ORDER BY date DESC LIMIT 1`
    ).all();
    return results?.[0] ?? null;
  } catch { return null; }
}

// ── JAPAN P/E D1 SOURCE ───────────────────────────────────────────────────────
async function loadJapanPeLatest(db) {
  try {
    const { results } = await db.prepare(
      `SELECT date, pe FROM japan_pe_data ORDER BY date DESC LIMIT 1`
    ).all();
    return results?.[0] ?? null;
  } catch { return null; }
}

// ── BUFFETT D1 SOURCE ─────────────────────────────────────────────────────────
async function loadBuffettLatest(db) {
  try {
    const { results } = await db.prepare(
      `SELECT date, ratio FROM buffett_data ORDER BY date DESC LIMIT 1`
    ).all();
    return results?.[0] ?? null;
  } catch { return null; }
}


function buildValuations(shiller, buffett, forwardPe, japanPe) {
  // CAPE and trailing P/E come from D1 (shiller_data) when available.
  // Buffett Indicator comes from D1 (buffett_data) when available.
  // Forward P/E and Japan P/E come from D1 (nightly cron) when available.
  const cape         = shiller?.cape;
  const price        = shiller?.pePrice    ?? shiller?.price;
  const earnings     = shiller?.peEarnings ?? shiller?.earnings;
  const latestDate   = shiller?.date;
  const buffettRatio = buffett?.ratio ?? null;

  // Stale if stored month is 2+ months behind today (1-month lag is normal publish delay)
  const capeStale = (() => {
    if (!latestDate) return true;
    const d = new Date(latestDate);
    const now = new Date();
    return (now.getFullYear() * 12 + now.getMonth()) - (d.getFullYear() * 12 + d.getMonth()) > 1;
  })();

  const capeStr  = cape    ? `${cape.toFixed(1)}×${capeStale ? ' *' : ''}` : '~37×';
  const peVal    = price && earnings && earnings > 0 ? price / earnings : null;
  const peStr    = peVal != null ? `${peVal.toFixed(1)}×` : '~28×';
  const peStatus = peVal == null ? 'neutral' : peVal > 22 ? 'bearish' : peVal > 16 ? 'neutral' : 'bullish';
  const peCond   = peVal == null ? 'Elevated (hist avg ~16×)'
    : peVal > 22 ? 'Elevated — Above Long-Term Average'
    : peVal > 18 ? 'Above Average'
    : peVal > 16 ? 'Near Average (hist avg ~16×)'
    :              'Below Average — Historically Cheap';
  const dateLabel = latestDate
    ? new Date(latestDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
    : 'Jun 2026';

  const capeStatus = cape
    ? (cape > 35 ? 'bearish' : cape > 20 ? 'neutral' : 'bullish')
    : 'bearish';
  const capeCond = cape
    ? (cape > 40 ? 'Extreme — Above 2000 Peak'
      : cape > 35 ? `Very High — ${dateLabel} (avg ~17×)`
      : cape > 25 ? `Elevated — ${dateLabel} (avg ~17×)`
      :             `Normal — ${dateLabel} (avg ~17×)`)
    : 'Very High (hist avg ~17×)';

  const japanPeVal  = japanPe?.pe ?? null;
  const japanPeStr  = japanPeVal != null ? `${japanPeVal.toFixed(1)}×` : '~15×';
  const trailPe = price && earnings && earnings > 0 ? price / earnings : null;
  const japanStatus = japanPeVal != null && trailPe != null
    ? (japanPeVal < trailPe * 0.8 ? 'bullish' : japanPeVal < trailPe ? 'neutral' : 'bearish')
    : 'bullish';
  const japanCond = japanPeVal != null && trailPe != null
    ? (japanPeVal < trailPe
        ? `Compressed vs US (${trailPe.toFixed(0)}×) — Favour International`
        : `In Line with US (${trailPe.toFixed(0)}×)`)
    : 'Compressed vs US — Favour International';

  const rows = [
    { label: 'Trailing P/E',  indicator: 'S&P 500 Trailing P/E',       value: peStr,    condition: peCond,                     status: peStatus     },
    { label: 'CAPE',          indicator: 'Shiller CAPE (10yr)',          value: capeStr,  condition: capeCond,                   status: capeStatus   },
    { label: 'Buffett Ind.',  indicator: 'Mkt Cap / GDP (Buffett)',
      value:     buffettRatio != null ? `${buffettRatio.toFixed(0)}%` : '~230%',
      condition: buffettRatio != null
        ? (buffettRatio > 160 ? 'Extreme — At or Near Peak Levels'
          : buffettRatio > 115 ? 'Overvalued — Above Historical Average'
          : buffettRatio > 80  ? 'Fairly Valued'
          :                      'Undervalued')
        : 'Extreme — At or Near Peak Levels',
      status: buffettRatio != null
        ? (buffettRatio > 115 ? 'bearish' : buffettRatio > 80 ? 'neutral' : 'bullish')
        : 'bearish' },
    // Row 5 — deep-dive context only; excluded from card status
    { label: 'Japan P/E',     indicator: 'EWJ (Japan ETF) vs S&P 500', value: japanPeStr, condition: japanCond, status: japanStatus },
  ];

  return {
    id: 'valuations', number: 4, title: 'Valuations', subtitle: 'The Rubber Band',
    status: cardStatus(rows.slice(0, 4)),  // Japan P/E is deep-dive context only
    rows, hideIndicator: true,
    note: `Valuations are not a market-timing tool. They turn bearish only when combined with rising rates + earnings deceleration. CAPE from Shiller/Yale (${dateLabel}). Japan P/E via EWJ ETF, updated nightly. Buffett Indicator from FRED (live).`,
  };
}

function buildYield(q) {
  const tyx = q['^TYX'], tnx = q['^TNX'], tlt = q['TLT'], uup = q['UUP'];

  const yieldVal   = tyx?.price;
  const yieldStat  = yieldVal == null ? 'neutral' : yieldVal > 5 ? 'bearish' : yieldVal > 4.5 ? 'neutral' : 'bullish';
  const tltBull    = tlt && tlt.price > tlt.sma200;
  const uupBull    = uup && uup.price < uup.sma200; // weak dollar = bullish

  const rows = [
    {
      label: 'Long Bond Threshold',
      indicator: 'US 30-Year Yield (^TYX)',
      value: yieldVal ? yieldVal.toFixed(2) + '%' : '—',
      condition: yieldVal == null ? '—' : yieldVal > 5 ? 'Above 5% — Risk On Compression' : yieldVal > 4.5 ? 'Approaching Threshold' : 'Below Threshold',
      status: yieldStat,
    },
    {
      label: 'Real Rate Signal',
      indicator: 'US 10-Year Yield (^TNX)',
      value: tnx?.price ? tnx.price.toFixed(2) + '%' : '—',
      condition: 'Monitor vs CPI YoY',
      status: 'neutral',
    },
    {
      label: 'Duration Proxy',
      indicator: 'TLT — 20yr Bond ETF',
      value: tlt ? usd(tlt.price) : '—',
      condition: tltBull ? 'Above 200d SMA — Bullish' : (tlt ? 'Below 200d SMA — Bear' : '—'),
      status: tltBull ? 'bullish' : (tlt ? 'bearish' : 'neutral'),
    },
    {
      label: 'Dollar Strength',
      indicator: 'UUP — US Dollar ETF (DXY proxy)',
      value: uup ? usd(uup.price) : '—',
      condition: uupBull ? 'Weakening — EM Positive' : (uup ? 'Strengthening — EM Headwind' : '—'),
      status: uupBull ? 'bullish' : (uup ? 'bearish' : 'neutral'),
    },
  ];
  const status = yieldStat === 'bearish' ? 'bearish' : cardStatus(rows);
  return { id: 'yield', number: 5, title: 'Yield', subtitle: 'The Cost of Capital', status, rows, hideIndicator: true };
}

function buildGlobalFlows(q) {
  const globalSyms = [
    { sym: 'SPY',      label: 'S&P 500',       region: '🇺🇸 USA' },
    { sym: '^GSPTSE',  label: 'S&P/TSX',        region: '🇨🇦 Canada' },
    { sym: 'SPDW',     label: 'Dev. ex-US',     region: '🌍 Developed' },
    { sym: 'EZU',      label: 'Eurozone',        region: '🇪🇺 Europe' },
    { sym: '^N225',    label: 'Nikkei 225',      region: '🇯🇵 Japan' },
    { sym: 'EWT',      label: 'Taiwan',          region: '🇹🇼 Taiwan' },
    { sym: 'EWY',      label: 'S. Korea',        region: '🇰🇷 Korea' },
    { sym: 'AIA',      label: 'Asia 50',         region: '🌏 Asia' },
    { sym: 'VEU',      label: 'All World ex-US', region: '🌐 Global' },
    { sym: 'EEM',      label: 'Emerging Mkts',   region: '🌏 EM' },
    { sym: 'EWW',      label: 'Mexico',          region: '🇲🇽 Mexico' },
    { sym: 'EWZ',      label: 'Brazil',          region: '🇧🇷 Brazil' },
    { sym: 'ILF',      label: 'Latin America',   region: '🌎 LatAm' },
  ];
  let bull = 0;
  const details = globalSyms.map(({ sym, label, region }) => {
    const d = q[sym];
    const above = d && d.price && d.sma200 && d.price > d.sma200;
    if (above) bull++;
    const v200 = d?.vs200;
    return { region, label, sym, value: d ? usd(d.price) : '—', vs200: v200 != null ? pct(v200) : '—', above: !!above };
  });
  const total = globalSyms.length;
  const gStatus = bull >= 10 ? 'bullish' : bull >= 7 ? 'neutral' : 'bearish';
  const rows = [
    {
      label: 'Global Breadth',
      indicator: `${bull}/${total} markets above 200d SMA`,
      value: `${bull}/${total}`,
      condition: bull >= 10 ? 'Synchronized Expansion' : bull >= 7 ? 'Partial Expansion' : 'Global Divergence',
      status: gStatus,
    },
    ...details.slice(0, 4).map(d => ({
      label: d.region,
      indicator: `${d.label} (${d.sym})`,
      value: d.value,
      condition: d.above ? 'Above 200d — Bull' : 'Below 200d — Bear',
      status: d.above ? 'bullish' : 'bearish',
    })),
  ];
  return { id: 'globalflows', number: 6, title: 'Global Flows', subtitle: 'The Tide', status: gStatus, rows, details, hideIndicator: true };
}

function buildSectors(q) {
  const cyclicals  = ['XLI', 'XLK', 'XME', 'XLF'];
  const defensives = ['XLU', 'XLRE', 'XLP'];
  const spy = q['SPY'];

  let cycBull = 0, defBull = 0;
  const sectRows = [];

  cyclicals.forEach(sym => {
    const d = q[sym];
    if (!d || !spy) return;
    const relPerf = d.changePct - spy.changePct;
    const abv200  = d.price > d.sma200;
    if (abv200) cycBull++;
    sectRows.push({
      label: 'Cyclical',
      indicator: sym,
      value: usd(d.price),
      condition: abv200 ? `${pct(relPerf)} vs SPY — Bull` : `${pct(relPerf)} vs SPY — Watch`,
      status: abv200 ? 'bullish' : 'neutral',
    });
  });
  defensives.forEach(sym => {
    const d = q[sym];
    if (!d || !spy) return;
    const relPerf = d.changePct - spy.changePct;
    const abv200  = d.price > d.sma200;
    if (abv200) defBull++;
    sectRows.push({
      label: 'Defensive',
      indicator: sym,
      value: usd(d.price),
      condition: abv200 ? `${pct(relPerf)} vs SPY` : `${pct(relPerf)} vs SPY`,
      status: abv200 && relPerf > 0 ? 'bearish' : 'neutral', // defensives leading = bearish signal
    });
  });

  const offenseLeading = cycBull > defBull;
  const rows = [
    {
      label: 'Rotation Mode',
      indicator: 'Cyclicals vs Defensives (vs 200d SMA)',
      value: `${cycBull}/${cyclicals.length} cyc bull`,
      condition: offenseLeading ? 'Offense Leading — Risk-On' : 'Defense Leading — Risk-Off',
      status: offenseLeading ? 'bullish' : 'bearish',
    },
    ...sectRows.slice(0, 4),
  ];
  return { id: 'sectors', number: 7, title: 'Sectors', subtitle: 'The Rotation', status: offenseLeading ? 'bullish' : 'neutral', rows, hideIndicator: true };
}

function buildCommodities(q) {
  const comSyms = ['USCI', 'HG=F', 'GLD', 'IXC', 'XES', 'DBA', 'SLX'];
  const labels  = {
    USCI: 'USCI — Commodities Benchmark',
    'HG=F': 'Copper (Growth Barometer)',
    GLD: 'Gold (Safe Haven)',
    IXC: 'Global Energy ETF',
    XES: 'E&P Oil Services',
    DBA: 'Agriculture (DBA)',
    SLX: 'Steel ETF (SLX)',
  };
  let bull = 0;
  const rows = comSyms.map(sym => {
    const d = q[sym];
    const above = d && d.price && d.sma200 && d.price > d.sma200;
    if (above) bull++;
    return {
      label: sym === 'HG=F' ? '⚙ Growth Signal' : sym === 'GLD' ? '🛡 Safe Haven' : '📦 Real Asset',
      indicator: labels[sym] || sym,
      value: d ? (sym === 'HG=F' ? `$${d.price.toFixed(3)}/lb` : usd(d.price)) : '—',
      condition: above ? `${pct(d.vs200)} above 200d` : (d ? `${pct(d?.vs200)} vs 200d` : '—'),
      status: above ? 'bullish' : (d ? 'bearish' : 'neutral'),
    };
  });
  const status = bull >= 5 ? 'bullish' : bull >= 3 ? 'neutral' : 'bearish';
  return { id: 'commodities', number: 8, title: 'Commodities', subtitle: 'The Growth Engine', status, rows, hideIndicator: true,
    summary: `${bull}/${comSyms.length} commodities above 200d SMA` };
}

function buildEquities(q) {
  const watchList = [
    { sym: 'GEV',     group: 'Power/Grid' },
    { sym: 'CAT',     group: 'Industrials' },
    { sym: 'GRID',    group: 'Power/Grid' },
    { sym: 'SU',      group: 'Energy (CA)' },
    { sym: 'TVE.TO',  group: 'Energy (CA)' },
    { sym: 'RIO',     group: 'Mining' },
    { sym: 'CCO.TO',  group: 'Uranium' },
    { sym: 'AEM',     group: 'Gold' },
    { sym: 'LRCX',    group: 'Semis' },
    { sym: 'SITM',    group: 'Semis' },
  ];
  let bull = 0;
  const rows = watchList.map(({ sym, group }) => {
    const d = q[sym];
    const abvBoth = d && d.price && d.sma50 && d.sma200 && d.price > d.sma50 && d.price > d.sma200;
    if (abvBoth) bull++;
    return {
      label: group,
      indicator: sym,
      value: d ? usd(d.price) : '—',
      condition: abvBoth ? 'Above 50d & 200d' : (d ? (d.price > d.sma200 ? 'Above 200d, below 50d' : 'Below 200d — Watch') : '—'),
      status: abvBoth ? 'bullish' : (d && d.price > d.sma200 ? 'neutral' : (d ? 'bearish' : 'neutral')),
    };
  });
  const total = watchList.length;
  const status = bull >= 7 ? 'bullish' : bull >= 5 ? 'neutral' : 'bearish';
  return { id: 'equities', number: 9, title: 'Equities', subtitle: 'The Execution Layer', status, rows, hideIndicator: true,
    summary: `${bull}/${total} above both 50d & 200d SMA` };
}

function buildCredit(q) {
  const hyg = q['HYG'];
  const lqd = q['LQD'];
  const jnk = q['JNK'];

  const hygBull = hyg && hyg.price && hyg.sma200 ? hyg.price > hyg.sma200 : null;
  const lqdBull = lqd && lqd.price && lqd.sma200 ? lqd.price > lqd.sma200 : null;
  const jnkBull = jnk && jnk.price && jnk.sma200 ? jnk.price > jnk.sma200 : null;
  const spreadTightening = hyg && lqd ? hyg.changePct > lqd.changePct : null;

  const rows = [
    {
      label: 'Risk Appetite',
      indicator: 'HYG — High Yield Corp Bond ETF',
      value: hyg ? usd(hyg.price) : '—',
      condition: hygBull == null ? '—' : hygBull ? `${pct(hyg.vs200)} above 200d — Healthy` : `${pct(hyg.vs200)} below 200d — Watch`,
      status: hygBull == null ? 'neutral' : hygBull ? 'bullish' : 'bearish',
    },
    {
      label: 'Spread Signal',
      indicator: 'HYG vs LQD (HY vs IG spread proxy)',
      value: hyg && lqd ? `HYG ${pct(hyg.changePct, 2)} | LQD ${pct(lqd.changePct, 2)}` : '—',
      condition: spreadTightening == null ? '—' : spreadTightening ? 'Spreads Tightening — Risk-On' : 'Spreads Widening — Caution',
      status: spreadTightening == null ? 'neutral' : spreadTightening ? 'bullish' : 'bearish',
    },
    {
      label: 'IG Demand',
      indicator: 'LQD — Investment Grade Bond ETF',
      value: lqd ? usd(lqd.price) : '—',
      condition: lqdBull == null ? '—' : lqdBull ? `${pct(lqd.vs200)} above 200d` : `${pct(lqd.vs200)} below 200d`,
      status: lqdBull == null ? 'neutral' : lqdBull ? 'bullish' : 'bearish',
    },
    {
      label: 'Distress Signal',
      indicator: 'JNK — SPDR High Yield Bond ETF',
      value: jnk ? usd(jnk.price) : '—',
      condition: jnkBull == null ? '—' : jnkBull ? `${pct(jnk.vs200)} above 200d — No Stress` : `${pct(jnk.vs200)} below 200d — Stress`,
      status: jnkBull == null ? 'neutral' : jnkBull ? 'bullish' : 'bearish',
    },
  ];

  const bull = rows.filter(r => r.status === 'bullish').length;
  const status = bull >= 3 ? 'bullish' : bull >= 2 ? 'neutral' : 'bearish';
  return {
    id: 'credit', number: 10, title: 'Credit', subtitle: 'The Risk Canary', status, rows, hideIndicator: true,
    note: 'Credit spreads lead equity markets. HYG below its 200d SMA has preceded major equity drawdowns by 4–6 weeks historically.',
  };
}

function placeholderCard(num, title, subtitle) {
  return { id: title.toLowerCase(), number: num, title, subtitle, status: 'neutral',
    rows: [{ label: '—', indicator: 'Data unavailable', value: '—', condition: '—', status: 'neutral' }] };
}

// ── DELTA ─────────────────────────────────────────────────────────────────────
function computeDeltas(current, previous) {
  const rank = { bullish: 2, neutral: 1, bearish: 0 };
  const out = {};
  for (const [id, status] of Object.entries(current)) {
    const prev = previous?.[id];
    if (!prev) { out[id] = 'same'; continue; }
    const diff = rank[status] - rank[prev];
    out[id] = diff > 0 ? 'up' : diff < 0 ? 'down' : 'same';
  }
  return out;
}

// ── AGGREGATE SCORE ───────────────────────────────────────────────────────────
function buildAggregate(cards) {
  const counts = { bullish: 0, neutral: 0, bearish: 0 };
  cards.forEach(c => counts[c.status]++);
  const score = counts.bullish;
  const total = cards.length;
  const greenThresh  = Math.round(total * 0.75); // 7/9, 8/10
  const yellowThresh = Math.round(total * 0.55); // 5/9, 6/10
  const glow  = score >= greenThresh  ? 'green' : score >= yellowThresh ? 'yellow' : 'red';
  const label = score >= greenThresh  ? 'Secular Bull Intact' : score >= yellowThresh ? 'Mixed Signals — Selective' : 'Risk-Off — Reduce Exposure';
  const posture = score >= greenThresh ? 'Risk-On, Not Complacent' : score >= yellowThresh ? 'Selective, Not Aggressive' : 'Defensive, Raise Cash';
  return { bullish: counts.bullish, neutral: counts.neutral, bearish: counts.bearish,
    score: `${score}/${total}`, label, posture, glow };
}

// ── HANDLER ───────────────────────────────────────────────────────────────────
export async function onRequest(context) {
  if (context.request.method === 'OPTIONS') {
    return new Response(null, { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET' } });
  }

  // Try D1 first; fall back to Yahoo Finance for any symbol not found in D1 or stale
  const db  = context.env.DB;
  const kv = context.env.SUMMARIES;
  const [d1, shiller, buffett, forwardPe, japanPe] = await Promise.all([
    db ? loadFromD1(db) : Promise.resolve({}),
    db ? loadShillerLatest(db) : Promise.resolve(null),
    db ? loadBuffettLatest(db) : Promise.resolve(null),
    db ? loadForwardPeLatest(db) : Promise.resolve(null),
    db ? loadJapanPeLatest(db) : Promise.resolve(null),
  ]);
  const today = new Date().toISOString().slice(0, 10);
  const missing = ALL_SYMBOLS.filter(s => !d1[s] || d1[s].latestDate < today);

  const q = { ...d1 };
  if (missing.length > 0) {
    const batches = [];
    for (let i = 0; i < missing.length; i += 20)
      batches.push(missing.slice(i, i + 20));
    for (const batch of batches) {
      const batchData = await fetchAll(batch);
      Object.assign(q, batchData);
    }
  }

  const cards = [
    buildRegime(q),
    buildLeadership(q),
    buildBreadth(q),
    buildValuations(shiller, buffett, forwardPe, japanPe),
    buildYield(q),
    buildGlobalFlows(q),
    buildSectors(q),
    buildCommodities(q),
    buildEquities(q),
    buildCredit(q),
  ];

  // ── DELTA: compare today vs previous trading day ───────────────────────────
  if (kv) {
    try {
      const today = new Date().toISOString().slice(0, 10);
      const [current, previous] = await Promise.all([
        kv.get('card-statuses:current', 'json'),
        kv.get('card-statuses:previous', 'json'),
      ]);

      const todayStatuses = {};
      cards.forEach(c => { todayStatuses[c.id] = c.status; });

      let deltas = {};
      if (!current || current.date < today) {
        if (current) await kv.put('card-statuses:previous', JSON.stringify(current));
        await kv.put('card-statuses:current', JSON.stringify({ date: today, statuses: todayStatuses }));
        if (current) deltas = computeDeltas(todayStatuses, current.statuses);
      } else {
        if (previous) deltas = computeDeltas(todayStatuses, previous.statuses);
      }

      cards.forEach(c => { c.delta = deltas[c.id] || 'same'; });
    } catch { /* non-fatal */ }
  }

  const source = !db || missing.length === ALL_SYMBOLS.length ? 'yahoo'
    : missing.length === 0 ? 'd1'
    : 'd1+yahoo';

  const body = JSON.stringify({
    timestamp: new Date().toISOString(),
    source,
    aggregate: buildAggregate(cards),
    cards,
  });

  return new Response(body, {
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, max-age=60',
    },
  });
}
