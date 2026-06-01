/**
 * Market Hub — Historical Data API
 * GET /api/history?symbol=SPY&range=5y
 *
 * Returns daily closes, SMA200, vs200 extension, and computed analytics:
 *   - Percentile rank of current extension vs full history
 *   - Consecutive days in current extension zone
 *   - 10-day ROC of the extension itself (velocity of the move)
 *
 * Primary source: Cloudflare D1 (daily_prices JOIN indicators).
 * Fallback: Yahoo Finance v8 HTTP API (when D1 binding absent or empty).
 */

const YF = 'https://query1.finance.yahoo.com/v8/finance/chart';
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
  'Accept': 'application/json',
  'Referer': 'https://finance.yahoo.com/',
};

const RANGE_MAP = {
  '10y': { range: '10y', interval: '1d', days: 3650 },
  '5y':  { range: '5y',  interval: '1d', days: 1825 },
  '1y':  { range: '1y',  interval: '1d', days: 365  },
  '6mo': { range: '6mo', interval: '1d', days: 183  },
  '3mo': { range: '3mo', interval: '1d', days: 92   },
  '1mo': { range: '1mo', interval: '1d', days: 31   },
  '1wk': { range: '5d',  interval: '1d', days: 7    },
};

function zoneOf(v) {
  if (v == null) return null;
  if (v > 15)  return 'extreme-bull';
  if (v > 10)  return 'extended-bull';
  if (v > 5)   return 'normal-bull';
  if (v > 0)   return 'mild-bull';
  if (v > -5)  return 'mild-bear';
  if (v > -10) return 'normal-bear';
  return 'extended-bear';
}

// ── D1 SOURCE ─────────────────────────────────────────────────────────────────
function startDateFor(days) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

async function fromD1(db, symbol, days) {
  const startDate = startDateFor(days);
  const { results } = await db.prepare(
    `SELECT p.date, p.close, i.sma200, i.vs200_pct, i.roc10, i.rsi14, i.percentile
     FROM daily_prices p
     LEFT JOIN indicators i ON p.symbol = i.symbol AND p.date = i.date
     WHERE p.symbol = ? AND p.date >= ?
     ORDER BY p.date ASC`
  ).bind(symbol, startDate).all();
  return results || [];
}

function buildFromD1Rows(symbol, range, rows) {
  const n      = rows.length;
  const dates  = rows.map(r => r.date);
  const closes = rows.map(r => r.close);
  const sma200 = rows.map(r => r.sma200    ?? null);
  const vs200  = rows.map(r => r.vs200_pct ?? null);
  const roc10  = rows.map(r => r.roc10     ?? null);
  const rsi14  = rows.map(r => r.rsi14     ?? null);

  const currentVs200 = vs200[n - 1];
  const currentRoc10 = roc10[n - 1];
  const percentile   = rows[n - 1]?.percentile ?? null;

  let daysInZone = 0;
  if (currentVs200 != null) {
    const zone = zoneOf(currentVs200);
    for (let i = n - 1; i >= 0; i--) {
      if (vs200[i] == null || zoneOf(vs200[i]) !== zone) break;
      daysInZone++;
    }
  }

  return {
    symbol, range, dates, closes, sma200, vs200, roc10, rsi14,
    summary: {
      currentClose:  closes[n - 1],
      currentSma200: sma200[n - 1],
      currentVs200,
      currentRoc10,
      percentile,
      daysInZone,
      zone: zoneOf(currentVs200),
    },
  };
}

