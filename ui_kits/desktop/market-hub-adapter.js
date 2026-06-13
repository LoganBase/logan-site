// ════════════════════════════════════════════════════════════════════════════
// Market Hub — data adapter
// ────────────────────────────────────────────────────────────────────────────
// Translates the LIVE product API (/api/scores + per-card history endpoints)
// into the shape the redesign kits render (window.GLANCE). In production this
// runs same-origin against your Cloudflare worker; in the design-system preview
// (no API reachable) every call falls back to the baked-in mock so the kit
// still renders. Drop this file into the app and point CONFIG.baseUrl at "" .
//
// Real contract (from the live app's own code):
//   GET /api/scores  ->  { aggregate, cards }
//     aggregate: { glow:'green'|'yellow'|'red', label, posture, score,
//                  bullish, neutral, bearish, regimeBearish,
//                  categories:[ { label, weight:0..1, score, glow,
//                                 cards:[ { status } ] } ] }
//     cards: [ { id, title, subtitle, status, delta,
//                rows:[ { label, indicator, value, condition, status } ],
//                hideIndicator?, allRows?, sectorTable?, details? } ]
//   GET /api/history?symbol=SPY&range=1y&d=YYYY-MM-DD -> { dates, closes, sma200, vs200, summary }
//   GET /api/breadth-history?range=1y    -> { dates, mmth, mmfi, summary }
//   GET /api/leadership?range=1y         -> { dates, ratio, summary }
//   GET /api/valuations-history?range=10y-> { dates, cape, ... }
//   GET /api/sectors?range=1y            -> { dates, cycVsDef, summary }
//   GET /api/global-flows-history?range=5y -> { dates, regional, countries }
//   GET /api/equities-history?range=1y   -> { dates, equities }
// ════════════════════════════════════════════════════════════════════════════
(function () {
  'use strict';

  const CONFIG = {
    // "" = same-origin (production). The preview sandbox can't reach the API,
    // so requests fail fast and we fall back to the mock. Set to your full
    // origin (e.g. "https://www.loganbase.com/market-hub") to test cross-origin.
    baseUrl: '',
    timeoutMs: 4000,
  };

  // UI range labels (kit) -> API range tokens (live product)
  const RANGE_MAP = { '1M': '1mo', '3M': '3mo', '6M': '6mo', '1Y': '1y', '5Y': '5y', '10Y': '10y' };

  // Per-card history: which endpoint + which field is the primary plotted series.
  const HISTORY = {
    regime:      { url: (r) => `/api/history?symbol=SPY&range=${r}`,   field: 'vs200'    },
    leadership:  { url: (r) => `/api/leadership?range=${r}`,           field: 'ratio'    },
    breadth:     { url: (r) => `/api/breadth-history?range=${r}`,      field: 'mmth'     },
    valuations:  { url: (r) => `/api/valuations-history?range=${r}`,   field: 'cape'     },
    yield:       { url: (r) => `/api/history?symbol=%5ETNX&range=${r}`,field: 'closes'   },
    credit:      { url: (r) => `/api/history?symbol=HYG&range=${r}`,   field: 'closes'   },
    globalflows: { url: (r) => `/api/global-flows-history?range=${r}`, field: 'regional' },
    sectors:     { url: (r) => `/api/sectors?range=${r}`,              field: 'cycVsDef' },
    commodities: { url: (r) => `/api/history?symbol=USCI&range=${r}`,  field: 'closes'   },
    equities:    { url: (r) => `/api/equities-history?range=${r}`,     field: 'equities' },
  };

  // Symbol -> ISO country code, for the Global Flows flag row (from the live app).
  const FLAG = {
    'SPY': 'us', '^GSPTSE': 'ca', 'EWU': 'gb', 'EWG': 'de', 'EWQ': 'fr', 'EWL': 'ch',
    'EWJ': 'jp', 'MCHI': 'cn', 'INDA': 'in', 'EWZ': 'br', 'EWA': 'au', 'EWY': 'kr',
    'EWH': 'hk', 'EWW': 'mx', 'EWT': 'tw', 'EWP': 'es', 'EWI': 'it', 'EWN': 'nl', 'ECH': 'cl',
  };

  function withTimeout(promise, ms) {
    return Promise.race([
      promise,
      new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms)),
    ]);
  }
  async function getJSON(path) {
    const res = await withTimeout(fetch(CONFIG.baseUrl + path, { credentials: 'same-origin' }), CONFIG.timeoutMs);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    if (data && data.error) throw new Error(data.error);
    return data;
  }

  function hashSeed(id) { let h = 0; for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 9973; return h || 7; }
  function asOfLabel() {
    const d = new Date();
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  // ── Map a live /api/scores card into the kit's card shape ──
  function mapCard(c) {
    const rows = (c.rows || []).map((r) => [r.label, r.value, r.condition || r.indicator || '', r.status]);
    const head = (c.rows && c.rows[0]) || {};
    const out = {
      title: c.title,
      status: c.status,
      seed: hashSeed(c.id),
      trend: c.status === 'bullish' ? 0.5 : c.status === 'bearish' ? -0.5 : 0.05,
      metric: c.subtitle || head.label || c.title,
      metricVal: head.value || '',
      metricUnit: head.condition || head.indicator || '',
      // No explicit stat-box set in the API → surface the top 3 indicators as stats.
      stats: (c.rows || []).slice(0, 3).map((r) => [r.label, r.value, r.condition || r.indicator || '',
        r.status === 'bullish' ? 'pos' : r.status === 'bearish' ? 'neg' : null]),
      rows,
    };
    // Global Flows: derive the flag row from card.details if the API provides it.
    if (c.id === 'globalflows' && Array.isArray(c.details)) {
      out.flags = c.details.map((d) => FLAG[d.symbol]).filter(Boolean);
    }
    return out;
  }

  // ── Map the whole /api/scores payload into window.GLANCE shape ──
  function mapScores(data) {
    const agg = data.aggregate || {};
    const cardsArr = data.cards || [];
    const byId = {};
    cardsArr.forEach((c) => { byId[c.id] = mapCard(c); });
    const categories = (agg.categories || []).map((cat) => ({
      label: cat.label,
      weight: Math.round((cat.weight || 0) * 100) + '%',
      cards: (cat.cards || []).map((c) => c.status),
    }));
    // Preserve the kit's group ordering, keep only ids the API actually returned.
    const GROUPS = [
      { label: 'Market Structure', ids: ['regime', 'leadership', 'breadth'] },
      { label: 'Macro Pricing',    ids: ['valuations', 'yield', 'credit'] },
      { label: 'Flow & Rotation',  ids: ['globalflows', 'sectors'] },
      { label: 'Real Assets',      ids: ['commodities', 'equities'] },
    ].map((g) => ({ label: g.label, ids: g.ids.filter((id) => byId[id]) })).filter((g) => g.ids.length);
    return {
      asOf: asOfLabel(),
      exec: {
        label: agg.label || 'Neutral',
        posture: agg.posture || '',
        bull: agg.bullish ?? 0, neutral: agg.neutral ?? 0, bear: agg.bearish ?? 0,
      },
      categories,
      groups: GROUPS,
      cards: byId,
      _live: true,
    };
  }

  // ── Public API ──
  const MarketHubData = {
    config: CONFIG,

    // Returns kit-shaped data. Live when /api/scores is reachable, else the mock.
    async loadGlance() {
      try {
        const data = await getJSON('/api/scores');
        return mapScores(data);
      } catch (e) {
        // Expected in the design-system preview — fall back to the bundled mock.
        if (window.GLANCE) return Object.assign({}, window.GLANCE, { _live: false });
        throw e;
      }
    },

    // Returns { values:number[], dates:string[] } for a card's primary series,
    // or null if unavailable (caller then renders the synthetic sparkline).
    async loadHistory(cardId, uiRange) {
      const cfg = HISTORY[cardId];
      if (!cfg) return null;
      const r = RANGE_MAP[uiRange] || '1y';
      try {
        const data = await getJSON(cfg.url(r) + `&d=${new Date().toISOString().slice(0, 10)}`);
        const values = data[cfg.field];
        if (!Array.isArray(values) || !values.length) return null;
        return { values: values.map(Number), dates: data.dates || [] };
      } catch (e) {
        return null;
      }
    },

    _internal: { mapScores, mapCard, RANGE_MAP, HISTORY, FLAG },
  };

  window.MarketHubData = MarketHubData;
})();
