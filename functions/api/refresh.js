/**
 * Market Hub — Delta Refresh API
 * GET /api/refresh
 *
 * For each symbol, checks the last date stored in D1 and fetches only
 * the missing trading days from Yahoo Finance. Inserts new price rows
 * and recomputes indicators. Typically adds 1-2 rows per symbol per day.
 *
 * Requires D1 binding: variable name "DB" → market-hub-db
 */

const YF = 'https://query1.finance.yahoo.com/v8/finance/chart';
const YF_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
  'Accept':     'application/json',
  'Referer':    'https://finance.yahoo.com/',
};

const ALL_SYMBOLS = [
  'SPY', 'QQQ', 'RSP', 'QQEW', 'IVW', 'IVE',
  'RSPD',
  '^TYX', '^TNX', 'TLT', 'UUP',
  '^GSPTSE', 'SPDW', 'EWT', 'EWY', 'AIA', 'EZU', 'VEU', 'EEM',
  '^N225', 'EWW', 'EWZ', 'ILF',
  'XLI', 'XLK', 'XLF', 'XLE', 'XLU', 'XLRE', 'XLP',
  'XME', 'GDX', 'COPX', 'KBE',
  'USCI', 'HG=F', 'GLD', 'IXC', 'XES', 'DBA', 'SLX',
  'GEV', 'CAT', 'GRID', 'SU', 'TVE.TO', 'RIO', 'CCO.TO',
  'AEM', 'LRCX', 'SITM', 'SOXX', 'ZEB.TO',
];

// ── MATH ──────────────────────────────────────────────────────────────────────
function rsi(closes, period = 14) {
  if (!closes || closes.length < period + 1) return null;
  let ag = 0, al = 0;
  for (let i = 1; i <= period; i++) {
    const d = closes[i] - closes[i - 1];
    if (d > 0) ag += d; else al += -d;
  }
  ag /= period; al /= period;
  for (let i = period + 1; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1];
    ag = (ag * (period - 1) + Math.max(d, 0))  / period;
    al = (al * (period - 1) + Math.max(-d, 0)) / period;
  }
  return al === 0 ? 100 : 100 - 100 / (1 + ag / al);
}

// ── D1 HELPERS ────────────────────────────────────────────────────────────────
function query(db, sql, params = []) {
  return params.length
    ? db.prepare(sql).bind(...params).all()
    : db.prepare(sql).all();
}

function run(db, sql, params = []) {
  return params.length
    ? db.prepare(sql).bind(...params).run()
    : db.prepare(sql).run();
}

