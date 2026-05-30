/**
 * Market Hub — Historical Data API
 * GET /api/history?symbol=SPY&range=5y
 *
 * Returns daily closes, SMA200, vs200 extension, and computed analytics:
 *   - Percentile rank of current extension vs full history
 *   - Consecutive days in current extension zone
 *   - 10-day ROC of the extension itself (velocity of the move)
 */

const YF = 'https://query1.finance.yahoo.com/v8/finance/chart';
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
  'Accept': 'application/json',
  'Referer': 'https://finance.yahoo.com/',
};

const RANGE_MAP = {
  '10y': { range: '10y', interval: '1d' },
  '5y':  { range: '5y',  interval: '1d' },
  '1y':  { range: '1y',  interval: '1d' },
  '6mo': { range: '6mo', interval: '1d' },
  '3mo': { range: '3mo', interval: '1d' },
  '1mo': { range: '1mo', interval: '1d' },
  '1wk': { range: '5d',  interval: '1d' },
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

  try {
    const res = await fetch(
      `${YF}/${encodeURIComponent(symbol)}?interval=${cfg.interval}&range=${cfg.range}`,
      { headers: HEADERS }
    );
    if (!res.ok) {
      return new Response(JSON.stringify({ error: `Yahoo Finance returned ${res.status}` }), {
        status: 502, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }

    const data   = await res.json();
    const result = data?.chart?.result?.[0];
    if (!result) {
      return new Response(JSON.stringify({ error: 'No data returned for symbol' }), {
        status: 404, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }

    const timestamps = result.timestamp || [];
    const rawCloses  = result.indicators?.quote?.[0]?.close || [];

    // Build clean date+close pairs
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

    // SMA200 — null until 200 data points available
    const sma200 = closes.map((_, i) => {
      if (i < 199) return null;
      return closes.slice(i - 199, i + 1).reduce((a, b) => a + b, 0) / 200;
    });

    // % distance from 200d SMA
    const vs200 = closes.map((c, i) => {
      if (sma200[i] == null) return null;
      return ((c - sma200[i]) / sma200[i]) * 100;
    });

    // 10-day ROC of the extension — how fast is the stretch accelerating/decelerating
    const roc10 = vs200.map((v, i) => {
      if (v == null || i < 10 || vs200[i - 10] == null) return null;
      return v - vs200[i - 10];
    });

    // Percentile rank: what % of historical days had extension <= current
    const currentVs200  = vs200[n - 1];
    const currentRoc10  = roc10[n - 1];
    const validVs200    = vs200.filter(v => v != null);
    const percentile    = currentVs200 != null && validVs200.length > 0
      ? (validVs200.filter(v => v <= currentVs200).length / validVs200.length) * 100
      : null;

    // Consecutive days in current zone
    let daysInZone = 0;
    if (currentVs200 != null) {
      const currentZone = zoneOf(currentVs200);
      for (let i = n - 1; i >= 0; i--) {
        if (vs200[i] == null || zoneOf(vs200[i]) !== currentZone) break;
        daysInZone++;
      }
    }

    return new Response(JSON.stringify({
      symbol, range,
      dates, closes, sma200, vs200, roc10,
      summary: {
        currentClose:  closes[n - 1],
        currentSma200: sma200[n - 1],
        currentVs200,
        currentRoc10,
        percentile,
        daysInZone,
        zone: zoneOf(currentVs200),
      },
    }), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }
}