// ── MATH ──────────────────────────────────────────────────────────────────────
function calcRsi(closes, period = 14) {
  const n = closes.length;
  const out = new Array(n).fill(null);
  if (n < period + 1) return out;
  let ag = 0, al = 0;
  for (let i = 1; i <= period; i++) {
    const d = closes[i] - closes[i - 1];
    if (d > 0) ag += d; else al -= d;
  }
  ag /= period; al /= period;
  out[period] = al === 0 ? 100 : 100 - 100 / (1 + ag / al);
  for (let i = period + 1; i < n; i++) {
    const d = closes[i] - closes[i - 1];
    ag = (ag * (period - 1) + Math.max(d, 0))  / period;
    al = (al * (period - 1) + Math.max(-d, 0)) / period;
    out[i] = al === 0 ? 100 : 100 - 100 / (1 + ag / al);
  }
  return out;
}

// ── YAHOO FINANCE FALLBACK ────────────────────────────────────────────────────
async function fromYahoo(symbol, range, cfg) {
  const res = await fetch(
    `${YF}/${encodeURIComponent(symbol)}?interval=${cfg.interval}&range=${cfg.range}`,
    { headers: HEADERS }
  );
  if (!res.ok) throw new Error(`Yahoo Finance returned ${res.status}`);

  const data   = await res.json();
  const result = data?.chart?.result?.[0];
  if (!result) throw new Error('No data returned for symbol');

  const timestamps = result.timestamp || [];
  const rawCloses  = result.indicators?.quote?.[0]?.close || [];

  const points = [];
  for (let i = 0; i < timestamps.length; i++) {
    if (rawCloses[i] != null) {
      points.push({
        date:  new Date(timestamps[i] * 1000).toISOString().slice(0, 10),
        close: rawCloses[i],
      });
    }
  }

  const n      = points.length;
  const closes = points.map(p => p.close);
  const dates  = points.map(p => p.date);

  const sma200 = closes.map((_, i) => {
    if (i < 199) return null;
    return closes.slice(i - 199, i + 1).reduce((a, b) => a + b, 0) / 200;
  });
  const vs200 = closes.map((c, i) => {
    if (sma200[i] == null) return null;
    return ((c - sma200[i]) / sma200[i]) * 100;
  });
  const roc10 = vs200.map((v, i) => {
    if (v == null || i < 10 || vs200[i - 10] == null) return null;
    return v - vs200[i - 10];
  });

  const currentVs200 = vs200[n - 1];
  const currentRoc10 = roc10[n - 1];
  const validVs200   = vs200.filter(v => v != null);
  const percentile   = currentVs200 != null && validVs200.length > 0
    ? (validVs200.filter(v => v <= currentVs200).length / validVs200.length) * 100
    : null;

  let daysInZone = 0;
  if (currentVs200 != null) {
    const zone = zoneOf(currentVs200);
    for (let i = n - 1; i >= 0; i--) {
      if (vs200[i] == null || zoneOf(vs200[i]) !== zone) break;
      daysInZone++;
    }
  }

  const rsi14 = calcRsi(closes);

  return {
    symbol, range, dates, closes, sma200, vs200, roc10, rsi14,
    summary: {
      currentClose:  closes[n - 1],
      currentSma200: sma200[n - 1],
      currentVs200,
      currentRoc10,
      percentile,
      daysInZone,
      zone: zoneOf(currentVs200),
    },
  };
}

// ── HANDLER ───────────────────────────────────────────────────────────────────
export async function onRequest(context) {
  if (context.request.method === 'OPTIONS') {
    return new Response(null, {
      headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET' },
    });
  }

  const url    = new URL(context.request.url);
  const symbol = url.searchParams.get('symbol') || 'SPY';
  const range  = url.searchParams.get('range')  || '5y';
  const cfg    = RANGE_MAP[range] || RANGE_MAP['5y'];
  const db     = context.env.DB;

  try {
    if (db) {
      const rows = await fromD1(db, symbol, cfg.days);
      if (rows.length >= 5) {
        return new Response(JSON.stringify(buildFromD1Rows(symbol, range, rows)), {
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Cache-Control': 'public, max-age=300',
          },
        });
      }
    }

    const payload = await fromYahoo(symbol, range, cfg);
    return new Response(JSON.stringify(payload), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=300',
      },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }
}
