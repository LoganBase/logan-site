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

  // Row 1: Market Status
  const isBull = spy.price > spy.sma200;
  const r1 = {
    label: 'Market Status',
    indicator: 'SPY vs 200d SMA',
    value: usd(spy.price),
    condition: isBull ? 'Secular Bull' : 'Secular Bear',
    status: isBull ? 'bullish' : 'bearish',
  };

  // Row 2: Market Stretch
  const v200 = spy.vs200;
  let stretchStatus, stretchCondition;
  if (v200 == null)          { stretchStatus = 'neutral'; stretchCondition = '—'; }
  else if (v200 > 12)        { stretchStatus = 'bearish'; stretchCondition = 'Bullish Overextended'; }
  else if (v200 >= 0)        { stretchStatus = 'bullish'; stretchCondition = 'Normal Bull Market'; }
  else if (v200 >= -10)      { stretchStatus = 'neutral'; stretchCondition = 'Bearish Regime'; }
  else                       { stretchStatus = 'neutral'; stretchCondition = 'Bearish Overextended'; }
  const r2 = {
    label: 'Market Stretch',
    indicator: 'Distance from 200d SMA',
    value: pct(v200),
    condition: stretchCondition,
    status: stretchStatus,
  };

  // Row 3: Market Momentum
  const r14 = spy.rsi14;
  let rsiStatus, rsiCondition;
  if (r14 == null)     { rsiStatus = 'neutral'; rsiCondition = '—'; }
  else if (r14 > 70)   { rsiStatus = 'bearish'; rsiCondition = 'Overbought'; }
  else if (r14 > 50)   { rsiStatus = 'bullish'; rsiCondition = 'Bullish Momentum'; }
  else if (r14 > 40)   { rsiStatus = 'neutral'; rsiCondition = 'Neutral / Support'; }
  else if (r14 > 30)   { rsiStatus = 'neutral'; rsiCondition = 'Bearish Momentum'; }
  else                 { rsiStatus = 'neutral'; rsiCondition = 'Oversold'; }
  const r3 = {
    label: 'Market Momentum',
    indicator: 'Relative Strength Index (RSI)',
    value: num(r14),
    condition: rsiCondition,
    status: rsiStatus,
  };

  const rows = [r1, r2, r3];
  // Regime anchor: if Market Status is bearish, card is bearish regardless
  const status = isBull ? cardStatus(rows) : 'bearish';
  return { id: 'regime', number: 1, title: 'Regime', subtitle: 'The Anchor', status, rows };
}

function buildLeadership(q) {
  const spy  = q['SPY'],  rsp  = q['RSP'];
  const qqq  = q['QQQ'],  qqew = q['QQEW'];
  if (!spy || !rsp) return placeholderCard(2, 'Leadership', 'The Quality Check');

  const rspLead  = rsp.changePct > spy.changePct;
  const qqewLead = qqew && qqq ? qqew.changePct > qqq.changePct : null;
  const growthLead = q['IVW'] && q['IVE'] ? q['IVW'].changePct > q['IVE'].changePct : null;

  const rows = [
    {
      label: 'Market Breadth Quality',
      indicator: 'RSP vs SPY (Equal vs Cap-Weight)',
      value: `RSP ${pct(rsp.changePct, 2)} | SPY ${pct(spy.changePct, 2)}`,
      condition: rspLead ? 'Breadth Expanding' : 'Rally Narrowing',
      status: rspLead ? 'bullish' : 'bearish',
    },
    {
      label: 'Tech Breadth Quality',
      indicator: 'QQEW vs QQQ',
      value: qqew && qqq ? `QQEW ${pct(qqew.changePct, 2)} | QQQ ${pct(qqq.changePct, 2)}` : '—',
      condition: qqewLead == null ? '—' : (qqewLead ? 'Tech Broadening' : 'Mega-Cap Driven'),
      status: qqewLead == null ? 'neutral' : (qqewLead ? 'bullish' : 'bearish'),
    },
    {
      label: 'Style Bias',
      indicator: 'Growth (IVW) vs Value (IVE)',
      value: q['IVW'] && q['IVE'] ? `IVW ${pct(q['IVW'].changePct, 2)}` : '—',
      condition: growthLead == null ? '—' : (growthLead ? 'Risk-On Growth' : 'Value Rotation'),
      status: growthLead == null ? 'neutral' : (growthLead ? 'bullish' : 'neutral'),
    },
  ];
  return { id: 'leadership', number: 2, title: 'Leadership', subtitle: 'The Quality Check', status: cardStatus(rows), rows };
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
  return { id: 'breadth', number: 3, title: 'Breadth', subtitle: 'The Early Warning', status: 'neutral', rows };
}