// ── REFRESH ONE SYMBOL ────────────────────────────────────────────────────────
async function refreshSymbol(db, symbol) {
  // Find the last date we have for this symbol
  const { results: lastRes } = await query(db,
    'SELECT MAX(date) as last_date FROM daily_prices WHERE symbol = ?', [symbol]
  );
  const lastDate = lastRes?.[0]?.last_date ?? null;
  const today    = new Date().toISOString().slice(0, 10);

  if (lastDate === today) return { symbol, added: 0, status: 'up to date' };

  // Fetch the last 5 trading days from Yahoo Finance
  const res = await fetch(
    `${YF}/${encodeURIComponent(symbol)}?interval=1d&range=5d`,
    { headers: YF_HEADERS }
  );
  if (!res.ok) return { symbol, added: 0, status: `Yahoo ${res.status}` };

  const data   = await res.json();
  const result = data?.chart?.result?.[0];
  if (!result)  return { symbol, added: 0, status: 'no data' };

  const timestamps = result.timestamp || [];
  const q          = result.indicators?.quote?.[0] || {};

  // Filter to only dates newer than what we have in D1
  const newRows = [];
  for (let i = 0; i < timestamps.length; i++) {
    if (q.close?.[i] == null) continue;
    const date = new Date(timestamps[i] * 1000).toISOString().slice(0, 10);
    if (!lastDate || date > lastDate) {
      newRows.push({
        date,
        open:   q.open?.[i]   ?? null,
        high:   q.high?.[i]   ?? null,
        low:    q.low?.[i]    ?? null,
        close:  q.close[i],
        volume: q.volume?.[i] ?? null,
      });
    }
  }

  if (newRows.length === 0) return { symbol, added: 0, status: 'no new dates' };

  // Insert new price rows
  for (const row of newRows) {
    await run(db,
      'INSERT OR REPLACE INTO daily_prices (symbol,date,open,high,low,close,volume) VALUES (?,?,?,?,?,?,?)',
      [symbol, row.date, row.open, row.high, row.low, row.close, row.volume]
    );
  }

  // Fetch last 220 rows for indicator context (need 200 for SMA200 + buffer)
  const { results: ctx } = await query(db,
    'SELECT date, close FROM daily_prices WHERE symbol = ? AND close IS NOT NULL ORDER BY date DESC LIMIT 220',
    [symbol]
  );
  const ctxRows   = ctx.reverse(); // oldest first
  const ctxDates  = ctxRows.map(r => r.date);
  const ctxCloses = ctxRows.map(r => r.close);
  const n         = ctxCloses.length;
  const newDates  = new Set(newRows.map(r => r.date));

  for (let i = 14; i < n; i++) {
    if (!newDates.has(ctxDates[i])) continue;

    const price    = ctxCloses[i];
    const sma50    = i >= 49  ? ctxCloses.slice(i - 49, i + 1).reduce((a, b) => a + b, 0) / 50  : null;
    const sma200   = i >= 199 ? ctxCloses.slice(i - 199, i + 1).reduce((a, b) => a + b, 0) / 200 : null;
    const vs200    = sma200 ? ((price - sma200) / sma200) * 100 : null;
    const rsi14    = rsi(ctxCloses.slice(0, i + 1), 14);
    const roc10    = i >= 10 ? ((price / ctxCloses[i - 10]) - 1) * 100 : null;

    // Percentile rank: count rows in D1 where vs200_pct <= current
    let percentile = null;
    if (vs200 != null) {
      const { results: pr } = await query(db,
        `SELECT COUNT(*) as total,
                SUM(CASE WHEN vs200_pct <= ? THEN 1 ELSE 0 END) as below_eq
         FROM indicators WHERE symbol = ?`,
        [vs200, symbol]
      );
      const row = pr?.[0];
      if (row?.total > 0) percentile = (row.below_eq / row.total) * 100;
    }

    await run(db,
      `INSERT OR REPLACE INTO indicators
       (symbol,date,sma50,sma200,rsi14,roc10,vs200_pct,percentile)
       VALUES (?,?,?,?,?,?,?,?)`,
      [symbol, ctxDates[i], sma50, sma200, rsi14, roc10, vs200, percentile]
    );
  }

  return { symbol, added: newRows.length, status: 'updated' };
}

// ── HANDLER ───────────────────────────────────────────────────────────────────
export async function onRequest(context) {
  if (context.request.method === 'OPTIONS') {
    return new Response(null, {
      headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET' },
    });
  }

  const db = context.env.DB;
  if (!db) {
    return new Response(JSON.stringify({
      error: 'D1 binding missing. Add variable "DB" → market-hub-db in Cloudflare Pages → Settings → Functions → D1 bindings.',
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }

  const results   = [];
  let totalAdded  = 0;

  for (const symbol of ALL_SYMBOLS) {
    try {
      const r  = await refreshSymbol(db, symbol);
      results.push(r);
      totalAdded += r.added;
    } catch (err) {
      results.push({ symbol, added: 0, status: 'error', error: err.message });
    }
  }

  return new Response(JSON.stringify({
    timestamp:  new Date().toISOString(),
    totalAdded,
    symbols:    results,
  }), {
    headers: {
      'Content-Type':                'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
