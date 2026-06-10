/**
 * Market Hub — Kalshi Near-Term Events API
 * GET /api/kalshi
 *
 * Fetches the next open FOMC and CPI markets from Kalshi's public API.
 * Derives crowd consensus (50th-percentile threshold) for each event.
 * Unauthenticated read-only.
 *
 * Series:
 *   KXFED — Fed funds rate upper bound after each FOMC meeting
 *   KXCPI — CPI MoM threshold markets
 */

const BASE    = 'https://api.elections.kalshi.com/trade-api/v2';
const HEADERS = { 'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0 (compatible; MarketHub/1.0)' };

// Kalshi prices can be 0–1 (decimal) or 0–100 (cents) — normalise to 0–1
function norm(p) {
  const n = parseFloat(p);
  return isNaN(n) ? null : n > 1 ? n / 100 : n;
}

// Extract numeric strike from ticker, e.g. KXFED-26JUN-T3.75 → 3.75
function strike(ticker) {
  const m = ticker.match(/T(-?\d+\.?\d*)$/);
  return m ? parseFloat(m[1]) : null;
}

// Derive short month label from event ticker, e.g. KXCPI-26MAY → "May"
function eventMonth(ticker) {
  const m = ticker.match(/-(\d{2})([A-Z]{3})$/);
  if (!m) return '';
  const map = { JAN:'Jan',FEB:'Feb',MAR:'Mar',APR:'Apr',MAY:'May',JUN:'Jun',
                JUL:'Jul',AUG:'Aug',SEP:'Sep',OCT:'Oct',NOV:'Nov',DEC:'Dec' };
  return map[m[2]] || m[2];
}

function fmtDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase();
}

// Fetch the next open event's markets for a series (soonest close_time)
async function fetchNext(seriesTicker) {
  try {
    const res = await fetch(`${BASE}/markets?series_ticker=${seriesTicker}&status=open&limit=100`, { headers: HEADERS });
    if (!res.ok) return [];
    const { markets = [] } = await res.json();
    if (!markets.length) return [];
    markets.sort((a, b) => new Date(a.close_time) - new Date(b.close_time));
    const evt = markets[0].event_ticker;
    return markets.filter(m => m.event_ticker === evt);
  } catch { return []; }
}

// Fed: find highest strike where P(above) ≥ 0.50 → implied rate = that + 0.25
function parseFed(markets) {
  const rows = markets
    .map(m => ({ s: strike(m.ticker), p: norm(m.last_price_dollars ?? (parseFloat(m.yes_bid_dollars) + parseFloat(m.yes_ask_dollars)) / 2), t: m.close_time, evt: m.event_ticker }))
    .filter(r => r.s !== null && r.p !== null)
    .sort((a, b) => a.s - b.s);

  if (!rows.length) return null;

  const floor = [...rows].reverse().find(r => r.p >= 0.50);
  if (!floor) return null;

  const implied    = floor.s + 0.25;
  const ceilingRow = rows.find(r => r.s === implied);
  const confidence = ceilingRow
    ? Math.round((1 - ceilingRow.p) * 100)
    : Math.round(floor.p * 100);

  return {
    label:      'FOMC Rate',
    date:       fmtDate(rows[0].t),
    closeTime:  rows[0].t,
    consensus:  `${implied.toFixed(2)}%`,
    action:     'Hold',
    unit:       '',
    confidence: Math.min(confidence, 99),
    type:       'fomc',
  };
}

// CPI: highest strike where P(above) ≥ 0.50 = crowd's median estimate
function parseCPI(markets) {
  const month = markets.length ? eventMonth(markets[0].event_ticker) : '';
  const rows = markets
    .map(m => ({ s: strike(m.ticker), p: norm(m.last_price_dollars ?? (parseFloat(m.yes_bid_dollars) + parseFloat(m.yes_ask_dollars)) / 2), t: m.close_time }))
    .filter(r => r.s !== null && r.p !== null)
    .sort((a, b) => b.s - a.s);

  if (!rows.length) return null;

  const median = rows.find(r => r.p >= 0.50);
  if (!median) return null;

  const sign = median.s > 0 ? '+' : '';
  return {
    label:      `${month} CPI`,
    date:       fmtDate(rows[0].t),
    closeTime:  rows[0].t,
    consensus:  `~${sign}${median.s.toFixed(1)}%`,
    action:     '',
    unit:       'MoM',
    confidence: Math.round(median.p * 100),
    type:       'cpi',
  };
}

export async function onRequest(context) {
  if (context.request.method === 'OPTIONS') {
    return new Response(null, { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET' } });
  }

  try {
    const [fedMarkets, cpiMarkets] = await Promise.all([
      fetchNext('KXFED'),
      fetchNext('KXCPI'),
    ]);

    const events = [parseCPI(cpiMarkets), parseFed(fedMarkets)]
      .filter(Boolean)
      .sort((a, b) => new Date(a.closeTime) - new Date(b.closeTime));

    return new Response(JSON.stringify({ events, timestamp: new Date().toISOString(), source: 'kalshi' }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'public, max-age=300' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ events: [], error: err.message, source: 'kalshi' }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'public, max-age=60' },
    });
  }
}
