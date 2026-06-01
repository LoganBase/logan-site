/**
 * Market Hub — Daily Refresh Scheduler
 * Cloudflare Worker with Cron Trigger
 *
 * Runs Mon–Fri at 22:00 UTC (6pm EDT / 5pm EST) — ~2h after US market close.
 * Calls /api/refresh on the Pages site to update D1 with the day's new rows.
 *
 * Deploy: Workers & Pages → Create Worker → paste this code → Deploy
 * Cron:   Worker Settings → Triggers → Cron Triggers → Add: 0 22 * * 1-5
 */

const REFRESH_URL = 'https://loganbase.com/api/refresh';

export default {
  // Cron trigger — fires on schedule
  async scheduled(event, env, ctx) {
    try {
      const res  = await fetch(REFRESH_URL);
      const data = await res.json();
      console.log(
        `[market-hub-scheduler] ${data.timestamp} — ${data.totalAdded} rows added`
      );
    } catch (err) {
      console.error(`[market-hub-scheduler] refresh failed: ${err.message}`);
    }
  },

  // HTTP handler — lets you trigger a manual run via the Worker URL
  async fetch(request) {
    const res  = await fetch(REFRESH_URL);
    const data = await res.json();
    return new Response(JSON.stringify(data, null, 2), {
      headers: { 'Content-Type': 'application/json' },
    });
  },
};
