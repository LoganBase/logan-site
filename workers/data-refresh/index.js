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

async function runRefresh(env) {
  const hubToken = env.HUB_TOKEN;
  const siteUrl  = (env.SITE_URL || 'https://www.loganbase.com').replace(/\/$/, '');

  if (!hubToken) {
    console.error('HUB_TOKEN not configured — aborting refresh');
    return { error: 'HUB_TOKEN not configured' };
  }

  console.log(`[data-refresh] calling ${siteUrl}/api/refresh`);
  let res;
  try {
    res = await fetch(`${siteUrl}/api/refresh`, {
      headers: { 'X-Hub-Token': hubToken },
    });
  } catch (err) {
    console.error('[data-refresh] network error:', err.message);
    return { error: `network error: ${err.message}` };
  }

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    console.error(`[data-refresh] HTTP ${res.status}:`, body.slice(0, 200));
    return { error: `HTTP ${res.status}`, body: body.slice(0, 200) };
  }

  let data;
  try {
    data = await res.json();
  } catch (err) {
    return { error: 'invalid JSON response from /api/refresh' };
  }

  console.log(`[data-refresh] done — ${data.totalAdded ?? '?'} rows added across ${data.symbols?.length ?? '?'} symbols`);
  return data;
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
