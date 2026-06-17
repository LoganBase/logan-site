/**
 * Market Hub — Data Refresh Worker
 *
 * Fires Mon–Fri at 22:00 UTC (6 PM ET) via Cloudflare Cron Trigger.
 * Calls /api/refresh on the Pages site, which fetches any missing trading
 * days from Yahoo Finance and upserts prices + indicators into D1.
 *
 * Required secrets (set via deploy.py or Cloudflare dashboard):
 *   HUB_TOKEN  — matches the HUB_TOKEN in Cloudflare Pages env vars
 *   SITE_URL   — e.g. "https://www.loganbase.com" (no trailing slash)
 *
 * Manual trigger (for catch-up / testing):
 *   GET https://market-hub-data-refresh.<account>.workers.dev/run
 *   Header: Authorization: Bearer <CRON_SECRET>
 */

// Call /api/refresh?start=N and return parsed JSON, or an error object.
async function callRefresh(siteUrl, hubToken, start) {
  const url = `${siteUrl}/api/refresh?start=${start}`;
  let res;
  try {
    res = await fetch(url, { headers: { 'X-Hub-Token': hubToken } });
  } catch (err) {
    return { error: `network error: ${err.message}`, start };
  }
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    return { error: `HTTP ${res.status}`, body: body.slice(0, 200), start };
  }
  try {
    return await res.json();
  } catch {
    return { error: 'invalid JSON', start };
  }
}

async function runRefresh(env) {
  const hubToken = env.HUB_TOKEN;
  const siteUrl  = (env.SITE_URL || 'https://www.loganbase.com').replace(/\/$/, '');

  if (!hubToken) {
    console.error('HUB_TOKEN not configured — aborting refresh');
    return { error: 'HUB_TOKEN not configured' };
  }

  // Split 70 symbols into two batches of 35 to stay under Cloudflare's
  // 50 subrequest-per-invocation limit (each symbol calls Yahoo Finance).
  console.log(`[data-refresh] batch 1 (symbols 0-34)`);
  const b1 = await callRefresh(siteUrl, hubToken, 0);

  console.log(`[data-refresh] batch 2 (symbols 35-69)`);
  const b2 = await callRefresh(siteUrl, hubToken, 35);

  const totalAdded = (b1.totalAdded ?? 0) + (b2.totalAdded ?? 0);
  const symbols    = [...(b1.symbols ?? []), ...(b2.symbols ?? [])];
  console.log(`[data-refresh] done — ${totalAdded} rows added across ${symbols.length} symbols`);
  return { timestamp: b1.timestamp ?? new Date().toISOString(), totalAdded, symbols, batch1: b1.error, batch2: b2.error };
}

export default {
  // Cron trigger — fires on schedule defined in wrangler.toml / deploy.py
  async scheduled(event, env, ctx) {
    ctx.waitUntil(runRefresh(env));
  },

  // Manual trigger for catch-up and health checks
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname !== '/run') {
      return new Response(
        'Market Hub Data Refresh Worker\n\nGET /run  with  Authorization: Bearer <CRON_SECRET>',
        { status: 200, headers: { 'Content-Type': 'text/plain' } }
      );
    }

    const secret = env.CRON_SECRET;
    const auth   = request.headers.get('Authorization') ?? '';
    if (secret && auth !== `Bearer ${secret}`) {
      return new Response('Unauthorized', { status: 401 });
    }

    let result;
    try {
      result = await runRefresh(env);
    } catch (err) {
      result = { error: err.message, stack: err.stack?.slice(0, 500) };
    }

    return new Response(JSON.stringify(result, null, 2), {
      headers: { 'Content-Type': 'application/json' },
    });
  },
};
