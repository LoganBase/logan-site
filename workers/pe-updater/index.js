/**
 * Market Hub — PE Updater Worker
 *
 * Runs nightly at 02:00 UTC via Cloudflare Cron Trigger.
 * Fetches current P/E ratios from Yahoo Finance and upserts into D1.
 *
 * Sources:
 *   Japan P/E  — ^N225 trailingPE (Yahoo Finance v10)
 *   Forward P/E — SPY forwardPE   (Yahoo Finance v10, analyst consensus)
 *
 * Manual trigger (for testing):
 *   GET https://market-hub-pe-updater.<your-subdomain>.workers.dev/run
 *   Header: Authorization: Bearer <CRON_SECRET>
 *
 * Setup:
 *   Set CRON_SECRET via: npx wrangler secret put CRON_SECRET
 */

const YF_V10 = 'https://query1.finance.yahoo.com/v10/finance/quoteSummary';
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
  'Accept':     'application/json',
  'Referer':    'https://finance.yahoo.com/',
};

async function fetchPe(symbol, field) {
  try {
    const encoded = encodeURIComponent(symbol);
    const res = await fetch(`${YF_V10}/${encoded}?modules=summaryDetail`, { headers: HEADERS });
    if (!res.ok) return null;
    const data = await res.json();
    const val  = data?.quoteSummary?.result?.[0]?.summaryDetail?.[field]?.raw;
    return val != null ? Math.round(val * 10) / 10 : null;
  } catch {
    return null;
  }
}

async function runUpdate(env) {
  const today = new Date().toISOString().slice(0, 10);

  const [japanPe, forwardPe] = await Promise.all([
    fetchPe('^N225', 'trailingPE'),
    fetchPe('SPY',   'forwardPE'),
  ]);

  const results = { date: today, japanPe, forwardPe, errors: [] };

  if (japanPe != null) {
    await env.DB.prepare('INSERT OR REPLACE INTO japan_pe_data (date, pe) VALUES (?, ?)')
      .bind(today, japanPe).run();
  } else {
    results.errors.push('japan_pe: no value returned from Yahoo Finance');
  }

  if (forwardPe != null) {
    await env.DB.prepare('INSERT OR REPLACE INTO forward_pe_data (date, pe) VALUES (?, ?)')
      .bind(today, forwardPe).run();
  } else {
    results.errors.push('forward_pe: no value returned from Yahoo Finance');
  }

  console.log(`PE update: Japan=${japanPe}×, Forward=${forwardPe}×, date=${today}`);
  return results;
}

export default {
  // Cron trigger — fires nightly at 02:00 UTC
  async scheduled(event, env, ctx) {
    ctx.waitUntil(runUpdate(env));
  },

  // HTTP trigger — for manual testing
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname !== '/run') {
      return new Response('PE Updater Worker — POST /run to trigger manually', { status: 200 });
    }

    // Require bearer token to prevent abuse
    const secret = env.CRON_SECRET;
    const auth   = request.headers.get('Authorization') ?? '';
    if (secret && auth !== `Bearer ${secret}`) {
      return new Response('Unauthorized', { status: 401 });
    }

    const results = await runUpdate(env);
    return new Response(JSON.stringify(results, null, 2), {
      headers: { 'Content-Type': 'application/json' },
    });
  },
};
