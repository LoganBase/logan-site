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
  '^TYX','^TNX','^IRX','TLT','UUP',               // Yield
  'HYG','LQD','EMB',                               // Credit
  'ACWI','FEZ','AIA','ILF','EEM',                  // Global Flows — regional
  '^GSPTSE','EWU','EWG','EWQ','EWL','EWN','EWI','EWP',  // Global Flows — Europe countries
  'EWJ','MCHI','EWT','EWY','INDA','EWA','EWH',   // Global Flows — Asia countries
  'EWW','EWZ','ECH',                              // Global Flows — LatAm countries
  'XLI','XLK','XLF','XLE','XLU','XLRE','XLP',    // Sectors (7 existing)
  'XLV','XLC','XLY','XLB',                        // Sectors (4 added for breadth)
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

function usd(n) { return n != null ? `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'; }
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
  const regimeNote = (() => {
    const crossStr = isGolden == null ? ''
      : isGolden
      ? `Golden Cross in place${crossSpread != null ? ` (50d ${pct(crossSpread, 1)} above 200d)` : ''} — trend confirmed.`
      : `Death Cross in effect${crossSpread != null ? ` (50d ${pct(Math.abs(crossSpread), 1)} below 200d)` : ''} — trend broken.`;
    const stretchStr = v200 == null ? ''
      : v200 > 14 ? ` SPY ${pct(v200)} above 200d — overextended, pullback risk elevated.`
      : v200 >= 0 ? ` SPY ${pct(v200)} above 200d — normal bull range.`
      : ` SPY ${pct(v200)} below 200d — bear regime active; read all cards defensively.`;
    return crossStr + stretchStr;
  })();
  return { id: 'regime', number: 1, title: 'Regime', subtitle: 'The Anchor', status, rows, hideIndicator: true, note: regimeNote };
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
  const leaderNote = (() => {
    const breadthStr = rspLead
      ? `Breadth expanding — RSP leading SPY${rspSpreadStr}. Broad participation is healthy.`
      : `Rally narrowing — SPY leading RSP${rspSpreadStr}. Concentration risk rising.`;
    const styleStr = growthLead == null ? ''
      : growthLead ? ' Growth over Value — risk appetite intact.'
      : ' Value over Growth — defensive rotation underway.';
    return breadthStr + styleStr;
  })();
  return { id: 'leadership', number: 2, title: 'Leadership', subtitle: 'The Quality Check', status: cardStatus(rows), rows, hideIndicator: true, note: leaderNote };
}

function buildBreadth(q, breadthData) {
  // Primary signals: $MMTH (200d) and $MMFI (50d) from D1 market_breadth table
  const mmth = breadthData?.pct_above_200d;
  const mmfi = breadthData?.pct_above_50d;

  // Validation: coarser sector ETF breadth
  const SECTORS = ['XLK','XLV','XLF','XLI','XLC','XLY','XLP','XLE','XLU','XLRE','XLB'];
  const SECTOR_NAMES = {
    XLK: 'Technology', XLV: 'Health Care', XLF: 'Financials', XLI: 'Industrials',
    XLC: 'Comm. Services', XLY: 'Consumer Disc.', XLP: 'Consumer Staples',
    XLE: 'Energy', XLU: 'Utilities', XLRE: 'Real Estate', XLB: 'Materials',
  };
  const valid200 = SECTORS.filter(s => q[s]?.price && q[s]?.sma200);
  const bull200  = valid200.filter(s => q[s].price > q[s].sma200).length;
  const n200     = valid200.length;

  const rspd     = q['RSPD'];
  const rspdBull = rspd?.price && rspd?.sma200 ? rspd.price > rspd.sma200 : null;

  // Row 1: NYSE 200d ($MMTH)
  const mmthStatus = mmth == null ? 'neutral' : mmth >= 70 ? 'bullish' : mmth >= 40 ? 'neutral' : 'bearish';
  const mmthCond   = mmth == null ? 'Awaiting Data'
    : mmth >= 70 ? 'Broad Participation — Rally Has Legs'
    : mmth >= 40 ? 'Mixed Breadth — Bifurcated Market'
    :               'Breadth Breakdown — Risk Off';

  // Row 2: NYSE 50d ($MMFI)
  const mmfiStatus = mmfi == null ? 'neutral' : mmfi >= 70 ? 'bullish' : mmfi >= 40 ? 'neutral' : 'bearish';
  const mmfiCond   = mmfi == null ? 'Awaiting Data'
    : mmfi >= 70 ? 'Momentum Expanding — Add Risk'
    : mmfi >= 40 ? 'Mixed Momentum — Watch Leaders'
    :               'Momentum Fading — Tighten Stops';

  // Row 3: Sector Check (coarser validation)
  const sectStatus = n200 < 7 ? 'neutral' : bull200 >= 8 ? 'bullish' : bull200 >= 5 ? 'neutral' : 'bearish';
  const sectCond   = n200 < 7 ? 'Insufficient Data'
    : bull200 >= 8 ? 'Broad Participation — Stay Long'
    : bull200 >= 5 ? 'Mixed Breadth — Be Selective'
    :                'Sector Breakdown — Reduce Risk';

  const rows = [
    {
      label: 'NYSE 200d Breadth',
      indicator: '$MMTH — % NYSE Stocks Above 200d SMA',
      value: mmth != null ? `${mmth.toFixed(1)}%` : '—',
      condition: mmthCond,
      status: mmthStatus,
    },
    {
      label: 'NYSE 50d Breadth',
      indicator: '$MMFI — % NYSE Stocks Above 50d SMA',
      value: mmfi != null ? `${mmfi.toFixed(1)}%` : '—',
      condition: mmfiCond,
      status: mmfiStatus,
    },
    {
      label: 'Sector Check',
      indicator: 'SPDR Sectors Above 200d SMA (11)',
      value: n200 > 0 ? `${bull200} / ${n200}` : '—',
      condition: sectCond,
      status: sectStatus,
    },
    {
      label: 'Consumer Signal',
      indicator: 'RSPD (Equal-Weight Consumer Disc.)',
      value: rspd ? usd(rspd.price) : '—',
      condition: rspdBull == null ? '—' : (rspdBull ? 'Above 200d — Consumer Healthy' : 'Below 200d — Risk Rising'),
      status: rspdBull == null ? 'neutral' : (rspdBull ? 'bullish' : 'bearish'),
    },
  ];

  const breadthNote = (() => {
    if (mmth != null) {
      const signal = mmth >= 70 ? 'broad participation across NYSE — rally is healthy.'
        : mmth >= 40 ? 'mixed breadth — market bifurcating, stay with leaders.'
        : 'breadth breaking down — reduce broad exposure.';
      const moStr  = mmfi != null ? ` Short-term: ${mmfi.toFixed(1)}% of NYSE above 50d.` : '';
      const sectStr = n200 >= 7 ? ` Sector check: ${bull200}/${n200}.` : '';
      return `${mmth.toFixed(1)}% of NYSE stocks above 200d SMA — ${signal}${moStr}${sectStr}`;
    }
    if (n200 < 7) return 'Breadth data loading — check back shortly.';
    const signal = bull200 >= 8 ? 'broad support across sectors — rally is healthy.'
      : bull200 >= 5 ? 'mixed sector participation — rally narrowing, stay with leaders.'
      : 'sector breadth breaking down — reduce broad exposure.';
    return `${bull200} of ${n200} S&P 500 sectors above 200d SMA — ${signal}`;
  })();

  const sectorTable = SECTORS.map(s => {
    const d = q[s];
    if (!d?.price || !d?.sma200) return null;
    const vs200 = d.vs200 ?? ((d.price - d.sma200) / d.sma200 * 100);
    return { ticker: s, name: SECTOR_NAMES[s], vs200: +vs200.toFixed(2), bull: d.price > d.sma200 };
  }).filter(Boolean);

  return { id: 'breadth', number: 3, title: 'Breadth', subtitle: 'The Early Warning', status: cardStatus(rows), rows, hideIndicator: true, note: breadthNote, sectorTable };
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

// ── BREADTH D1 SOURCE ─────────────────────────────────────────────────────────
async function loadBreadthLatest(db) {
  try {
    const { results } = await db.prepare(
      `SELECT date, pct_above_200d, pct_above_50d FROM market_breadth ORDER BY date DESC LIMIT 1`
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
  const peCond   = peVal == null ? 'Elevated — Monitor (hist avg ~16×)'
    : peVal > 22 ? 'Elevated — Favour Value Over Growth'
    : peVal > 18 ? 'Above Average — Quality Bias'
    : peVal > 16 ? 'Near Average — Fully Valued'
    :              'Below Average — Add on Weakness';
  const dateLabel = latestDate
    ? new Date(latestDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
    : 'Jun 2026';

  const capeStatus = cape
    ? (cape > 35 ? 'bearish' : cape > 20 ? 'neutral' : 'bullish')
    : 'bearish';
  const capeCond = cape
    ? (cape > 40 ? 'Extreme — Near 2000 Peak, Limit Exposure'
      : cape > 35 ? 'Very High — Reduce Equity Allocation'
      : cape > 25 ? 'Elevated — Quality Bias'
      :             'Normal Range — Average Expected Returns')
    : 'Very High — Limit New Exposure';

  const japanPeVal  = japanPe?.pe ?? null;
  const japanPeStr  = japanPeVal != null ? `${japanPeVal.toFixed(1)}×` : '~15×';
  const trailPe  = price && earnings && earnings > 0 ? price / earnings : null;
  const liveUsPe = forwardPe?.pe ?? trailPe;  // live SPY trailing P/E preferred over stale Shiller
  const japanStatus = japanPeVal != null && liveUsPe != null
    ? (japanPeVal < liveUsPe * 0.8 ? 'bullish' : japanPeVal < liveUsPe ? 'neutral' : 'bearish')
    : 'bullish';
  const japanCond = japanPeVal != null && liveUsPe != null
    ? (japanPeVal < liveUsPe
        ? `Compressed vs US (${liveUsPe.toFixed(0)}×) — Favour International`
        : `In Line with US (${liveUsPe.toFixed(0)}×) — No Valuation Edge`)
    : 'Compressed vs US — Favour International';

  const rows = [
    { label: 'Trailing P/E',  indicator: 'S&P 500 Trailing P/E (Shiller, 1-2mo lag)', value: peStr, condition: peCond, status: peStatus },
    { label: 'CAPE',          indicator: 'Shiller CAPE (10yr)',          value: capeStr,  condition: capeCond,                   status: capeStatus   },
    { label: 'Buffett Ind.',  indicator: 'Mkt Cap / GDP (Buffett)',
      value:     buffettRatio != null ? `${buffettRatio.toFixed(0)}%` : '~230%',
      condition: buffettRatio != null
        ? (buffettRatio > 160 ? 'Extreme — Near Peak, Limit Exposure'
          : buffettRatio > 115 ? 'Overvalued — Reduce Allocation'
          : buffettRatio > 80  ? 'Fairly Valued — Neutral Allocation'
          :                      'Undervalued — Accumulate on Dips')
        : 'Extreme — Near Peak, Limit Exposure',
      status: buffettRatio != null
        ? (buffettRatio > 115 ? 'bearish' : buffettRatio > 80 ? 'neutral' : 'bullish')
        : 'bearish' },
    // Row 5 — deep-dive context only; excluded from card status
    { label: 'Japan P/E',     indicator: 'EWJ (Japan ETF) vs S&P 500', value: japanPeStr, condition: japanCond, status: japanStatus },
  ];

  return {
    id: 'valuations', number: 4, title: 'Valuations', subtitle: 'The Rubber Band',
    status: cardStatus(rows.slice(0, 3)),  // Japan P/E is deep-dive context only
    rows, hideIndicator: true,
    note: [
      'Valuations set return expectations, not entry points — combine with Regime and Credit before acting.',
      cape != null ? `CAPE ${cape.toFixed(1)}× (${dateLabel}) — ${cape > 35 ? 'top decile historically; long-run returns compress from here' : cape > 25 ? 'elevated vs ~17× long-run avg' : 'near long-run average'}.` : null,
      buffettRatio != null ? `Buffett Indicator ${buffettRatio.toFixed(0)}% — ${buffettRatio > 160 ? 'extreme overvaluation' : buffettRatio > 115 ? 'overvalued vs GDP' : 'fair-value range'}.` : null,
      japanPeVal != null && liveUsPe != null ? `Japan (EWJ) ${japanPeVal.toFixed(1)}× vs US ${liveUsPe.toFixed(0)}× — ${japanPeVal < liveUsPe ? 'international valuation premium intact' : 'valuation gap has closed'}.` : null,
    ].filter(Boolean).join(' '),
  };
}

function buildYield(q) {
  const tyx = q['^TYX'], tnx = q['^TNX'], irx = q['^IRX'], uup = q['UUP'];

  const yieldVal   = tyx?.price;
  const yieldRnd   = yieldVal != null ? Math.round(yieldVal * 100) / 100 : null;
  const yieldStat  = yieldRnd == null ? 'neutral' : yieldRnd >= 5 ? 'bearish' : yieldRnd > 4.5 ? 'neutral' : 'bullish';
  const uupBull    = uup && uup.price < uup.sma200;

  const curveSpread  = tnx?.price != null && irx?.price != null ? tnx.price - irx.price : null;
  const curveStatus  = curveSpread == null ? 'neutral' : curveSpread < 0 ? 'bearish' : curveSpread < 1 ? 'neutral' : 'bullish';
  const curveCond    = curveSpread == null ? '—'
    : curveSpread < -0.5 ? 'Deeply Inverted — Recession Risk Elevated'
    : curveSpread < 0    ? 'Inverted — Recession Warning'
    : curveSpread < 1    ? 'Flat — Watch for Steepening'
    :                      'Steepening — Growth Expectations Returning';

  const rows = [
    {
      label: '30Y Benchmark',
      indicator: 'US 30-Year Yield (^TYX)',
      value: yieldVal ? yieldVal.toFixed(2) + '%' : '—',
      condition: yieldRnd == null ? '—' : yieldRnd >= 5 ? 'At/Above 5% — Equity Multiple Compression' : yieldRnd > 4.5 ? 'Approaching 5% — Reduce Duration Risk' : 'Below 5% — Multiples Supported',
      status: yieldStat,
    },
    {
      label: '10Y Benchmark',
      indicator: 'US 10-Year Yield (^TNX)',
      value: tnx?.price ? tnx.price.toFixed(2) + '%' : '—',
      condition: tnx?.price == null ? '—'
        : tnx.price >= 4.5 ? 'Restrictive — Compressing Equity Multiples'
        : tnx.price >= 3.5 ? 'Elevated — Headwind for Growth'
        : tnx.price >= 2.5 ? 'Neutral — Hold Duration'
        :                    'Accommodative — Tailwind for Equities',
      status: tnx?.price == null ? 'neutral'
        : tnx.price >= 4.5 ? 'bearish'
        : tnx.price >= 3.5 ? 'neutral'
        : 'bullish',
    },
    {
      label: 'Yield Curve',
      indicator: '3m–10Y Spread (Recession Signal)',
      value: curveSpread != null ? (curveSpread >= 0 ? '+' : '') + curveSpread.toFixed(2) + '%' : '—',
      condition: curveCond,
      status: curveStatus,
    },
    {
      label: 'Dollar Strength',
      indicator: 'UUP — US Dollar ETF (DXY proxy)',
      value: uup ? usd(uup.price) : '—',
      condition: uupBull ? 'Weakening — EM Positive' : (uup ? 'Strengthening — Multinational & EM Headwind' : '—'),
      status: uupBull ? 'bullish' : (uup ? 'bearish' : 'neutral'),
    },
  ];
  const status = yieldStat === 'bearish' ? 'bearish' : cardStatus(rows);
  const yieldNote = (() => {
    const threshStr = yieldRnd == null ? ''
      : yieldRnd >= 5 ? `30Y at ${yieldRnd}% — above the 5% threshold; equity multiple compression in effect.`
      : yieldRnd > 4.5 ? `30Y at ${yieldRnd}% — approaching the 5% danger zone; monitor closely.`
      : `30Y at ${yieldRnd}% — below the 5% threshold; rate pressure contained.`;
    const curveStr = curveSpread == null ? ''
      : curveSpread < 0 ? ` Curve inverted (${pct(curveSpread, 2)}) — NY Fed recession model elevated.`
      : curveSpread < 1 ? ` Curve flat (${pct(curveSpread, 2)}) — transition phase; watch for steepening.`
      : ` Curve steepening (${pct(curveSpread, 2)}) — growth expectations rebuilding.`;
    return threshStr + curveStr;
  })();
  return { id: 'yield', number: 5, title: 'Yield', subtitle: 'The Cost of Capital', status, rows, hideIndicator: true, note: yieldNote };
}

function buildGlobalFlows(q) {
  // ── Card-level regional ETFs (no flag emojis) ─────────────────────────────
  const cardSyms = [
    { sym: 'ACWI',    label: 'MSCI ACWI',      region: 'Global'   },
    { sym: 'SPY',     label: 'S&P 500',         region: 'USA'      },
    { sym: '^GSPTSE', label: 'S&P/TSX',         region: 'Canada'   },
    { sym: 'FEZ',     label: 'Euro STOXX 50',   region: 'Europe'   },
    { sym: 'AIA',     label: 'Asia 50',         region: 'Asia'     },
    { sym: 'ILF',     label: 'LatAm 40',        region: 'LatAm'    },
    { sym: 'EEM',     label: 'Emerging Mkts',   region: 'Emerging' },
  ];

  // ── Country deep-dive (geographic order, flags rendered in frontend) ───────
  const countrySyms = [
    { sym: 'SPY',     label: 'S&P 500',     group: 'North America' },
    { sym: '^GSPTSE', label: 'Canada',       group: 'North America' },
    { sym: 'EWU',     label: 'UK',           group: 'Europe'        },
    { sym: 'EWG',     label: 'Germany',      group: 'Europe'        },
    { sym: 'EWQ',     label: 'France',       group: 'Europe'        },
    { sym: 'EWL',     label: 'Switzerland',  group: 'Europe'        },
    { sym: 'EWN',     label: 'Netherlands',  group: 'Europe'        },
    { sym: 'EWI',     label: 'Italy',        group: 'Europe'        },
    { sym: 'EWP',     label: 'Spain',        group: 'Europe'        },
    { sym: 'EWJ',     label: 'Japan',        group: 'Asia Pacific'  },
    { sym: 'MCHI',    label: 'China',        group: 'Asia Pacific'  },
    { sym: 'EWT',     label: 'Taiwan',       group: 'Asia Pacific'  },
    { sym: 'EWY',     label: 'S. Korea',     group: 'Asia Pacific'  },
    { sym: 'INDA',    label: 'India',        group: 'Asia Pacific'  },
    { sym: 'EWA',     label: 'Australia',    group: 'Asia Pacific'  },
    { sym: 'EWH',     label: 'Hong Kong',    group: 'Asia Pacific'  },
    { sym: 'EWZ',     label: 'Brazil',       group: 'Latin America' },
    { sym: 'EWW',     label: 'Mexico',       group: 'Latin America' },
    { sym: 'ECH',     label: 'Chile',        group: 'Latin America' },
  ];

  // legacy alias so the rest of the function compiles unchanged during transition
  const globalSyms = [];
  // ── Build card rows ────────────────────────────────────────────────────────
  let bull = 0;
  const cardDetails = cardSyms.map(({ sym, label, region }) => {
    const d = q[sym];
    const above = !!(d?.price && d?.sma200 && d.price > d.sma200);
    if (above) bull++;
    const vs200 = d?.vs200;
    return { sym, label, region, above, vs200Str: vs200 != null ? pct(vs200) : '—', value: d ? usd(d.price) : '—' };
  });

  const total = cardSyms.length;
  const gStatus = bull >= 6 ? 'bullish' : bull >= 4 ? 'neutral' : 'bearish';

  const rows = cardDetails.map(({ sym, label, region, above, vs200Str, value }) => {
    const condition = sym === 'ACWI'
      ? (above ? `Bull Market Intact (${vs200Str}) — Stay Invested`  : `Bear Market Signal (${vs200Str}) — Raise Cash`)
      : sym === 'EEM'
      ? (above ? `EM Risk-On (${vs200Str}) — Add EM Exposure`        : `EM Risk-Off (${vs200Str}) — Reduce EM`)
      : (above ? `Uptrend (${vs200Str}) — Overweight`                : `Downtrend (${vs200Str}) — Underweight`);
    return { label: region, indicator: `${label} (${sym})`, value, condition, status: above ? 'bullish' : 'bearish' };
  });

  // ── Country deep-dive details ──────────────────────────────────────────────
  const details = countrySyms.map(({ sym, label, group }) => {
    const d = q[sym];
    const above = !!(d?.price && d?.sma200 && d.price > d.sma200);
    const vs200 = d?.vs200;
    return { group, label, sym, value: d ? usd(d.price) : '—', vs200: vs200 != null ? pct(vs200) : '—', above };
  });

  // ── Note ──────────────────────────────────────────────────────────────────
  const acwi = cardDetails.find(d => d.sym === 'ACWI');
  const flowNote = (bull >= 6
    ? `${bull}/${total} regional indexes above 200d — synchronized global expansion; broad risk-on.`
    : bull >= 4
    ? `${bull}/${total} regional indexes above 200d — partial expansion; favour the strongest regions.`
    : `${bull}/${total} regional indexes above 200d — broad global weakness; defensive positioning warranted.`)
    + (acwi ? ` ACWI ${acwi.above ? 'above' : 'below'} 200d (${acwi.vs200Str}).` : '');

  return { id: 'globalflows', number: 7, title: 'Global Flows', subtitle: 'The Tide', status: gStatus, rows, details, hideIndicator: true, note: flowNote };
}

function buildSectors(q) {
  // Full 11-sector GICS universe (SPDR ETFs)
  const SECTOR_META = {
    XLK:  { name: 'Technology',            type: 'cyclical'  },
    XLY:  { name: 'Consumer Disc.',        type: 'cyclical'  },
    XLC:  { name: 'Comm. Services',        type: 'cyclical'  },
    XLI:  { name: 'Industrials',           type: 'cyclical'  },
    XLF:  { name: 'Financials',            type: 'cyclical'  },
    XLE:  { name: 'Energy',                type: 'cyclical'  },
    XLB:  { name: 'Materials',             type: 'cyclical'  },
    XLV:  { name: 'Health Care',           type: 'defensive' },
    XLP:  { name: 'Consumer Staples',      type: 'defensive' },
    XLU:  { name: 'Utilities',             type: 'defensive' },
    XLRE: { name: 'Real Estate',           type: 'defensive' },
  };

  const spy   = q['SPY'];
  const ret20 = s => s?.price20d ? (s.price / s.price20d - 1) * 100 : s?.changePct ?? null;
  const spy20 = ret20(spy);

  const allSectors = Object.entries(SECTOR_META).map(([sym, meta]) => {
    const d = q[sym];
    if (!d || !spy) return null;
    const relPerf = (ret20(d) ?? 0) - (spy20 ?? 0);
    const abv200  = !!(d.price && d.sma200 && d.price > d.sma200);
    let condition, status;
    if (meta.type === 'cyclical') {
      if (abv200 && relPerf > 0) {
        condition = `Leader (${pct(relPerf, 1)} vs SPY) — Overweight`;
        status    = 'bullish';
      } else if (abv200) {
        condition = `In Trend, Lagging (${pct(relPerf, 1)} vs SPY) — Hold`;
        status    = 'neutral';
      } else if (relPerf > 0) {
        condition = `Below 200d, Outpacing SPY (${pct(relPerf, 1)}) — Reduce`;
        status    = 'bearish';
      } else {
        condition = `Trend Broken (${pct(relPerf, 1)} vs SPY) — Underweight`;
        status    = 'bearish';
      }
    } else {
      if (abv200 && relPerf > 0) {
        condition = `Safe Haven Bid (${pct(relPerf, 1)} vs SPY) — Risk-Off Signal`;
        status    = 'bearish';
      } else if (abv200) {
        condition = `Quiet Defensive (${pct(relPerf, 1)} vs SPY) — Risk-On Lean`;
        status    = 'neutral';
      } else {
        condition = `No Safe Haven Bid (${pct(relPerf, 1)} vs SPY) — Risk-On`;
        status    = 'bullish';
      }
    }
    return { sym, ...meta, abv200, relPerf, condition, status, value: usd(d.price) };
  }).filter(Boolean);

  const cycRows  = allSectors.filter(r => r.type === 'cyclical');
  const defRows  = allSectors.filter(r => r.type === 'defensive');
  const cycBull  = cycRows.filter(r => r.abv200).length;
  const defBull  = defRows.filter(r => r.abv200).length;
  const cycRatio = cycRows.length ? cycBull / cycRows.length : 0;
  const defRatio = defRows.length ? defBull / defRows.length : 0;
  const offenseLeading = cycBull > defBull;
  const sectStatus = cycRatio > defRatio ? 'bullish' : cycRatio < defRatio ? 'bearish' : 'neutral';

  // Top 3 leaders + bottom 3 laggards, best→worst order, no duplicates
  const sortedAll = [...allSectors].sort((a, b) => b.relPerf - a.relPerf);
  const top3   = sortedAll.slice(0, 3);
  const bot3   = sortedAll.slice(-3);
  const seen   = new Set();
  const curated = [...top3, ...bot3].filter(r => r && !seen.has(r.sym) && seen.add(r.sym));

  const rows = curated.map(r => ({
    label: r.name,
    indicator: r.sym,
    value: r.value,
    condition: r.condition,
    status: r.status,
  }));

  const sectNote = offenseLeading
    ? `${cycBull}/${cycRows.length} cyclicals above 200d — offense leading; growth-oriented positioning supported.`
    : `Defensives leading cyclicals (${defBull}/${defRows.length} defensive above 200d) — rotation to safety underway; reduce cyclical exposure.`;

  return { id: 'sectors', number: 8, title: 'Sectors', subtitle: 'The Rotation', status: sectStatus, rows, hideIndicator: true, note: sectNote };
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
  const copper = q['HG=F'], gold = q['GLD'];
  const copperAbove = copper?.price && copper?.sma200 && copper.price > copper.sma200;
  const goldAbove   = gold?.price   && gold?.sma200   && gold.price   > gold.sma200;
  const commNote = `${bull}/${comSyms.length} commodities above 200d SMA.`
    + (copper ? (copperAbove ? ' Copper above 200d — industrial growth confirmed.' : ' Copper below 200d — growth warning.') : '')
    + (copperAbove === false && goldAbove ? ' Gold up, copper down — safe haven demand with growth caution.' : '');
  return { id: 'commodities', number: 9, title: 'Commodities', subtitle: 'The Growth Engine', status, rows, hideIndicator: true,
    summary: `${bull}/${comSyms.length} commodities above 200d SMA`, note: commNote };
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
  const equityNote = `${bull}/${total} watchlist names above both 50d & 200d. `
    + (bull >= 7 ? 'Strong momentum — execution environment favourable.'
    : bull >= 5 ? 'Mixed signals — be selective; focus on confirmed breakouts above both MAs.'
    : 'Broad weakness — wait for MA recapture before adding positions.');
  return { id: 'equities', number: 10, title: 'Equities', subtitle: 'The Execution Layer', status, rows, hideIndicator: true,
    summary: `${bull}/${total} above both 50d & 200d SMA`, note: equityNote };
}

function buildCredit(q) {
  const hyg = q['HYG'];
  const lqd = q['LQD'];
  const emb = q['EMB'];

  const hygBull = hyg && hyg.price && hyg.sma200 ? hyg.price > hyg.sma200 : null;
  const lqdBull = lqd && lqd.price && lqd.sma200 ? lqd.price > lqd.sma200 : null;
  const embBull = emb && emb.price && emb.sma200 ? emb.price > emb.sma200 : null;

  // Compare vs200 distance: HY closer to/above 200d than IG = tightening
  // Avoids duration-noise from daily changePct (LQD has ~2× HYG's duration)
  const spreadTightening = hyg?.vs200 != null && lqd?.vs200 != null
    ? hyg.vs200 > lqd.vs200
    : hyg && lqd ? hyg.changePct > lqd.changePct : null;

  const rows = [
    {
      label: 'Risk Appetite',
      indicator: 'HYG — High Yield Corp Bond ETF',
      value: hyg
        ? (hyg.vs200 != null ? `${usd(hyg.price)}<br>vs200&nbsp;${pct(hyg.vs200)}` : usd(hyg.price))
        : '—',
      condition: hygBull == null ? '—' : hygBull ? 'Above 200d — Appetite Healthy' : 'Below 200d — Risk Signal',
      status: hygBull == null ? 'neutral' : hygBull ? 'bullish' : 'bearish',
    },
    {
      label: 'Spread Signal',
      indicator: 'HYG vs LQD — HY vs IG (200d basis)',
      value: hyg?.vs200 != null && lqd?.vs200 != null
        ? `HYG&nbsp;${pct(hyg.vs200)}<br>LQD&nbsp;${pct(lqd.vs200)}`
        : '—',
      condition: spreadTightening == null ? '—' : spreadTightening ? 'HY Outperforming IG — Rate-Driven' : 'IG Outperforming HY — Credit-Driven',
      status: spreadTightening == null ? 'neutral' : spreadTightening ? 'bullish' : 'bearish',
    },
    {
      label: 'IG Demand',
      indicator: 'LQD — Investment Grade Bond ETF',
      value: lqd
        ? (lqd.vs200 != null ? `${usd(lqd.price)}<br>vs200&nbsp;${pct(lqd.vs200)}` : usd(lqd.price))
        : '—',
      condition: lqdBull == null ? '—' : lqdBull ? 'Above 200d — IG Demand Firm' : 'Below 200d — IG Demand Weak',
      status: lqdBull == null ? 'neutral' : lqdBull ? 'bullish' : 'bearish',
    },
    {
      label: 'Global Credit',
      indicator: 'EMB — EM USD Bond ETF (JP Morgan)',
      value: emb
        ? (emb.vs200 != null ? `${usd(emb.price)}<br>vs200&nbsp;${pct(emb.vs200)}` : usd(emb.price))
        : '—',
      condition: embBull == null ? '—' : embBull
        ? 'Above 200d — EM Credit Stable'
        : emb.vs200 >= -2
          ? 'Below 200d — Monitor EM Risk'
          : emb.vs200 >= -5
            ? 'Below 200d — Stress Spreading'
            : 'Below 200d — Contagion Risk',
      status: embBull == null ? 'neutral' : embBull ? 'bullish' : 'bearish',
    },
  ];

  const bull = rows.filter(r => r.status === 'bullish').length;
  const status = bull >= 3 ? 'bullish' : bull >= 2 ? 'neutral' : 'bearish';
  const creditNote = (() => {
    const hygStr = hygBull == null ? 'Credit data unavailable.'
      : hygBull
      ? 'HYG above 200d — no leading credit stress signal.'
      : 'HYG below 200d — leading stress signal active; historical lead of 4–6 weeks before equity drawdowns.';
    const spreadStr = !hygBull && spreadTightening != null
      ? (spreadTightening
        ? ' Spread is rate-driven (HY outperforming IG) — credit quality intact, rate sensitivity dominant.'
        : ' Spread is credit-driven (IG outperforming HY) — true credit deterioration; more severe outlook.')
      : '';
    const embStr = !embBull && emb?.vs200 != null && emb.vs200 < -2
      ? ' EMB below 200d — EM credit stress, watch for contagion beyond US markets.'
      : '';
    return hygStr + spreadStr + embStr;
  })();
  return {
    id: 'credit', number: 6, title: 'Credit', subtitle: 'The Risk Canary', status, rows, hideIndicator: true,
    note: creditNote,
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
  const [d1, shiller, buffett, forwardPe, japanPe, breadthData] = await Promise.all([
    db ? loadFromD1(db) : Promise.resolve({}),
    db ? loadShillerLatest(db) : Promise.resolve(null),
    db ? loadBuffettLatest(db) : Promise.resolve(null),
    db ? loadForwardPeLatest(db) : Promise.resolve(null),
    db ? loadJapanPeLatest(db) : Promise.resolve(null),
    db ? loadBreadthLatest(db) : Promise.resolve(null),
  ]);
  const today = new Date().toISOString().slice(0, 10);
  // Treat D1 data as stale only if >3 calendar days old — handles weekends + pre-seeder Monday
  const staleDate = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const missing = ALL_SYMBOLS.filter(s => !d1[s] || d1[s].latestDate < staleDate);

  const q = { ...d1 };
  if (missing.length > 0) {
    const batches = [];
    for (let i = 0; i < missing.length; i += 20)
      batches.push(missing.slice(i, i + 20));
    for (const batch of batches) {
      const batchData = await fetchAll(batch);
      for (const [sym, yfData] of Object.entries(batchData)) {
        const prior = d1[sym];
        if (prior?.sma200) {
          // Blend: live price from YF, SMA anchor from D1, recompute vs
          q[sym] = {
            ...prior,
            price:    yfData.price,
            changePct: yfData.changePct,
            price20d: yfData.price20d ?? prior.price20d,
            vs50:  prior.sma50  ? ((yfData.price - prior.sma50)  / prior.sma50)  * 100 : yfData.vs50,
            vs200: prior.sma200 ? ((yfData.price - prior.sma200) / prior.sma200) * 100 : yfData.vs200,
          };
        } else {
          q[sym] = yfData;
        }
      }
    }
  }

  const cards = [
    buildRegime(q),
    buildLeadership(q),
    buildBreadth(q, breadthData),
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
