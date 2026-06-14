/**
 * Market Hub — Daily Refresh Scheduler
 * Cloudflare Worker with Cron Trigger
 *
 * Runs Mon-Fri at 22:00 UTC (6pm EDT / 5pm EST) -- ~2h after US market close.
 * Calls /api/refresh on the Pages site to update D1 with the day's new rows.
 *
 * Deploy: Workers & Pages -> Create Worker -> paste this code -> Deploy
 * Cron:   Worker Settings -> Triggers -> Cron Triggers -> Add: 0 22 * * 1-5
 * Auth:   Set CRON_SECRET env var; pass as Authorization: Bearer <secret>
 */

const BASE        = 'https://loganbase.com';
const REFRESH_URL = `${BASE}/api/refresh`;
const SIGNALS_URL = `${BASE}/api/signals`;

export default {
  // Cron trigger -- fires on schedule
  async scheduled(event, env, ctx) {
    // Step 1: refresh D1 with today's prices
    try {
      const res  = await fetch(REFRESH_URL, { headers: { 'X-Hub-Token': env.HUB_TOKEN ?? '' } });
      const data = await res.json();
      console.log(
        `[market-hub-scheduler] ${data.timestamp} -- ${data.totalAdded} rows added`
      );
    } catch (err) {
      console.error(`[market-hub-scheduler] refresh failed: ${err.message}`);
    }

    // Step 2: write today's card signals + score any pending outcomes
    try {
      const res  = await fetch(SIGNALS_URL, { headers: { 'X-Hub-Token': env.HUB_TOKEN ?? '' } });
      const data = await res.json();
      console.log(
        `[market-hub-scheduler] signals -- wrote: ${data.signalsWritten}, scored: ${data.outcomesScored}`
      );
    } catch (err) {
      console.error(`[market-hub-scheduler] signals failed: ${err.message}`);
    }
  },

  // HTTP handler -- manual trigger via the Worker URL
  // Authorization: Bearer <CRON_SECRET>
  async fetch(request, env) {
    const secret = env.CRON_SECRET;
    const auth   = request.headers.get('Authorization') ?? '';
    if (secret && auth !== `Bearer ${secret}`) {
      return new Response('Unauthorized', { status: 401 });
    }

    const refreshRes = await fetch(REFRESH_URL, { headers: { 'X-Hub-Token': env.HUB_TOKEN ?? '' } });
    const refresh = refreshRes.ok ? await refreshRes.json() : { error: `HTTP ${refreshRes.status}` };
    const signalsRes = await fetch(SIGNALS_URL, { headers: { 'X-Hub-Token': env.HUB_TOKEN ?? '' } });
    const signals = signalsRes.ok ? await signalsRes.json() : { error: `HTTP ${signalsRes.status}` };
    return new Response(JSON.stringify({ refresh, signals }, null, 2), {
      headers: { 'Content-Type': 'application/json' },
    });
  },
};