function buildValuations() {
  // Valuations are not available from Yahoo Finance v8 — static/manual values
  const rows = [
    { label: 'Trailing Earnings', indicator: 'S&P 500 Trailing P/E',     value: '~28×', condition: 'Elevated (hist avg ~16×)',  status: 'neutral' },
    { label: 'Forward Earnings',  indicator: 'S&P 500 Forward P/E (NTM)',  value: '~22×', condition: 'Elevated',                 status: 'neutral' },
    { label: 'Cyclical Adj.',     indicator: 'Shiller CAPE (10yr)',         value: '~37×', condition: 'Very High (hist avg ~17×)', status: 'bearish' },
    { label: 'Market Size',       indicator: 'Mkt Cap / GDP (Buffett)',     value: '~195%',condition: 'Extreme — Above 2021 Peak', status: 'bearish' },
    { label: 'International',     indicator: 'Japan Nikkei TTM P/E',        value: '~15×', condition: 'Compressed vs US',          status: 'bullish' },
  ];
  return { id: 'valuations', number: 4, title: 'Valuations', subtitle: 'The Rubber Band', status: 'neutral', rows,
    note: 'Valuations are not a market-timing tool. They turn bearish only when combined with rising rates + earnings deceleration.' };
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
  return { id: 'yield', number: 5, title: 'Yield', subtitle: 'The Cost of Capital', status, rows };
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
  return { id: 'globalflows', number: 6, title: 'Global Flows', subtitle: 'The Tide', status: gStatus, rows, details };
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
  return { id: 'sectors', number: 7, title: 'Sectors', subtitle: 'The Rotation', status: offenseLeading ? 'bullish' : 'neutral', rows };
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
  return { id: 'commodities', number: 8, title: 'Commodities', subtitle: 'The Growth Engine', status, rows,
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
  return { id: 'equities', number: 9, title: 'Equities', subtitle: 'The Execution Layer', status, rows,
    summary: `${bull}/${total} above both 50d & 200d SMA` };
}

function placeholderCard(num, title, subtitle) {
  return { id: title.toLowerCase(), number: num, title, subtitle, status: 'neutral',
    rows: [{ label: '—', indicator: 'Data unavailable', value: '—', condition: '—', status: 'neutral' }] };
}

// ── AGGREGATE SCORE ───────────────────────────────────────────────────────────
function buildAggregate(cards) {
  const counts = { bullish: 0, neutral: 0, bearish: 0 };
  cards.forEach(c => counts[c.status]++);
  const score = counts.bullish;
  const glow  = score >= 7 ? 'green' : score >= 5 ? 'yellow' : 'red';
  const label = score >= 7 ? 'Secular Bull Intact' : score >= 5 ? 'Mixed Signals — Selective' : 'Risk-Off — Reduce Exposure';
  const posture = score >= 7 ? 'Risk-On, Not Complacent' : score >= 5 ? 'Selective, Not Aggressive' : 'Defensive, Raise Cash';
  return { bullish: counts.bullish, neutral: counts.neutral, bearish: counts.bearish,
    score: `${score}/9`, label, posture, glow };
}

// ── HANDLER ───────────────────────────────────────────────────────────────────
export async function onRequest(context) {
  if (context.request.method === 'OPTIONS') {
    return new Response(null, { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET' } });
  }

  // Batch-fetch all symbols (3 batches of ~20)
  const batches = [];
  for (let i = 0; i < ALL_SYMBOLS.length; i += 20)
    batches.push(ALL_SYMBOLS.slice(i, i + 20));

  const q = {};
  for (const batch of batches) {
    const batchData = await fetchAll(batch);
    Object.assign(q, batchData);
  }

  const cards = [
    buildRegime(q),
    buildLeadership(q),
    buildBreadth(q),
    buildValuations(),
    buildYield(q),
    buildGlobalFlows(q),
    buildSectors(q),
    buildCommodities(q),
    buildEquities(q),
  ];

  const body = JSON.stringify({
    timestamp: new Date().toISOString(),
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
