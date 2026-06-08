/**
 * Market Hub — TradingView Webhook Receiver
 *
 * Receives alert POSTs from TradingView and upserts values into D1.
 *
 * Supported tickers (set in TradingView alert message body):
 *   MMTH  — NYSE % stocks above 200-day SMA  → market_breadth.pct_above_200d
 *   MMFI  — NYSE % stocks above 50-day SMA   → market_breadth.pct_above_50d
 *   CAPE  — Shiller CAPE ratio (monthly)      → shiller_data.cape
 *
 * TradingView alert message body (JSON):
 *   {"ticker": "MMTH", "value": {{close}}, "time": {{time}}}
 *
 * Webhook URL format:
 *   https://market-hub-tv-webhook.<subdomain>.workers.dev/webhook?secret=<TV_SECRET>
 *
 * Security: secret is matched against TV_SECRET environment variable.
 */

function parseDate(time) {
  // TradingView {{time}} returns Unix timestamp in seconds
  const n = Number(time);
  if (!isNaN(n) && n > 0) {
    return new Date(n * 1000).toISOString().slice(0, 10);
  }
  // Fallback: ISO string
  return new Date(time).toISOString().slice(0, 10);
}

function toMonthStart(date) {
  // Normalise to YYYY-MM-01 — TradingView monthly bars open on the first
  // trading day of the month, which may not be the 1st calendar day.
  return date.slice(0, 7) + '-01';
}


export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Health check
    if (request.method === 'GET') {
      return new Response('TradingView Webhook Receiver — POST /webhook?secret=<token>', { status: 200 });
    }

    if (url.pathname !== '/webhook' || request.method !== 'POST') {
      return new Response('Not Found', { status: 404 });
    }

    // Validate secret
    const secret = url.searchParams.get('secret') ?? '';
    if (env.TV_SECRET && secret !== env.TV_SECRET) {
      console.warn('[tv-webhook] Rejected request — bad secret');
      return new Response('Unauthorized', { status: 401 });
    }

    // Parse body
    let body;
    try {
      body = await request.json();
    } catch {
      return new Response('Bad Request — expected JSON body', { status: 400 });
    }

    const ticker = String(body.ticker ?? '').toUpperCase();
    const value  = parseFloat(body.value);
    const date   = body.time != null ? parseDate(body.time) : null;

    if (!date || isNaN(value) || value <= 0) {
      console.error('[tv-webhook] Invalid payload:', JSON.stringify(body));
      return new Response('Bad Request — invalid ticker, value, or time', { status: 400 });
    }

    // Ticker-specific validation
    if ((ticker === 'MMTH' || ticker === 'MMFI') && value > 100) {
      return new Response('Bad Request — breadth value must be 0-100', { status: 400 });
    }

    console.log(`[tv-webhook] ${date} ${ticker}=${value}`);

    try {
      if (ticker === 'MMTH') {
        await env.DB.prepare(`
          INSERT INTO market_breadth (date, pct_above_200d, pct_above_50d)
          VALUES (?, ?, NULL)
          ON CONFLICT(date) DO UPDATE SET pct_above_200d = excluded.pct_above_200d
        `).bind(date, Math.round(value * 100) / 100).run();

      } else if (ticker === 'MMFI') {
        await env.DB.prepare(`
          INSERT INTO market_breadth (date, pct_above_200d, pct_above_50d)
          VALUES (?, NULL, ?)
          ON CONFLICT(date) DO UPDATE SET pct_above_50d = excluded.pct_above_50d
        `).bind(date, Math.round(value * 100) / 100).run();

      } else if (ticker === 'CAPE') {
        const monthDate = toMonthStart(date);
        await env.DB.prepare(`
          INSERT INTO shiller_data (date, cape)
          VALUES (?, ?)
          ON CONFLICT(date) DO UPDATE SET cape = excluded.cape
        `).bind(monthDate, Math.round(value * 100) / 100).run();

      } else {
        return new Response(`Unknown ticker: ${ticker}`, { status: 400 });
      }
    } catch (err) {
      console.error('[tv-webhook] D1 error:', err.message);
      return new Response('Internal Error', { status: 500 });
    }

    const storedDate = ticker === 'CAPE' ? toMonthStart(date) : date;
    return new Response(JSON.stringify({ ok: true, date: storedDate, ticker, value }), {
      headers: { 'Content-Type': 'application/json' },
    });
  },
};
