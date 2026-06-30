/**
 * GET /api/cpi-history?range=1y|2y|5y|10y|20y
 *
 * Returns monthly CPI MoM % change for headline (CPIAUCSL) and core (CPILFESL)
 * from FRED. Both series are seasonally adjusted.
 *
 * Response: { dates: string[], headline: number[], core: number[] }
 * Dates are YYYY-MM-DD (first of month). Values are MoM % change (e.g. 0.2 = +0.2%).
 */

const CORS = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' };

const YEARS_MAP = { '1y': 1, '2y': 2, '5y': 5, '10y': 10, '20y': 20 };

function toMoM(observations) {
  const dates  = [];
  const values = [];
  for (let i = 1; i < observations.length; i++) {
    const prev = observations[i - 1].value === '.' ? null : parseFloat(observations[i - 1].value);
    const curr = observations[i].value     === '.' ? null : parseFloat(observations[i].value);
    dates.push(observations[i].date); // YYYY-MM-DD
    if (prev != null && prev !== 0 && curr != null) {
      values.push(parseFloat(((curr - prev) / prev * 100).toFixed(3)));
    } else {
      values.push(null);
    }
  }
  return { dates, values };
}

export async function onRequest(context) {
  if (context.request.method === 'OPTIONS')
    return new Response(null, { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET' } });

  const url   = new URL(context.request.url);
  const range = (url.searchParams.get('range') || '10y').toLowerCase();
  const years = YEARS_MAP[range] || 10;

  // Fetch one extra month so the first data point has a prev value for MoM diff
  const start = new Date();
  start.setFullYear(start.getFullYear() - years);
  start.setMonth(start.getMonth() - 1);
  const startStr = start.toISOString().slice(0, 10);

  const FRED_KEY = context.env.FRED_API_KEY || '';
  const fredUrl  = (series) =>
    `https://api.stlouisfed.org/fred/series/observations?series_id=${series}` +
    `&observation_start=${startStr}&frequency=m&file_type=json` +
    (FRED_KEY ? `&api_key=${FRED_KEY}` : '');

  try {
    const [hRes, cRes] = await Promise.all([
      fetch(fredUrl('CPIAUCSL')),
      fetch(fredUrl('CPILFESL')),
    ]);

    if (!hRes.ok || !cRes.ok) {
      const status = !hRes.ok ? hRes.status : cRes.status;
      return new Response(JSON.stringify({ error: `FRED fetch failed: ${status}` }), { status: 502, headers: CORS });
    }

    const [hData, cData] = await Promise.all([hRes.json(), cRes.json()]);

    const headline = toMoM(hData.observations || []);
    const core     = toMoM(cData.observations || []);

    // Align core values onto headline dates
    const coreDateMap  = new Map(core.dates.map((d, i) => [d, core.values[i]]));
    const coreAligned  = headline.dates.map(d => coreDateMap.has(d) ? coreDateMap.get(d) : null);

    return new Response(JSON.stringify({
      dates:    headline.dates,
      headline: headline.values,
      core:     coreAligned,
    }), {
      headers: { ...CORS, 'Cache-Control': 'public, max-age=86400' },
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: CORS });
  }
}
