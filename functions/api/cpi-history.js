/**
 * GET /api/cpi-history?range=1y|2y|5y|10y|20y
 *
 * Returns monthly CPI MoM % change for headline (CPIAUCSL) and core (CPILFESL)
 * from FRED using units=pch (pre-computed percent change from previous period).
 * This avoids null gaps caused by missing level values in the raw FRED series.
 *
 * Response: { dates: string[], headline: number[], core: number[] }
 * Dates are YYYY-MM-DD (first of month). Values are MoM % change (e.g. 0.2 = +0.2%).
 */

const CORS = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' };

const YEARS_MAP = { '1y': 1, '2y': 2, '5y': 5, '10y': 10, '20y': 20 };

function parseObs(observations) {
  const dates  = [];
  const values = [];
  for (const o of observations) {
    dates.push(o.date);
    values.push(o.value === '.' ? null : parseFloat(parseFloat(o.value).toFixed(3)));
  }
  return { dates, values };
}

// Fill interior null gaps with linear interpolation so chart lines stay continuous.
// Only fills nulls that have valid values on both sides — leading/trailing nulls stay null.
function fillInteriorGaps(values) {
  const out = [...values];
  let i = 0;
  while (i < out.length) {
    if (out[i] == null) {
      const left = i - 1;
      let right = i + 1;
      while (right < out.length && out[right] == null) right++;
      if (left >= 0 && right < out.length) {
        const steps = right - left;
        for (let k = i; k < right; k++) {
          out[k] = parseFloat((out[left] + (out[right] - out[left]) * (k - left) / steps).toFixed(3));
        }
        i = right;
      } else {
        i++;
      }
    } else {
      i++;
    }
  }
  return out;
}

export async function onRequest(context) {
  if (context.request.method === 'OPTIONS')
    return new Response(null, { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET' } });

  const url   = new URL(context.request.url);
  const range = (url.searchParams.get('range') || '10y').toLowerCase();
  const years = YEARS_MAP[range] || 10;

  const start = new Date();
  start.setFullYear(start.getFullYear() - years);
  const startStr = start.toISOString().slice(0, 10);

  const FRED_KEY = context.env.FRED_API_KEY || '';
  // units=pch: percent change from previous period — FRED computes the diff
  // internally so we get data even when individual level values are revised/missing.
  const fredUrl  = (series) =>
    `https://api.stlouisfed.org/fred/series/observations?series_id=${series}` +
    `&observation_start=${startStr}&frequency=m&units=pch&file_type=json` +
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

    const headline = parseObs(hData.observations || []);
    const core     = parseObs(cData.observations || []);

    // Align core values onto headline dates
    const coreDateMap = new Map(core.dates.map((d, i) => [d, core.values[i]]));
    const coreAligned = headline.dates.map(d => coreDateMap.has(d) ? coreDateMap.get(d) : null);

    return new Response(JSON.stringify({
      dates:    headline.dates,
      headline: fillInteriorGaps(headline.values),
      core:     fillInteriorGaps(coreAligned),
    }), {
      headers: { ...CORS, 'Cache-Control': 'public, max-age=86400' },
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: CORS });
  }
}
