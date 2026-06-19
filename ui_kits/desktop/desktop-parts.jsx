// Market Hub — desktop shared parts. Reuses window.GLANCE data.
// Atoms + deep-dive content (incl. the historical regime timeline) shared by all 3 layout options.
const { useState: useStateD, useEffect: useEffectD, useRef: useRefD } = React;

const DSIG = {
  bullish: { c: '#22c55e', glow: 'rgba(34,197,94,.35)', fill: 'rgba(34,197,94,.12)', line: 'rgba(34,197,94,.25)', word: 'BULLISH' },
  neutral: { c: '#f59e0b', glow: 'rgba(245,158,11,.35)', fill: 'rgba(245,158,11,.10)', line: 'rgba(245,158,11,.20)', word: 'NEUTRAL' },
  bearish: { c: '#ef4444', glow: 'rgba(239,68,68,.35)', fill: 'rgba(239,68,68,.10)', line: 'rgba(239,68,68,.20)', word: 'BEARISH' },
};
const DMONO = "'SF Mono','JetBrains Mono','Fira Code',ui-monospace,Menlo,Consolas,monospace";
const DSANS = "'Inter',-apple-system,system-ui,sans-serif";
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function postureColorD(label) { return /off/i.test(label) ? '#ef4444' : /on/i.test(label) ? '#22c55e' : '#f59e0b'; }

// ── Seeded regime history — months of bull/neutral/bear, ending at the card's current status ──
function regimeHistory(seed, status, months) {
  let s = seed * 7919 + 104729;
  const rnd = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
  const order = ['bearish', 'neutral', 'bullish'];
  const target = order.indexOf(status);
  let idx = Math.max(0, Math.min(2, target + (rnd() < 0.5 ? -1 : 1)));
  const out = [];
  for (let i = 0; i < months; i++) {
    // drift toward the current status as we approach the present
    const pull = (i / months) > 0.55 && rnd() < 0.45;
    if (pull) idx += Math.sign(target - idx) || 0;
    else if (rnd() < 0.28) idx += rnd() < 0.5 ? -1 : 1;
    idx = Math.max(0, Math.min(2, idx));
    out.push(order[idx]);
  }
  out[months - 1] = status;
  if (months > 1) out[months - 2] = rnd() < 0.6 ? status : out[months - 2];
  return out;
}
function monthLabels(endLabel, n) {
  const ei = MONTHS.indexOf((endLabel || 'Mar').slice(0, 3));
  const out = [];
  for (let i = n - 1; i >= 0; i--) out.push(MONTHS[((ei - i) % 12 + 12) % 12]);
  return out;
}

// ── Line/area chart (desktop) — plots real history when the adapter has it, else synthetic ──
function DeepChartLg({ card, cardId, color: colorProp, height = 230, range, setRange, live, ranges: rangesProp, logScale = false, showDelta = false }) {
  const color = live?.lineColor || colorProp;
  const ranges = rangesProp || ['1W', '1M', '3M', '6M', '1Y', '5Y', '10Y'];
  const [hidden, setHidden] = useStateD({});
  const [hover, setHover] = useStateD(null);
  const svgRef = useRefD(null);

  const W = 720, H = height, top = 12, bot = 26, padR = 4;
  const conf = { '1W': [7, 0.09], '1M': [24, 0.16], '3M': [44, 0.135], '6M': [56, 0.115], '1Y': [64, 0.10], '5Y': [70, 0.082], '10Y': [80, 0.07], '20Y': [90, 0.06] };

  // ── Normalise all series into the same 0..1 plot space ──
  let primaryArr = [], overlayArrs = [], zeroY = null, normThresholds = [];
  if (live && live.values.length > 1) {
    const allVals = [
      ...live.values,
      ...(live.overlays || []).flatMap((o) => o.values || []),
      ...(live.thresholds || []).map((t) => t.y),
    ].filter((v) => v != null && !isNaN(v));
    const lo = Math.min(...allVals), hi = Math.max(...allVals), span = hi - lo || 1;
    const logLo = Math.log(Math.max(lo, 1e-9)), logSpan = Math.log(Math.max(hi, 1e-9)) - logLo || 1;
    const norm = logScale && lo > 0
      ? (v) => (v != null && !isNaN(v) && v > 0) ? 0.07 + ((Math.log(v) - logLo) / logSpan) * 0.86 : null
      : (v) => (v != null && !isNaN(v)) ? 0.07 + ((v - lo) / span) * 0.86 : null;
    primaryArr = live.values.map(norm);
    overlayArrs = (live.overlays || []).map((o) => ({ ...o, arr: (o.values || []).map(norm) }));
    if (live.format === 'pct' && lo <= 0 && hi >= 0) zeroY = norm(0);
    normThresholds = (live.thresholds || []).map((t) => ({ ...t, yNorm: norm(t.y) }));
  } else {
    const [n, vol] = conf[range] || [64, 0.10];
    let s = card.seed * 9301 + 49297 + range.length * 1733;
    const rnd = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
    let v = 0.4;
    for (let i = 0; i < n; i++) { v += (rnd() - 0.5) * vol + card.trend * 0.012; v = Math.max(0.07, Math.min(0.94, v)); primaryArr.push(v); }
  }

  const n = primaryArr.length;
  const dx = (W - padR) / Math.max(n - 1, 1);
  const yy = (p) => p != null ? top + (1 - p) * (H - top - bot) : null;
  const buildPath = (arr) => {
    let d = '';
    arr.forEach((p, i) => { if (p != null) d += `${(i === 0 || arr[i - 1] == null) ? 'M' : 'L'}${(i * dx).toFixed(1)},${yy(p).toFixed(1)}`; });
    return d;
  };
  const mainLine = buildPath(primaryArr);
  const mainArea = `${mainLine} L${((n - 1) * dx).toFixed(1)},${H - bot} L0,${H - bot} Z`;
  const gradId = `dlg${card.seed}`;

  const hasLegend = overlayArrs.length > 0;
  const mainLabel = live?.label || 'SPY';
  const mainHidden = hasLegend && hidden[mainLabel];

  // ── Colour-coded SPY segments (when colorBy present) ──
  const colorSegs = (live?.colorBy && !mainHidden) ? (() => {
    const segs = []; let start = 0, cur = null;
    const defaultCfn = (v) => (v == null || isNaN(v)) ? '#3b82f6' : v > 14 ? '#ef4444' : v < 0 ? '#f97316' : '#3b82f6';
    const cfn = live.colorByFn || defaultCfn;
    primaryArr.forEach((p, i) => {
      const c = cfn(live.colorBy[i]);
      if (c !== cur) { if (cur !== null) segs.push({ from: start, to: i, c: cur }); start = i; cur = c; }
    });
    if (cur) segs.push({ from: start, to: n - 1, c: cur });
    return segs;
  })() : null;

  // ── RSI panel ──
  const rsiData = live?.rsi?.length > 1 ? live.rsi : null;
  const RSI_H = 64;
  const rsiCol = (v) => v > 70 ? '#ef4444' : v > 50 ? '#22c55e' : v > 40 ? '#64748b' : v > 30 ? '#f97316' : '#a855f7';

  // ── Legend items ──
  const legendItems = hasLegend ? [
    { label: live?.label || 'SPY', color, dash: null },
    ...overlayArrs.map((o) => ({ label: o.label, color: o.color, dash: o.dash })),
  ] : null;

  // ── Hover / tooltip ──
  const isPrice = live?.format !== 'pct' && live?.format !== 'pct_abs' && overlayArrs.length > 0;
  const fmtVal = (v) => live?.format === 'pct'
    ? (v >= 0 ? '+' : '') + v.toFixed(2) + '%'
    : live?.format === 'pct_abs'
    ? v.toFixed(1) + '%'
    : live?.format === 'count'
    ? String(Math.round(v))
    : isPrice ? `$${v.toFixed(2)}` : v.toFixed(3);
  const handleMouseMove = (e) => {
    const el = svgRef.current;
    if (!el || n < 2) return;
    const rect = el.getBoundingClientRect();
    setHover(Math.max(0, Math.min(n - 1, Math.round(((e.clientX - rect.left) / rect.width) * (n - 1)))));
  };

  return (
    <div>
      {/* ── Chart area (relative wrapper for tooltip) ── */}
      <div style={{ position: 'relative' }} onMouseMove={handleMouseMove} onMouseLeave={() => setHover(null)}>
        {/* ── Main chart ── */}
        <svg ref={svgRef} width="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ display: 'block', height }}>
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor={color} stopOpacity="0.22" /><stop offset="1" stopColor={color} stopOpacity="0" />
            </linearGradient>
          </defs>
          {[0.2, 0.4, 0.6, 0.8].map((g) => (<line key={g} x1="0" x2={W} y1={top + g * (H - top - bot)} y2={top + g * (H - top - bot)} stroke="#16202e" strokeWidth="1" strokeDasharray="2 5" />))}
          <line x1="0" x2={W} y1={H - bot} y2={H - bot} stroke="#1e2d3d" strokeWidth="1" />
          {zeroY != null && <line x1="0" x2={W} y1={yy(zeroY).toFixed(1)} y2={yy(zeroY).toFixed(1)} stroke="#475569" strokeWidth="1" strokeDasharray="4 3" />}
          {normThresholds.map((t) => <line key={t.y} x1="0" x2={W} y1={yy(t.yNorm).toFixed(1)} y2={yy(t.yNorm).toFixed(1)} stroke={t.color} strokeWidth="1" strokeDasharray="4 4" strokeOpacity="0.5" />)}
          {!mainHidden && <path d={mainArea} fill={`url(#${gradId})`} />}
          {overlayArrs.map((o) => !hidden[o.label] && (
            <path key={o.label} d={buildPath(o.arr)} fill="none" stroke={o.color} strokeWidth="1.5"
              strokeDasharray={o.dash ? o.dash.join(' ') : undefined}
              strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
          ))}
          {!mainHidden && (colorSegs
            ? colorSegs.map((seg, si) => {
                const pts = primaryArr.slice(seg.from, seg.to + 1);
                const d = pts.map((p, i) => p == null ? '' : `${(i === 0 || pts[i - 1] == null) ? 'M' : 'L'}${((seg.from + i) * dx).toFixed(1)},${yy(p).toFixed(1)}`).join('');
                return <path key={si} d={d} fill="none" stroke={seg.c} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />;
              })
            : <path d={mainLine} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
          )}
          {/* Crosshair + hover dots */}
          {hover != null && (
            <line x1={(hover * dx).toFixed(1)} x2={(hover * dx).toFixed(1)} y1={top} y2={H - bot}
              stroke="#334155" strokeWidth="1" strokeDasharray="2 3" pointerEvents="none" />
          )}
          {hover != null && !mainHidden && primaryArr[hover] != null && (() => {
            const hc = colorSegs ? (colorSegs.find((s) => hover >= s.from && hover <= s.to)?.c || color) : color;
            return <circle cx={(hover * dx).toFixed(1)} cy={yy(primaryArr[hover]).toFixed(1)} r="4" fill={hc} stroke="#080c14" strokeWidth="1.5" pointerEvents="none" />;
          })()}
          {hover != null && overlayArrs.map((o) => !hidden[o.label] && o.arr[hover] != null && (
            <circle key={o.label} cx={(hover * dx).toFixed(1)} cy={yy(o.arr[hover]).toFixed(1)}
              r="3.5" fill={o.color} stroke="#080c14" strokeWidth="1.5" pointerEvents="none" />
          ))}
          {/* Latest-point dot (hidden while hovering) */}
          {hover == null && !mainHidden && primaryArr[n - 1] != null && (() => {
            const lx = ((n - 1) * dx).toFixed(1), ly = yy(primaryArr[n - 1]).toFixed(1);
            const dc = colorSegs ? colorSegs[colorSegs.length - 1]?.c || color : color;
            return (<><circle cx={lx} cy={ly} r="3.5" fill={dc} /><circle cx={lx} cy={ly} r="7" fill="none" stroke={dc} strokeOpacity="0.35" strokeWidth="2" /></>);
          })()}
        </svg>

        {/* ── RSI panel ── */}
        {rsiData && (
          <svg width="100%" viewBox={`0 0 ${W} ${RSI_H}`} preserveAspectRatio="none" style={{ display: 'block', height: RSI_H, marginTop: 3 }}>
            {[30, 70].map((v) => { const y = ((1 - v / 100) * RSI_H).toFixed(1); return <line key={v} x1="0" x2={W} y1={y} y2={y} stroke="rgba(245,158,11,.4)" strokeWidth="1" strokeDasharray="3 4" />; })}
            {rsiData.map((v, i) => {
              if (v == null || isNaN(v)) return null;
              const bw = (W / rsiData.length).toFixed(2), bh = ((v / 100) * RSI_H).toFixed(2);
              return <rect key={i} x={(i * W / rsiData.length).toFixed(2)} y={(RSI_H - Number(bh)).toFixed(2)} width={bw} height={bh} fill={rsiCol(v)} opacity="0.7" />;
            })}
            <text x="4" y="11" fill="#64748b" fontSize="9" fontFamily="monospace">RSI 14</text>
            <text x={W - 4} y={((1 - 70 / 100) * RSI_H - 2).toFixed(1)} fill="#64748b" fontSize="8" fontFamily="monospace" textAnchor="end">70</text>
            <text x={W - 4} y={((1 - 30 / 100) * RSI_H - 2).toFixed(1)} fill="#64748b" fontSize="8" fontFamily="monospace" textAnchor="end">30</text>
          </svg>
        )}

        {/* ── Tooltip ── */}
        {hover != null && live?.dates?.[hover] && (
          <div style={{
            position: 'absolute', top: 10, pointerEvents: 'none', zIndex: 10,
            ...(hover / Math.max(n - 1, 1) > 0.55
              ? { right: `calc(${(1 - hover / Math.max(n - 1, 1)) * 100}% + 14px)` }
              : { left: `calc(${(hover / Math.max(n - 1, 1)) * 100}% + 14px)` }),
            background: '#0d1520', border: '1px solid #1e2d3d', borderRadius: 10,
            padding: '10px 14px', minWidth: 175,
            boxShadow: '0 8px 24px rgba(0,0,0,.5)',
          }}>
            <div style={{ fontFamily: DSANS, fontSize: 11, color: '#64748b', marginBottom: 8, fontWeight: 600 }}>{live.dates[hover]}</div>
            {[
              { label: live?.label || 'SPY', value: live.values[hover], color },
              ...(live.overlays || []).map((o) => ({ label: o.label, value: (o.values || [])[hover], color: o.color })),
            ].filter(({ value }) => value != null && !isNaN(value)).map(({ label, value, color: tc }) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 20, marginBottom: 5 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: tc, flexShrink: 0 }} />
                  <span style={{ fontFamily: DSANS, fontSize: 12, color: '#94a3b8' }}>{label}</span>
                </span>
                <span style={{ fontFamily: DMONO, fontSize: 12.5, color: '#e8edf5', fontWeight: 600 }}>{fmtVal(value)}</span>
              </div>
            ))}
            {showDelta && live?.overlays?.length > 0 && (() => {
              const pv = live.values[hover];
              const ov = (live.overlays[0].values || [])[hover];
              if (pv == null || ov == null || isNaN(pv) || isNaN(ov)) return null;
              const delta = pv - ov;
              const dc = delta > 0.01 ? '#22c55e' : delta < -0.01 ? '#ef4444' : '#f59e0b';
              return (
                <div style={{ marginTop: 6, paddingTop: 6, borderTop: '1px solid #1e2d3d', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 20 }}>
                  <span style={{ fontFamily: DSANS, fontSize: 12, color: '#64748b' }}>Spread</span>
                  <span style={{ fontFamily: DMONO, fontSize: 12.5, fontWeight: 700, color: dc }}>{(delta >= 0 ? '+' : '') + delta.toFixed(2) + '%'}</span>
                </div>
              );
            })()}
            {(live?.vs200 || live?.vs50) && (() => {
              // % above 200d mirrors the Stretch Risk bands from /api/scores.
              const stretchTone = (v) => v > 14 ? 'bearish' : v > 10 ? 'neutral' : v >= 0 ? 'bullish' : v >= -10 ? 'neutral' : 'bearish';
              // % above 50d: the 50d is a faster, noisier average, so bands are tighter than the 200d's.
              const vs50Tone    = (v) => v > 8 ? 'bearish' : v > 5 ? 'neutral' : v >= 0 ? 'bullish' : v >= -5 ? 'neutral' : 'bearish';
              return (
                <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid #1e2d3d' }}>
                  {[
                    { label: '% above 200d', value: live?.vs200?.[hover], tone: stretchTone },
                    { label: '% above 50d',  value: live?.vs50?.[hover],  tone: vs50Tone },
                  ].filter(({ value }) => value != null && !isNaN(value)).map(({ label, value, tone }) => (
                    <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 20, marginBottom: 5 }}>
                      <span style={{ fontFamily: DSANS, fontSize: 12, color: '#94a3b8' }}>{label}</span>
                      <span style={{ fontFamily: DMONO, fontSize: 12.5, fontWeight: 600, color: DSIG[tone(value)].c }}>
                        {(value >= 0 ? '+' : '') + value.toFixed(1)}%
                      </span>
                    </div>
                  ))}
                </div>
              );
            })()}
            {rsiData && rsiData[hover] != null && !isNaN(rsiData[hover]) && (() => {
              const rv = rsiData[hover];
              const rc = rsiCol(rv);
              const rl = rv > 70 ? 'Overbought' : rv > 50 ? 'Bullish Momentum' : rv > 40 ? 'Neutral' : rv > 30 ? 'Bearish Momentum' : 'Oversold';
              return (
                <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid #1e2d3d', display: 'flex', alignItems: 'center', gap: 7 }}>
                  <span style={{ width: 8, height: 8, borderRadius: 2, background: rc, flexShrink: 0 }} />
                  <span style={{ fontFamily: DSANS, fontSize: 12, color: '#94a3b8' }}>
                    RSI: <span style={{ color: rc, fontWeight: 600 }}>{rv.toFixed(1)}</span> — {rl}
                  </span>
                </div>
              );
            })()}
          </div>
        )}
      </div>

      {/* ── Range buttons + live indicator ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 3, marginTop: 12, flexWrap: 'wrap' }}>
        {ranges.map((r) => (
          <button key={r} onClick={() => setRange(r)} style={{ all: 'unset', cursor: 'pointer', padding: '5px 10px', borderRadius: 7,
            fontFamily: DMONO, fontSize: 11.5, fontWeight: 600, color: r === range ? '#e8edf5' : '#64748b',
            background: r === range ? '#1b2736' : 'transparent', border: `1px solid ${r === range ? '#243446' : 'transparent'}` }}>{r}</button>
        ))}
        <span title={live ? 'Live data from /api' : 'Sample data — connect /api for live history'} style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, fontFamily: DSANS, fontSize: 10.5, color: '#8295a9' }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: live ? '#22c55e' : '#64748b', boxShadow: live ? '0 0 6px #22c55e' : 'none' }} />
          {live ? 'Live' : 'Sample'}
        </span>
      </div>

      {/* ── Legend (regime card only — click to toggle series) ── */}
      {legendItems && (
        <div style={{ display: 'flex', gap: 18, marginTop: 10, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {legendItems.map(({ label, color: lc, dash }, li) => {
            const isHidden = hidden[label];
            return (
              <button key={label} onClick={() => setHidden((h) => ({ ...h, [label]: !h[label] }))}
                style={{ all: 'unset', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 7, opacity: isHidden ? 0.3 : 1, transition: 'opacity .15s' }}>
                <svg width="24" height="12" viewBox="0 0 24 12" style={{ flexShrink: 0 }}>
                  {li === 0
                    ? <rect x="0" y="2" width="24" height="8" rx="2" fill={lc} opacity="0.85" />
                    : <line x1="0" y1="6" x2="24" y2="6" stroke={lc} strokeWidth={dash ? 1.5 : 2} strokeDasharray={dash ? dash.join(' ') : undefined} />}
                </svg>
                <span style={{ fontFamily: DSANS, fontSize: 11.5, color: isHidden ? '#64748b' : '#94a3b8' }}>{label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

const HISTORY_CAPTION = {
  regime:      ['SPY ', ['above', 'bullish'], ' or ', ['below', 'bearish'], ' its 200-day moving average each month'],
  leadership:  ['RSP ', ['leading', 'bullish'], ' or ', ['lagging', 'bearish'], ' SPY on a monthly basis'],
  breadth:     ['NYSE stocks ', ['above', 'bullish'], ' or ', ['below', 'bearish'], ' their 200-day average'],
  valuations:  'CAPE ratio signal vs. long-run historical norms',
  yield:       '10-year Treasury yield trend each month',
  credit:      'HYG credit-spread health vs. 200-day average',
  globalflows: ['Global markets ', ['above', 'bullish'], ' or ', ['below', 'bearish'], ' their 200-day average'],
  sectors:     [['Cyclical', 'bullish'], ' vs. ', ['defensive', 'bearish'], ' sector leadership each month'],
  commodities: 'Commodity complex trend vs. 200-day average',
  equities:    'Equity market breadth vs. 200-day average',
};
const renderCaption = (cap) => {
  if (!cap) return null;
  if (typeof cap === 'string') return cap;
  return cap.map((seg, i) => Array.isArray(seg)
    ? <span key={i} style={{ color: DSIG[seg[1]].c, fontStyle: 'italic' }}>{seg[0]}</span>
    : <span key={i}>{seg}</span>
  );
};

// ── Historical regime timeline — how the card's status changed month over month ──
function RegimeTimeline({ card, cardId, asOf, months = 12, compact = false, liveData }) {
  const mo = months;

  let hist, labels;
  const colorSrc = liveData?.colorBy?.length ? liveData.colorBy : liveData?.values?.length ? liveData.values : null;
  if (colorSrc && liveData?.dates?.length) {
    const monthMap = {};
    liveData.dates.forEach((d, i) => {
      const m = String(d).slice(0, 7);
      if (m) monthMap[m] = colorSrc[i];
    });
    const sorted = Object.keys(monthMap).sort();
    const allStatuses = sorted.map((m) => {
      const v = monthMap[m];
      return (v == null || isNaN(v)) ? 'neutral' : v > 0 ? 'bullish' : 'bearish';
    });
    hist = allStatuses.slice(-mo);
    labels = sorted.slice(-mo).map((m) => MONTHS[parseInt(m.slice(5, 7), 10) - 1]);
    while (hist.length < mo) { hist.unshift(hist[0] || card.status); labels.unshift(''); }
  } else {
    hist = regimeHistory(card.seed, card.status, mo);
    labels = monthLabels(asOf, mo);
  }

  let transitions = 0;
  for (let i = 1; i < hist.length; i++) if (hist[i] !== hist[i - 1]) transitions++;
  const barH = compact ? 26 : 38;
  return (
    <div>
      <div style={{ display: 'flex', gap: 3, alignItems: 'flex-end' }}>
        {hist.map((st, i) => {
          const sg = DSIG[st], changed = i > 0 && hist[i - 1] !== st, last = i === hist.length - 1;
          return (
            <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
              <div style={{ position: 'relative', width: '100%', height: barH, borderRadius: 5, background: sg.c,
                boxShadow: last ? `0 0 12px ${sg.glow}` : 'none', opacity: last ? 1 : 0.62 + (i / mo) * 0.3,
                borderLeft: changed ? '2px solid rgba(232,237,245,.55)' : 'none' }}>
                {last && <div style={{ position: 'absolute', inset: 0, borderRadius: 5, border: '1.5px solid rgba(232,237,245,.6)' }} />}
              </div>
              <span style={{ fontFamily: DMONO, fontSize: 9.5, color: last ? '#cbd5e1' : '#8295a9', fontWeight: last ? 700 : 400 }}>{labels[i]}</span>
            </div>
          );
        })}
      </div>
      {!compact && (
        <div style={{ display: 'flex', gap: 18, marginTop: 16, alignItems: 'center' }}>
          {[['bullish', 'Bullish'], ['neutral', 'Neutral'], ['bearish', 'Bearish']].map(([k, lab]) => (
            <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <span style={{ width: 10, height: 10, borderRadius: 3, background: DSIG[k].c }} />
              <span style={{ fontFamily: DSANS, fontSize: 12, color: '#94a3b8' }}>{lab}</span>
            </div>
          ))}
          {HISTORY_CAPTION[cardId] && (
            <span style={{ marginLeft: 'auto', fontFamily: DSANS, fontSize: 11, color: '#8295a9', fontStyle: 'italic' }}>
              {renderCaption(HISTORY_CAPTION[cardId])}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

// ── Status pill ──
function StatusPill({ status, size = 'md' }) {
  const sg = DSIG[status];
  const pad = size === 'sm' ? '3px 8px' : '5px 12px';
  const fs = size === 'sm' ? 9.5 : 11;
  return (
    <div style={{ display: 'inline-flex', padding: pad, borderRadius: 6, background: sg.fill, border: `1px solid ${sg.line}` }}>
      <span style={{ fontFamily: DSANS, fontSize: fs, fontWeight: 700, letterSpacing: '.08em', color: sg.c }}>{sg.word}</span>
    </div>
  );
}

// ── Mini sparkline (desktop) ──
function SparkD({ seed, trend, color, w = 72, h = 26 }) {
  const pts = []; let v = 0.5, s = seed * 9301 + 49297;
  const rnd = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
  const N = 24;
  for (let i = 0; i < N; i++) { v += (rnd() - 0.5) * 0.2 + trend * 0.016; v = Math.max(0.08, Math.min(0.92, v)); pts.push(v); }
  const dx = w / (N - 1);
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${(i * dx).toFixed(1)},${(h - p * h).toFixed(1)}`).join(' ');
  const area = `${line} L${w},${h} L0,${h} Z`;
  const id = `sd${seed}`;
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ display: 'block' }}>
      <defs><linearGradient id={id} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={color} stopOpacity="0.26" /><stop offset="1" stopColor={color} stopOpacity="0" /></linearGradient></defs>
      <path d={area} fill={`url(#${id})`} /><path d={line} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

// ── Stat boxes row ──
// 4-field tuple [label, value, desc, tone]: renders value / label / desc (original format)
// 5-field tuple [label, value, indicator, tone, condition]: renders value / label / — indicator / — condition
// 6-field tuple [..., triggers]: triggers = [{label, text, color}] shown on hover
function StatBoxes({ stats }) {
  if (!stats || !stats.length) return null;
  const [hoveredIdx, setHoveredIdx] = useStateD(null);
  const cap = (s) => s ? s.charAt(0).toUpperCase() + s.slice(1) : '';
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${stats.length}, 1fr)`, gap: 10 }}>
      {stats.map((st, i) => {
        const tone = st[3] === 'pos' ? '#22c55e' : st[3] === 'neg' ? '#ef4444' : '#f59e0b';
        const extended = st[4] != null;
        const triggers = st[5] || null;
        const direction = st[6] || null;
        const warn = st[7] || false;
        const showTriggers = triggers && hoveredIdx === i;
        return (
          <div key={i}
            style={{ background: '#0d1520', border: `1px solid ${showTriggers ? '#2a3f57' : warn ? '#78350f' : '#1e2d3d'}`, borderRadius: 12, padding: '14px 14px', position: 'relative', transition: 'border-color .15s' }}
            onMouseEnter={() => triggers && setHoveredIdx(i)}
            onMouseLeave={() => setHoveredIdx(null)}>
            {(direction || warn) && !showTriggers && (
              <div style={{ position: 'absolute', top: 8, right: 10, display: 'flex', gap: 4, alignItems: 'center' }}>
                {warn && <span style={{ fontSize: 10, color: '#f59e0b' }}>⚠</span>}
                {direction && <span style={{ fontSize: 10, color: direction === 'up' ? '#22c55e' : direction === 'down' ? '#ef4444' : '#64748b' }}>{direction === 'up' ? '▲' : direction === 'down' ? '▼' : '—'}</span>}
              </div>
            )}
            {showTriggers ? (
              <div>
                <div style={{ fontFamily: DSANS, fontSize: 10, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: '#8295a9', marginBottom: 10 }}>Triggers</div>
                {triggers.map((t, j) => (
                  <div key={j} style={{ marginBottom: j < triggers.length - 1 ? (triggers.length > 6 ? 4 : 8) : 0 }}>
                    <span style={{ fontFamily: DSANS, fontSize: triggers.length > 6 ? 10 : 11, fontWeight: 700, color: t.color }}>{t.label}: </span>
                    <span style={{ fontFamily: DMONO, fontSize: triggers.length > 6 ? 10 : 11, color: t.color }}>{t.text}</span>
                  </div>
                ))}
              </div>
            ) : (
              <>
                <div style={{ fontFamily: DMONO, fontSize: 20, fontWeight: 700, color: tone, whiteSpace: 'pre-line', lineHeight: 1.3 }}>{st[1]}</div>
                <div style={{ fontFamily: DSANS, fontSize: 12, color: '#94a3b8', marginTop: 5 }}>{st[0]}</div>
                {extended ? (
                  <>
                    <div style={{ fontFamily: DSANS, fontSize: 10.5, color: tone, marginTop: 4 }}>— {cap(st[2])}</div>
                    <div style={{ fontFamily: DSANS, fontSize: 10.5, color: tone, marginTop: 2 }}>— {cap(st[4])}</div>
                  </>
                ) : (
                  <div style={{ fontFamily: DSANS, fontSize: 10.5, color: '#8295a9', marginTop: 2 }}>{st[2]}</div>
                )}
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Indicator table ──
function IndicatorTable({ rows }) {
  if (!rows || !rows.length) return null;
  return (
    <div style={{ background: '#0d1520', border: '1px solid #1e2d3d', borderRadius: 14, padding: '4px 18px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '8px 0 7px', borderBottom: '1px solid #1e2d3d' }}>
        <span style={{ width: 9, flexShrink: 0 }} />
        <span style={{ fontFamily: DSANS, fontSize: 10, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: '#8295a9', width: 175, flexShrink: 0 }}>Signal</span>
        <span style={{ fontFamily: DSANS, fontSize: 10, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: '#8295a9', width: 285, flexShrink: 0 }}>Indicator</span>
        <span style={{ fontFamily: DSANS, fontSize: 10, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: '#8295a9', flex: 1 }}>Condition</span>
        <span style={{ fontFamily: DSANS, fontSize: 10, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: '#8295a9', width: 100, textAlign: 'right', flexShrink: 0 }}>Value</span>
      </div>
      {rows.map((r, i) => {
        const rs = DSIG[r[3]] || DSIG.neutral;
        return (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '13px 0', borderBottom: i < rows.length - 1 ? '1px solid #16202e' : 'none' }}>
            <span style={{ width: 9, height: 9, borderRadius: '50%', background: rs.c, boxShadow: `0 0 6px ${rs.glow}`, flexShrink: 0 }} />
            <span style={{ fontFamily: DSANS, fontSize: 14, fontWeight: 600, color: '#e8edf5', width: 175, flexShrink: 0 }}>{r[0]}</span>
            <span style={{ fontFamily: DSANS, fontSize: 12, color: '#64748b', width: 285, flexShrink: 0 }}>{r[4]}</span>
            <span style={{ fontFamily: DSANS, fontSize: 12.5, color: '#94a3b8', flex: 1 }}>{r[2]}</span>
            <span style={{ fontFamily: DMONO, fontSize: 13, fontWeight: 600, color: rs.c, width: 100, textAlign: 'right', flexShrink: 0, whiteSpace: 'pre-line', lineHeight: 1.5 }}>{r[1]}</span>
          </div>
        );
      })}
    </div>
  );
}

// ── Sector breakdown table (breadth card — sectorTable from /api/scores) ──
function SectorBreakdown({ sectorTable }) {
  if (!sectorTable || !sectorTable.length) return null;
  const sorted = [...sectorTable].sort((a, b) => b.vs200 - a.vs200);
  const hdr = { fontFamily: DSANS, fontSize: 10, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: '#8295a9' };
  const fmt = (v) => v == null ? '—' : (v >= 0 ? '+' : '') + v.toFixed(1) + '%';
  return (
    <div style={{ background: '#0d1520', border: '1px solid #1e2d3d', borderRadius: 14, padding: '4px 18px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '8px 0 7px', borderBottom: '1px solid #1e2d3d' }}>
        <span style={{ width: 8, flexShrink: 0 }} />
        <span style={{ ...hdr, flex: 1 }}>Sector</span>
        <span style={{ ...hdr, width: 44, textAlign: 'right', flexShrink: 0 }}>ETF</span>
        <span style={{ ...hdr, width: 72, textAlign: 'right', flexShrink: 0 }}>vs 50d</span>
        <span style={{ ...hdr, width: 72, textAlign: 'right', flexShrink: 0 }}>vs 200d</span>
      </div>
      {sorted.map((s, i) => {
        const c200  = s.bull ? '#22c55e' : '#ef4444';
        const glow  = s.bull ? 'rgba(34,197,94,.35)' : 'rgba(239,68,68,.35)';
        const c50   = s.vs50 == null ? '#8295a9' : s.vs50 > 0 ? '#22c55e' : '#ef4444';
        return (
          <div key={s.ticker} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '10px 0', borderBottom: i < sorted.length - 1 ? '1px solid #16202e' : 'none' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: c200, boxShadow: `0 0 5px ${glow}`, flexShrink: 0 }} />
            <span style={{ fontFamily: DSANS, fontSize: 13.5, color: '#e8edf5', flex: 1 }}>{s.name}</span>
            <span style={{ fontFamily: DMONO, fontSize: 11, color: '#64748b', width: 44, textAlign: 'right', flexShrink: 0 }}>{s.ticker}</span>
            <span style={{ fontFamily: DMONO, fontSize: 13, fontWeight: 600, color: c50, width: 72, textAlign: 'right', flexShrink: 0 }}>{fmt(s.vs50)}</span>
            <span style={{ fontFamily: DMONO, fontSize: 13, fontWeight: 600, color: c200, width: 72, textAlign: 'right', flexShrink: 0 }}>{fmt(s.vs200)}</span>
          </div>
        );
      })}
    </div>
  );
}

// ── Country breakdown table (global flows card — details from /api/scores) ──
function CountryTable({ details }) {
  if (!details || !details.length) return null;
  const groupOrder = [];
  const groupMap = {};
  details.forEach((d) => {
    if (!groupMap[d.group]) { groupMap[d.group] = []; groupOrder.push(d.group); }
    groupMap[d.group].push(d);
  });
  const groups = groupOrder.map((g) => ({ group: g, items: groupMap[g] }));
  return (
    <div style={{ background: '#0d1520', border: '1px solid #1e2d3d', borderRadius: 14, padding: '0 18px' }}>
      {groups.map(({ group, items }, gi) => (
        <div key={group}>
          <div style={{ fontFamily: DSANS, fontSize: 10, fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', color: '#334155', padding: '10px 0 4px' }}>{group}</div>
          {items.map((d, i) => {
            const c = d.above ? '#22c55e' : '#ef4444';
            const glow = d.above ? 'rgba(34,197,94,.35)' : 'rgba(239,68,68,.35)';
            const isLast = gi === groups.length - 1 && i === items.length - 1;
            return (
              <div key={d.sym} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '9px 0', borderBottom: isLast ? 'none' : '1px solid #16202e' }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: c, boxShadow: `0 0 5px ${glow}`, flexShrink: 0 }} />
                <span style={{ fontFamily: DSANS, fontSize: 13.5, color: '#e8edf5', flex: 1 }}>{d.label}</span>
                <span style={{ fontFamily: DMONO, fontSize: 11, color: '#64748b', width: 56, textAlign: 'right', flexShrink: 0 }}>{d.sym}</span>
                <span style={{ fontFamily: DMONO, fontSize: 12, color: '#94a3b8', width: 72, textAlign: 'right', flexShrink: 0 }}>{d.value}</span>
                <span style={{ fontFamily: DMONO, fontSize: 13, fontWeight: 600, color: c, width: 72, textAlign: 'right', flexShrink: 0 }}>{d.vs200}</span>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

// ── Breadth card unified stat boxes (3 boxes: NYSE KPIs | Days in Zone | Sector count) ──
// sectorCount / sectorTotal come from card.sectorTable (live scores data) — avoids D1 lag
function BreadthStatBoxes({ sectorCount = null, sectorTotal = 11 }) {
  const [nyse, setNyse] = useStateD(null);

  useEffectD(() => {
    let alive = true;
    fetch('/api/breadth-history?range=1y').then(r => r.json())
      .then(j => { if (alive && j?.summary) setNyse(j.summary); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  const colNyse    = (v) => v >= 70 ? '#22c55e' : v >= 40 ? '#f59e0b' : '#ef4444';
  const colSec     = (v) => v >= 8  ? '#22c55e' : v >  5  ? '#f59e0b' : '#ef4444';
  const curMmth    = nyse?.currentMmth;
  const curMmfi    = nyse?.currentMmfi;
  const daysInZone = nyse?.daysInZone;
  const secColor   = sectorCount != null ? colSec(sectorCount) : '#64748b';
  const secLabel   = sectorCount != null ? (sectorCount >= 8 ? 'Bullish breadth' : sectorCount > 5 ? 'Mixed breadth' : 'Bearish breadth') : 'of 11 SPDR sector ETFs';

  const box = { background: '#0d1520', border: '1px solid #1e2d3d', borderRadius: 12, padding: '14px 14px' };
  const val = (c) => ({ fontFamily: DMONO, fontSize: 20, fontWeight: 700, color: c });
  const lab = { fontFamily: DSANS, fontSize: 12, color: '#94a3b8', marginTop: 5 };
  const sub = { fontFamily: DSANS, fontSize: 10.5, color: '#8295a9', marginTop: 2 };
  const div = { margin: '10px 0', borderTop: '1px solid #1e2d3d' };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
      {/* Box 1: $MMTH + $MMFI */}
      <div style={box}>
        <div style={val(curMmth != null ? colNyse(curMmth) : '#64748b')}>{curMmth != null ? curMmth.toFixed(1) + '%' : '—'}</div>
        <div style={lab}>$MMTH (200d)</div>
        <div style={sub}>% NYSE above 200d SMA</div>
        <div style={div} />
        <div style={val(curMmfi != null ? colNyse(curMmfi) : '#64748b')}>{curMmfi != null ? curMmfi.toFixed(1) + '%' : '—'}</div>
        <div style={lab}>$MMFI (50d)</div>
        <div style={sub}>% NYSE above 50d SMA</div>
      </div>
      {/* Box 2: Days in Zone */}
      <div style={box}>
        <div style={val('#e2e8f0')}>{daysInZone != null ? String(daysInZone) : '—'}</div>
        <div style={lab}>Days in Zone</div>
        <div style={sub}>consecutive days at current level</div>
      </div>
      {/* Box 3: Sector count — sourced from card.sectorTable (live scores data) */}
      <div style={box}>
        <div style={val(secColor)}>{sectorCount != null ? `${sectorCount} / ${sectorTotal}` : '—'}</div>
        <div style={lab}>Sectors above 200d MA</div>
        <div style={sub}>{secLabel}</div>
      </div>
    </div>
  );
}

// ── NYSE Breadth — $MMTH & $MMFI V2-style chart (breadth card only) ──
const NYSE_BREADTH_RANGES = ['1M', '3M', '6M', '1Y', '5Y', '10Y'];
function NyseBreadthChart() {
  const RMAP = { '1M': '1mo', '3M': '3mo', '6M': '6mo', '1Y': '1y', '5Y': '5y', '10Y': '10y' };
  const [range, setRange] = useStateD('5Y');
  const [live, setLive] = useStateD(null);
  const [summary, setSummary] = useStateD(null);
  const [noData, setNoData] = useStateD(false);

  useEffectD(() => {
    let alive = true;
    setLive(null);
    setNoData(false);
    fetch(`/api/breadth-history?range=${RMAP[range]}`)
      .then(r => r.json())
      .then(j => {
        if (!alive) return;
        if (Array.isArray(j.mmth) && j.mmth.length) {
          setLive({
            values: j.mmth,
            dates:  j.dates || [],
            label:  '$MMTH (200d)',
            format: 'pct_abs',
            lineColor: '#f59e0b',
            overlays: [{ label: '$MMFI (50d)', values: j.mmfi || [], color: '#60a5fa', dash: null }],
            thresholds: [{ y: 70, color: '#22c55e' }, { y: 40, color: '#ef4444' }],
          });
        } else {
          setNoData(true);
        }
        if (j.summary) setSummary(j.summary);
      })
      .catch(() => {});
    return () => { alive = false; };
  }, [range]);

  const col = (v) => v >= 70 ? '#22c55e' : v >= 40 ? '#f59e0b' : '#ef4444';
  const curMmth  = summary?.currentMmth;
  const fakeCard = { seed: 3, trend: 0, metric: 'NYSE Breadth — $MMTH & $MMFI', metricUnit: '% NYSE stocks above key moving averages', metricVal: '' };

  return (
    <div style={{ background: '#0d1520', border: '1px solid #1e2d3d', borderRadius: 16, padding: '18px 20px 16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
          <div>
            <div style={{ fontFamily: DSANS, fontSize: 14, color: '#cbd5e1', fontWeight: 600 }}>NYSE Breadth — $MMTH &amp; $MMFI</div>
            <div style={{ fontFamily: DSANS, fontSize: 11.5, color: '#8295a9', marginTop: 2 }}>% NYSE stocks above key moving averages</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
            <span style={{ fontFamily: DMONO, fontSize: 11, color: '#94a3b8' }}>MMTH</span>
            <span style={{ fontFamily: DMONO, fontSize: 13, fontWeight: 600, color: curMmth != null ? col(curMmth) : '#f59e0b' }}>
              {curMmth != null ? curMmth.toFixed(1) + '%' : '—'}
            </span>
          </div>
        </div>
        {noData
        ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 230, gap: 8 }}>
            <div style={{ fontFamily: DSANS, fontSize: 13, color: '#8295a9' }}>No data for {range} range</div>
            <div style={{ fontFamily: DSANS, fontSize: 11.5, color: '#334155' }}>$MMTH / $MMFI data needs a TradingView CSV refresh</div>
          </div>
        )
        : <DeepChartLg card={fakeCard} cardId="breadth" color="#f59e0b" height={230} range={range} setRange={setRange} live={live} ranges={NYSE_BREADTH_RANGES} />
      }
      {/* range buttons still show so user can switch away from the empty range */}
      {noData && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 3, marginTop: 12, flexWrap: 'wrap' }}>
          {NYSE_BREADTH_RANGES.map((r) => (
            <button key={r} onClick={() => setRange(r)} style={{ all: 'unset', cursor: 'pointer', padding: '5px 10px', borderRadius: 7,
              background: r === range ? '#1e2d3d' : 'transparent',
              color: r === range ? '#e8edf5' : '#64748b',
              fontFamily: DSANS, fontSize: 12, fontWeight: r === range ? 600 : 400,
            }}>{r}</button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Sector ETF Breadth historical chart — V2 style via DeepChartLg (breadth card only) ──
// liveSectorCount: passed from DeepDiveContent via card.sectorTable (live scores); injected as
// today's final data point so the chart end matches the Sector Breakdown table (D1 history can lag).
function SectorBreadthChart({ liveSectorCount = null }) {
  const RMAP = { '1W': '1wk', '1M': '1mo', '3M': '3mo', '6M': '6mo', '1Y': '1y', '5Y': '5y', '10Y': '10y' };
  const [range, setRange] = useStateD('5Y');
  const [rawData, setRawData] = useStateD(null);

  useEffectD(() => {
    let alive = true;
    setRawData(null);
    const today = new Date().toISOString().slice(0, 10);
    fetch(`/api/sector-breadth-history?range=${RMAP[range]}&d=${today}`)
      .then(r => r.json())
      .then(j => {
        if (!alive || !Array.isArray(j.above) || !j.above.length) return;
        setRawData({ dates: j.dates || [], above: j.above });
      })
      .catch(() => {});
    return () => { alive = false; };
  }, [range]);

  const col = (v) => v >= 8 ? '#22c55e' : v > 5 ? '#f59e0b' : '#ef4444';
  const fakeCard = { seed: 4, trend: 0, metric: 'Sector ETF Breadth — Historical', metricUnit: '# of 11 SPDR sectors above their 200d MA', metricVal: '' };

  // Build live obj at render time so liveSectorCount prop changes update immediately without re-fetch
  let live = null;
  let curVal = null;
  if (rawData) {
    let { dates, above } = rawData;
    if (liveSectorCount != null) {
      const today = new Date().toISOString().slice(0, 10);
      const lastDate = dates[dates.length - 1];
      if (!lastDate || lastDate < today) {
        dates = [...dates, today];
        above = [...above, liveSectorCount];
      } else {
        above = [...above.slice(0, -1), liveSectorCount];
      }
    }
    curVal = above[above.length - 1];
    live = {
      values: above, dates,
      label: 'Sectors above 200d MA', format: 'count',
      lineColor: col(curVal), colorBy: above, colorByFn: col,
      thresholds: [{ y: 8, color: '#22c55e' }, { y: 5, color: '#ef4444' }],
    };
  }

  return (
    <div style={{ background: '#0d1520', border: '1px solid #1e2d3d', borderRadius: 16, padding: '18px 20px 16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <div>
          <div style={{ fontFamily: DSANS, fontSize: 14, color: '#cbd5e1', fontWeight: 600 }}>Sector ETF Breadth — Historical</div>
          <div style={{ fontFamily: DSANS, fontSize: 11.5, color: '#8295a9', marginTop: 2 }}># of 11 SPDR sectors above their 200d MA</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
          <span style={{ fontFamily: DMONO, fontSize: 11, color: '#94a3b8' }}>Sectors</span>
          <span style={{ fontFamily: DMONO, fontSize: 13, fontWeight: 600, color: curVal != null ? col(curVal) : '#64748b' }}>
            {curVal != null ? `${curVal} / 11` : '—'}
          </span>
        </div>
      </div>
      <DeepChartLg card={fakeCard} cardId="breadth-etf" color={curVal != null ? col(curVal) : '#f59e0b'} height={200} range={range} setRange={setRange} live={live} />
    </div>
  );
}

// ── Leadership price history chart — pair selector (Market/Tech/Style) + 20/50/200d range ──
const LP_PAIRS = {
  market: { label: 'Market Breadth', primary: 'RSP',  pColor: '#a855f7', overlay: 'SPY',  oColor: '#22d3ee', note: 'RSP vs SPY',
    desc: 'Market: The equal-weighted RSP versus the cap-weighted SPY, 20/50/200 day percentage return window' },
  tech:   { label: 'Tech Breadth',   primary: 'QQEW', pColor: '#818cf8', overlay: 'QQQ',  oColor: '#22c55e', note: 'QQEW vs QQQ',
    desc: 'Technology: The equal-weighted QQEW versus the cap-weighted QQQ, 20/50/200 day percentage return window' },
  style:  { label: 'Style Bias',     primary: 'IVE',  pColor: '#f59e0b', overlay: 'IVW',  oColor: '#ef4444', note: 'IVW vs IVE',
    desc: 'Style: High Value IVE (low P/E, high dividend yield, asset-heavy) versus high Growth IVW (high P/E, revenue and price momentum), 20/50/200 day percentage return window' },
};

function LeadershipPriceChart() {
  const [range, setRange] = useStateD('20D');
  const [pair,  setPair]  = useStateD('market');
  const [rawData, setRawData] = useStateD(null);

  useEffectD(() => {
    let alive = true;
    fetch('/api/leadership?range=1y')
      .then(r => r.json())
      .then(j => {
        if (!alive || !j.prices || !Array.isArray(j.dates) || !j.dates.length) return;
        setRawData({ dates: j.dates, prices: j.prices });
      })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  const DAYS = { '20D': 20, '50D': 50, '200D': 200 };

  const live = (() => {
    if (!rawData) return null;
    const cfg = LP_PAIRS[pair];
    const n   = Math.min(DAYS[range] || 20, rawData.dates.length);
    const rebase = (sym) => {
      const sliced = (rawData.prices[sym] || []).slice(-n);
      const first  = sliced.find(v => v != null && v > 0);
      if (!first) return sliced;
      return sliced.map(v => v == null ? null : ((v - first) / first) * 100);
    };
    return {
      values:     rebase(cfg.primary),
      dates:      rawData.dates.slice(-n),
      label:      cfg.primary,
      format:     'pct',
      lineColor:  cfg.pColor,
      overlays:   [{ label: cfg.overlay, values: rebase(cfg.overlay), color: cfg.oColor, dash: null }],
      thresholds: [{ y: 0, color: '#475569' }],
    };
  })();

  const cfg = LP_PAIRS[pair];
  const fakeCard = { seed: 6, trend: 0, metric: cfg.label, metricUnit: '% return from window open', metricVal: '' };
  const btnStyle = (active) => ({
    all: 'unset', cursor: 'pointer', padding: '4px 11px', borderRadius: 7,
    fontFamily: DSANS, fontSize: 11.5, fontWeight: 600,
    color: active ? '#e8edf5' : '#64748b',
    background: active ? '#1b2736' : 'transparent',
    border: `1px solid ${active ? '#243446' : 'transparent'}`,
  });

  return (
    <div style={{ background: '#0d1520', border: '1px solid #1e2d3d', borderRadius: 16, padding: '18px 20px 16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <div>
          <div style={{ fontFamily: DSANS, fontSize: 14, color: '#cbd5e1', fontWeight: 600 }}>{cfg.label}</div>
          <div style={{ fontFamily: DSANS, fontSize: 11, color: '#8295a9', marginTop: 2, lineHeight: 1.45 }}>{cfg.desc}</div>
        </div>
        <div style={{ display: 'flex', gap: 3 }}>
          {[['market','Market'],['tech','Tech'],['style','Style']].map(([key, lbl]) => (
            <button key={key} style={btnStyle(pair === key)} onClick={() => setPair(key)}>{lbl}</button>
          ))}
        </div>
      </div>
      <DeepChartLg card={fakeCard} cardId={`leadership-prices-${pair}`} color={cfg.pColor} height={230} range={range} setRange={setRange} live={live} ranges={['20D', '50D', '200D']} showDelta={true} />
    </div>
  );
}

// ── Equities MA position summary (3 boxes: above both / above 200d only / below 200d) ──
function EquitiesMASummary({ rows }) {
  if (!rows || !rows.length) return null;
  const aboveBoth = rows.filter(r => r[3] === 'bullish').length;
  const above200  = rows.filter(r => r[3] === 'neutral').length;
  const below200  = rows.filter(r => r[3] === 'bearish').length;
  const boxes = [
    { label: 'Above Both MAs',  value: aboveBoth, sub: '50d & 200d SMA',  color: '#22c55e' },
    { label: 'Above 200d Only', value: above200,  sub: 'Lagging 50d SMA', color: '#f59e0b' },
    { label: 'Below 200d',      value: below200,  sub: 'In bear territory', color: '#ef4444' },
  ];
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
      {boxes.map(({ label, value, sub, color }) => (
        <div key={label} style={{ background: '#0d1520', border: '1px solid #1e2d3d', borderRadius: 12, padding: '18px 16px' }}>
          <div style={{ fontFamily: DSANS, fontSize: 10, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: '#8295a9', marginBottom: 12 }}>{label}</div>
          <div style={{ fontFamily: DMONO, fontSize: 34, fontWeight: 700, color, lineHeight: 1 }}>{value}</div>
          <div style={{ fontFamily: DSANS, fontSize: 12, color: '#64748b', marginTop: 10 }}>{sub}</div>
        </div>
      ))}
    </div>
  );
}

// ── Equities multi-series normalized performance chart ──
const EQ_META = [
  ['SPY',  'S&P 500',        '#94a3b8'],
  ['IWM',  'Russell 2000',   '#64748b'],
  ['NVDA', 'Nvidia',         '#818cf8'],
  ['JPM',  'JPMorgan',       '#22c55e'],
  ['CAT',  'Caterpillar',    '#f97316'],
  ['XOM',  'Exxon Mobil',    '#ef4444'],
  ['FCX',  'Freeport-Mc.',   '#d97706'],
  ['GDX',  'Gold Miners',    '#eab308'],
  ['CCJ',  'Cameco',         '#06b6d4'],
  ['EEM',  'Emerg. Markets', '#a855f7'],
];
const EQ_COLOR = Object.fromEntries(EQ_META.map(([s, , c]) => [s, c]));

function EquitiesChart() {
  const RMAP   = { '10Y': '10y', '5Y': '5y', '1Y': '1y', '6M': '6mo', '3M': '3mo' };
  const RANGES = ['10Y', '5Y', '1Y', '6M', '3M'];
  const [range, setRange] = useStateD('5Y');
  const [data, setData]   = useStateD(null);
  const [hidden, setHidden] = useStateD({});
  const [hover, setHover]   = useStateD(null);
  const svgRef = useRefD(null);

  useEffectD(() => {
    let alive = true;
    setData(null);
    const today = new Date().toISOString().slice(0, 10);
    fetch(`/api/equities-history?range=${RMAP[range]}&d=${today}`)
      .then(r => r.json())
      .then(d => { if (alive && d.equities) setData(d); })
      .catch(() => {});
    return () => { alive = false; };
  }, [range]);

  const W = 720, H = 250, top = 12, bot = 26, padR = 4;

  let seriesNorm = null, gMin = 100, gMax = 100;
  if (data) {
    const allVals = data.equities.flatMap(e => e.prices).filter(v => v != null && !isNaN(v));
    if (allVals.length) { gMin = Math.min(...allVals); gMax = Math.max(...allVals); }
    const span = gMax - gMin || 1;
    const norm = v => v != null ? 0.07 + ((v - gMin) / span) * 0.86 : null;
    seriesNorm = data.equities.map(e => ({ sym: e.sym, label: e.label, nrm: e.prices.map(norm), raw: e.prices }));
  }

  const n  = data ? data.dates.length : 0;
  const dx = n > 1 ? (W - padR) / (n - 1) : 1;
  const yy = p => p != null ? top + (1 - p) * (H - top - bot) : null;
  const path = arr => {
    let d = '';
    arr.forEach((p, i) => { if (p != null) d += `${(i === 0 || arr[i - 1] == null) ? 'M' : 'L'}${(i * dx).toFixed(1)},${yy(p).toFixed(1)}`; });
    return d;
  };
  const onMove = e => {
    const el = svgRef.current;
    if (!el || n < 2) return;
    const rect = el.getBoundingClientRect();
    setHover(Math.max(0, Math.min(n - 1, Math.round(((e.clientX - rect.left) / rect.width) * (n - 1)))));
  };

  return (
    <div style={{ background: '#0d1520', border: '1px solid #1e2d3d', borderRadius: 16, padding: '18px 20px 16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <div>
          <div style={{ fontFamily: DSANS, fontSize: 14, color: '#cbd5e1', fontWeight: 600 }}>Watchlist Performance</div>
          <div style={{ fontFamily: DSANS, fontSize: 11.5, color: '#8295a9', marginTop: 2 }}>Normalized (100 = period start)</div>
        </div>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontFamily: DSANS, fontSize: 10.5, color: '#8295a9' }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: data ? '#22c55e' : '#64748b', boxShadow: data ? '0 0 6px #22c55e' : 'none' }} />
          {data ? 'Live' : 'Loading…'}
        </span>
      </div>

      <div style={{ position: 'relative' }} onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
        <svg ref={svgRef} width="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ display: 'block', height: H }}>
          {[0.2, 0.4, 0.6, 0.8].map(g => <line key={g} x1="0" x2={W} y1={top + g * (H - top - bot)} y2={top + g * (H - top - bot)} stroke="#16202e" strokeWidth="1" strokeDasharray="2 5" />)}
          <line x1="0" x2={W} y1={H - bot} y2={H - bot} stroke="#1e2d3d" strokeWidth="1" />
          {/* 100 baseline dashed line */}
          {seriesNorm && (() => { const by = top + (1 - (0.07 + ((100 - gMin) / (gMax - gMin || 1)) * 0.86)) * (H - top - bot); return <line x1="0" x2={W} y1={by.toFixed(1)} y2={by.toFixed(1)} stroke="#334155" strokeWidth="1" strokeDasharray="4 3" />; })()}
          {/* Series lines */}
          {seriesNorm && seriesNorm.map(({ sym, nrm }) => !hidden[sym] && (
            <path key={sym} d={path(nrm)} fill="none" stroke={EQ_COLOR[sym] || '#64748b'} strokeWidth="1.8"
              strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
          ))}
          {/* Crosshair */}
          {hover != null && <line x1={(hover * dx).toFixed(1)} x2={(hover * dx).toFixed(1)} y1={top} y2={H - bot} stroke="#334155" strokeWidth="1" strokeDasharray="2 3" pointerEvents="none" />}
          {/* Hover dots */}
          {hover != null && seriesNorm && seriesNorm.map(({ sym, nrm }) => !hidden[sym] && nrm[hover] != null && (
            <circle key={sym} cx={(hover * dx).toFixed(1)} cy={yy(nrm[hover]).toFixed(1)} r="3.5" fill={EQ_COLOR[sym] || '#64748b'} stroke="#080c14" strokeWidth="1.5" pointerEvents="none" />
          ))}
          {/* Latest-point dots */}
          {hover == null && seriesNorm && seriesNorm.map(({ sym, nrm }) => !hidden[sym] && nrm[n - 1] != null && (
            <circle key={sym} cx={((n - 1) * dx).toFixed(1)} cy={yy(nrm[n - 1]).toFixed(1)} r="3" fill={EQ_COLOR[sym] || '#64748b'} />
          ))}
        </svg>

        {/* Tooltip */}
        {hover != null && data?.dates?.[hover] && seriesNorm && (
          <div style={{
            position: 'absolute', top: 10, pointerEvents: 'none', zIndex: 10,
            ...(hover / Math.max(n - 1, 1) > 0.55
              ? { right: `calc(${(1 - hover / Math.max(n - 1, 1)) * 100}% + 14px)` }
              : { left:  `calc(${(hover / Math.max(n - 1, 1)) * 100}% + 14px)` }),
            background: '#0d1520', border: '1px solid #1e2d3d', borderRadius: 10,
            padding: '10px 14px', minWidth: 175, boxShadow: '0 8px 24px rgba(0,0,0,.5)',
          }}>
            <div style={{ fontFamily: DSANS, fontSize: 11, color: '#64748b', marginBottom: 8, fontWeight: 600 }}>{data.dates[hover]}</div>
            {[...seriesNorm]
              .filter(({ sym }) => !hidden[sym])
              .sort((a, b) => (b.raw[hover] ?? 0) - (a.raw[hover] ?? 0))
              .map(({ sym, label, raw }) => raw[hover] != null && (
                <div key={sym} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 20, marginBottom: 4 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: EQ_COLOR[sym], flexShrink: 0 }} />
                    <span style={{ fontFamily: DSANS, fontSize: 11.5, color: '#94a3b8' }}>{label}</span>
                  </span>
                  <span style={{ fontFamily: DMONO, fontSize: 12, color: '#e8edf5', fontWeight: 600 }}>{raw[hover].toFixed(1)}</span>
                </div>
              ))}
          </div>
        )}
      </div>

      {/* Range buttons */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 3, marginTop: 12, flexWrap: 'wrap' }}>
        {RANGES.map(r => (
          <button key={r} onClick={() => setRange(r)} style={{ all: 'unset', cursor: 'pointer', padding: '5px 10px', borderRadius: 7,
            fontFamily: DMONO, fontSize: 11.5, fontWeight: 600, color: r === range ? '#e8edf5' : '#64748b',
            background: r === range ? '#1b2736' : 'transparent', border: `1px solid ${r === range ? '#243446' : 'transparent'}` }}>{r}</button>
        ))}
      </div>

      {/* Legend — wrapping grid, click to toggle */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 22px', marginTop: 14 }}>
        {EQ_META.map(([sym, label, c]) => {
          const isHidden = hidden[sym];
          return (
            <button key={sym} onClick={() => setHidden(h => ({ ...h, [sym]: !h[sym] }))}
              style={{ all: 'unset', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 7, opacity: isHidden ? 0.3 : 1, transition: 'opacity .15s' }}>
              <svg width="18" height="4" viewBox="0 0 18 4" style={{ flexShrink: 0 }}><rect x="0" y="0" width="18" height="4" rx="2" fill={c} /></svg>
              <span style={{ fontFamily: DSANS, fontSize: 11.5, color: isHidden ? '#64748b' : '#94a3b8' }}>{label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Regime card — Market Diagnostics: one static question per Regime Metrics box ──
function buildRegimeDiagnostics(card) {
  const rows = card.rows || [];   // [label, value, condition, status, indicator]
  const stats = card.stats || []; // [label, value, desc, tone]
  const r1 = rows[0], r2 = rows[1], r3 = rows[2];
  const findStat = (label) => stats.find((s) => s[0] === label);
  const pctStat = findStat('Percentile Rank');
  const durStat = findStat('Regime Duration');
  const velStat = findStat('Extension Velocity');
  const toneOfStatus = (status) => status === 'bullish' ? '#22c55e' : status === 'bearish' ? '#ef4444' : '#f59e0b';
  const toneOfStat = (tone) => tone === 'pos' ? '#22c55e' : tone === 'neg' ? '#ef4444' : '#f59e0b';

  // Parse the raw numbers back out of the formatted stat strings so we can attach an action.
  const pctNum = pctStat ? parseInt(pctStat[1], 10) : null;
  const durNum = durStat ? parseInt(durStat[1], 10) : null;
  const velNum = velStat ? parseFloat(velStat[1]) : null;

  const pctAction = pctNum == null ? null
    : pctNum >= 90 ? 'Reduce Exposure'
    : pctNum >= 70 ? 'Monitor for Reversion'
    : pctNum <= 10 ? 'Watch for Bounce'
    : pctNum <= 30 ? 'Watch for Reversal'
    : 'No Action';
  const durAction = durNum == null ? null
    : durNum > 250 ? 'Trail Stops'
    : durNum > 60  ? 'Hold Core'
    : durNum < 10  ? 'Await Confirmation'
    : 'Monitor';
  const velAction = velNum == null ? null
    : velNum > 0.05  ? 'Monitor Stretch'
    : velNum < -0.05 ? 'Pressure Easing'
    : 'No Signal Change';

  return [
    { label: 'SPY Regime', q: 'How is the prevailing market environment categorized?', a: r1 ? r1[2] : '—', c: r1 ? toneOfStatus(r1[3]) : '#94a3b8' },
    { label: 'Stretch Risk', q: 'To what degree has the market become overextended?', a: r2 ? r2[2] : '—', c: r2 ? toneOfStatus(r2[3]) : '#94a3b8' },
    { label: 'Trend Cross', q: 'Has the present market trend been confirmed?', a: r3 ? r3[2] : '—', c: r3 ? toneOfStatus(r3[3]) : '#94a3b8' },
    { label: 'Percentile Rank', q: 'Define the current period in context to historical precedents?', a: pctStat ? `${pctStat[1]} percentile of all historical days — ${pctAction}` : '—', c: pctStat ? toneOfStat(pctStat[3]) : '#94a3b8' },
    { label: 'Regime Duration', q: 'How persistent is the present market cycle?', a: durStat ? `${durStat[1]} ${durStat[2]} — ${durAction}` : '—', c: durStat ? toneOfStat(durStat[3]) : '#94a3b8' },
    { label: 'Extension Velocity', q: 'Is market momentum accelerating or decelerating?', a: velStat ? `${velStat[1]} (${velStat[2]}) — ${velAction}` : '—', c: velStat ? toneOfStat(velStat[3]) : '#94a3b8' },
  ];
}

// ── Regime card — builds both rows of 6 stat boxes with [label, value, indicator, tone, condition] ──
function buildRegimeMetrics(card) {
  const rows  = card.rows  || [];
  const stats = card.stats || [];
  const findStat = (label) => stats.find((s) => s[0] === label);
  const pctStat = findStat('Percentile Rank');
  const durStat = findStat('Regime Duration');
  const velStat = findStat('Extension Velocity');

  const pctNum = pctStat ? parseInt(pctStat[1], 10) : null;
  const durNum = durStat ? parseInt(durStat[1], 10) : null;
  const velNum = velStat ? parseFloat(velStat[1]) : null;
  const pctAction = pctNum == null ? '—' : pctNum >= 90 ? 'Reduce Exposure' : pctNum >= 70 ? 'Monitor for Reversion' : pctNum <= 10 ? 'Watch for Bounce' : pctNum <= 30 ? 'Watch for Reversal' : 'No Action';
  const durAction = durNum == null ? '—' : durNum > 250 ? 'Trail Stops' : durNum > 60 ? 'Hold Core' : durNum < 10 ? 'Await Confirmation' : 'Monitor';
  const velAction = velNum == null ? '—' : velNum > 0.05 ? 'Monitor Stretch' : velNum < -0.05 ? 'Pressure Easing' : 'No Signal Change';

  const row1Triggers = [
    [{ label: 'Bullish', text: 'SPY > 200d SMA', color: '#22c55e' }, { label: 'Bearish', text: 'SPY < 200d SMA', color: '#ef4444' }],
    [
      { label: 'Bearish', text: 'Overextended  > +14%',          color: '#ef4444' },
      { label: 'Neutral', text: 'Extended  +10% to +14%',        color: '#f59e0b' },
      { label: 'Bullish', text: 'Normal Bull  0% to +10%',       color: '#22c55e' },
      { label: 'Neutral', text: 'Bearish Retest  -10% to 0%',   color: '#f59e0b' },
      { label: 'Bearish', text: 'Deeply Oversold  < -10%',       color: '#ef4444' },
    ],
    [
      { label: 'Bullish', text: 'Golden Cross  50d SMA > 200d SMA', color: '#22c55e' },
      { label: 'Bearish', text: 'Death Cross  50d SMA < 200d SMA',  color: '#ef4444' },
    ],
  ];

  const d = card.deltas || {};
  const row1Dirs = [d.v200 || null, d.v200 || null, d.crossSpread || null];

  // ── Warning: value within margin of a status-change threshold AND trending toward it ──
  // Approaching: (val < threshold && dir === 'up') || (val > threshold && dir === 'down')
  const approaching = (val, threshold, dir) =>
    val != null && dir != null && dir !== 'flat' &&
    ((val < threshold && dir === 'up') || (val > threshold && dir === 'down'));
  const nearAny = (val, thresholds, dir, margin) =>
    thresholds.some(t => Math.abs(val - t) <= margin && approaching(val, t, dir));

  // SPY Regime: parse "755.14 vs 684.67" to compute raw v200 pct, warn within 2% of 0
  const spyM = (rows[0]?.[1] || '').match(/([\d.]+)\s+vs\s+([\d.]+)/);
  const spyV200pct = spyM ? (parseFloat(spyM[1]) - parseFloat(spyM[2])) / parseFloat(spyM[2]) * 100 : null;
  const warnSpy = spyV200pct != null && Math.abs(spyV200pct) <= 2 && approaching(spyV200pct, 0, d.v200);

  // Stretch Risk: parse "+10.29%" → float, warn within 1.5% of 14, 10, 0, -10
  const stretchVal = parseFloat((rows[1]?.[1] || '').replace('%', ''));
  const warnStretch = !isNaN(stretchVal) && nearAny(stretchVal, [14, 10, 0, -10], d.v200, 1.5);

  // Trend Cross: parse "+5.9%" → float, warn within 1% of 0
  const crossVal = parseFloat((rows[2]?.[1] || '').replace('%', ''));
  const warnCross = !isNaN(crossVal) && Math.abs(crossVal) <= 1 && approaching(crossVal, 0, d.crossSpread);

  // Percentile Rank: parse "78th" → int, warn within 5 pts of 80 or 20
  const warnPct = pctNum != null && nearAny(pctNum, [80, 20], d.v200, 5);

  // Regime Duration: parse days int, warn within 10 days of 30, 150, 400
  const warnDur = durNum != null && nearAny(durNum, [30, 150, 400], d.duration, 10);

  // Extension Velocity: velNum already a float, warn within 0.5% of any zone boundary
  const warnVel = velNum != null && nearAny(velNum, [12, 8, 2, 0, -2, -6, -10, -15], d.velocity, 0.5);

  const row1 = rows.slice(0, 3).map((r, idx) => {
    const [label, value, condition, status, indicator] = r;
    const tone = status === 'bullish' ? 'pos' : status === 'bearish' ? 'neg' : null;
    const warn = [warnSpy, warnStretch, warnCross][idx];
    return [label, value, indicator || '', tone, condition || '—', row1Triggers[idx], row1Dirs[idx], warn];
  });

  const row2Triggers = [
    [
      { label: 'Extreme High', text: 'Historically extreme extension  > 80th Percentile',  color: '#f59e0b' },
      { label: 'Normal',       text: 'Normal historical range  20th – 80th Percentile',     color: '#22c55e' },
      { label: 'Extreme Low',  text: 'Historically extreme oversold  < 20th Percentile',    color: '#ef4444' },
    ],
    [
      { label: 'Short',     text: '< 30 days  Freshly established, fragile',          color: '#f59e0b' },
      { label: 'Moderate',  text: '30 – 150 days  Building credibility',               color: '#22c55e' },
      { label: 'Extended',  text: '150 – 300+ days  Deeply entrenched',               color: '#22c55e' },
      { label: 'Very Long', text: '400+ days  Late-cycle characteristic',              color: '#f59e0b' },
    ],
    [
      { label: 'Exhaustion',        text: '> +12%  Extreme risk — take profit',                 color: '#ef4444' },
      { label: 'Overextended',      text: '+8% to +12%  High risk — tighten stops',             color: '#f59e0b' },
      { label: 'Healthy Bullish',   text: '+2% to +8%  Sweet spot — buy pullbacks',             color: '#22c55e' },
      { label: 'Macro Crossroads',  text: '0% to +2%  Market resting — watch breadth',          color: '#f59e0b' },
      { label: 'Breakdown Zone',    text: '0% to -2%  Trend snapping — no new positions',       color: '#f59e0b' },
      { label: 'Confirmed Bear',    text: '-2% to -6%  Structural downtrend — sell if 3 days',  color: '#ef4444' },
      { label: 'Deep Correction',   text: '-6% to -10%  Systemic selling — rallies short-lived',color: '#ef4444' },
      { label: 'Capitulation',      text: '-10% to -15%  Severe panic — expect bounce',         color: '#ef4444' },
      { label: 'Systemic Bottom',   text: '< -15%  Generational value — deeply oversold',       color: '#f59e0b' },
    ],
  ];

  const row2 = [
    pctStat ? [pctStat[0], pctStat[1], pctStat[2], pctStat[3], pctAction, row2Triggers[0], d.v200     || null, warnPct]  : ['Percentile Rank',   '—', '', null, '—', null, null, false],
    durStat ? [durStat[0], durStat[1], durStat[2], durStat[3], durAction, row2Triggers[1], d.duration || null, warnDur]  : ['Regime Duration',    '—', '', null, '—', null, null, false],
    velStat ? [velStat[0], velStat[1], velStat[2], velStat[3], velAction, row2Triggers[2], d.velocity || null, warnVel]  : ['Extension Velocity', '—', '', null, '—', null, null, false],
  ];

  return { row1, row2 };
}

function buildLeadershipMetrics(card, computedStats) {
  const rows = card.rows || [];

  const parseSpread = (val) => {
    const nums = (val || '').match(/[+-]?\d+\.?\d*/g);
    if (!nums || nums.length < 2) return null;
    const a = parseFloat(nums[0]);
    const b = parseFloat(nums[1]);
    return isNaN(a) || isNaN(b) ? null : a - b;
  };
  const fmtSpread = (v) => v == null ? '—' : (v >= 0 ? '+' : '') + v.toFixed(1) + '%';

  const row1 = rows.slice(0, 3).map((r) => {
    const [label, rawVal, condition, status, indicator] = r;
    const spread   = parseSpread(rawVal);
    const value    = fmtSpread(spread);
    const tone     = status === 'bullish' ? 'pos' : status === 'bearish' ? 'neg' : null;
    const indShort = (indicator || '').replace(/\s*—\s*20d Return/, ' 20d');
    return [label, value, indShort, tone, condition || '—', null];
  });

  const row2 = (computedStats || card.stats || []).slice(0, 3);

  return { row1, row2 };
}

// ── Full deep-dive content (chart + regime timeline + stats + indicators) — shared by all options ──
function DeepDiveContent({ card, cardId, asOf, chartHeight = 230 }) {
  const sg = DSIG[card.status];
  const [range, setRange] = useStateD('1Y');
  const [live, setLive] = useStateD(null);
  const [regimeLive, setRegimeLive] = useStateD(null);
  const [qcRange, setQcRange] = useStateD('20D');
  const [lpriceData, setLpriceData] = useStateD(null);

  useEffectD(() => {
    let alive = true;
    setLive(null);
    if (window.MarketHubData && cardId) {
      window.MarketHubData.loadHistory(cardId, range).then((r) => {
        if (alive && r && r.values && r.values.length > 1) setLive(r);
      });
    }
    return () => { alive = false; };
  }, [cardId, range]);

  // Regime timeline always uses 1Y data independent of the chart range selector
  useEffectD(() => {
    let alive = true;
    setRegimeLive(null);
    if (window.MarketHubData && cardId) {
      window.MarketHubData.loadHistory(cardId, '1Y').then((r) => {
        if (alive && r && r.values && r.values.length > 1) setRegimeLive(r);
      });
    }
    return () => { alive = false; };
  }, [cardId]);

  // Leadership quality check: raw 1Y prices for rebased-spread computation (same methodology as chart 1)
  useEffectD(() => {
    if (cardId !== 'leadership') return;
    let alive = true;
    fetch('/api/leadership?range=1y')
      .then(r => r.json())
      .then(j => { if (alive && j.prices && j.dates?.length) setLpriceData({ dates: j.dates, prices: j.prices }); })
      .catch(() => {});
    return () => { alive = false; };
  }, [cardId]);

  // Leadership: the chart's live series for this card is already a cumulative spread
  // over the selected range, so tie the "Spread" key metrics to that same range instead
  // of always showing the server's fixed 5Y figure. Daily Streak / Growth vs Value (no
  // chart equivalent) pass through untouched.
  const leadershipStats = (() => {
    if (cardId !== 'leadership' || !card.stats) return card.stats;
    if (!live || !live.values?.length) return card.stats;
    const rspSpread  = live.values[live.values.length - 1];
    const qqewArr    = live.overlays?.[0]?.values || [];
    const qqewSpread = qqewArr.length ? qqewArr[qqewArr.length - 1] : null;
    const fmt  = (v) => v == null ? '—' : (v >= 0 ? '+' : '') + v.toFixed(1) + '%';
    const tone = (v) => v == null ? null : v > 0 ? 'pos' : v < 0 ? 'neg' : null;
    return card.stats.map((s) => {
      const desc = (s[2] || '').toLowerCase();
      if (desc.includes('rsp vs spy'))  return [`${range} Spread`,      fmt(rspSpread),  'RSP vs SPY cumulative',  tone(rspSpread)];
      if (desc.includes('qqew vs qqq')) return [`${range} Tech Spread`, fmt(qqewSpread), 'QQEW vs QQQ cumulative', tone(qqewSpread)];
      return s;
    });
  })();

  // Leadership "Quality Check": pick the spread pair with the largest absolute divergence
  // at the selected window (20D/50D/200D) using rebased prices — same methodology as chart 1
  const qualityCheck = (() => {
    if (cardId !== 'leadership') return { live, label: null, spread: null };
    if (!lpriceData) return { live: null, label: null, spread: null };
    const DAYS = { '20D': 20, '50D': 50, '200D': 200 };
    const n = Math.min(DAYS[qcRange] || 20, lpriceData.dates.length);
    const dates = lpriceData.dates.slice(-n);
    const rebase = (sym) => {
      const sliced = (lpriceData.prices[sym] || []).slice(-n);
      const first = sliced.find(v => v != null && v > 0);
      if (!first) return sliced.map(() => null);
      return sliced.map(v => v == null ? null : ((v - first) / first) * 100);
    };
    const sub = (a, b) => a.map((v, i) => v == null || b[i] == null ? null : v - b[i]);
    const candidates = [
      { label: 'RSP vs SPY',  spreadVals: sub(rebase('RSP'),  rebase('SPY')),  color: '#a855f7' },
      { label: 'QQEW vs QQQ', spreadVals: sub(rebase('QQEW'), rebase('QQQ')),  color: '#818cf8' },
      { label: 'IVW vs IVE',  spreadVals: sub(rebase('IVW'),  rebase('IVE')),  color: '#ef4444' },
    ];
    const dom = candidates.reduce((best, c) => {
      const bv = Math.abs(best.spreadVals[best.spreadVals.length - 1] ?? 0);
      const cv = Math.abs(c.spreadVals[c.spreadVals.length - 1]    ?? 0);
      return cv > bv ? c : best;
    });
    const last = dom.spreadVals[dom.spreadVals.length - 1] ?? 0;
    const fmt  = (v) => (v >= 0 ? '+' : '') + v.toFixed(1) + '%';
    return {
      live:   { values: dom.spreadVals, dates, label: dom.label, format: 'pct', lineColor: dom.color, overlays: [], thresholds: [{ y: 0, color: '#475569' }] },
      label:  dom.label,
      spread: fmt(last),
    };
  })();

  const sectionLabel = (txt) => (
    <div style={{ fontFamily: DSANS, fontSize: 11, fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', color: '#8295a9', marginBottom: 10 }}>{txt}</div>
  );

  if (cardId === 'breadth') {
    // Breadth order: NYSE Breadth → Breadth History → Sector ETF Breadth → Sector Breakdown → Indicators → Key Metrics → Summary
    const liveSectorCount = card.sectorTable ? card.sectorTable.filter(s => s.bull).length : null;
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
        <NyseBreadthChart />
        <div>
          {sectionLabel('Breadth History')}
          <div style={{ background: '#0d1520', border: '1px solid #1e2d3d', borderRadius: 16, padding: '18px 20px 20px' }}>
            <RegimeTimeline card={card} cardId={cardId} asOf={asOf} liveData={regimeLive} />
          </div>
        </div>
        <SectorBreadthChart liveSectorCount={liveSectorCount} />
        {card.sectorTable && card.sectorTable.length > 0 && (
          <div>
            {sectionLabel('Sector Breakdown')}
            <SectorBreakdown sectorTable={card.sectorTable} />
          </div>
        )}
        <div>
          {sectionLabel('Indicators')}
          <IndicatorTable rows={card.rows} />
        </div>
        <div>
          {sectionLabel('Key Metrics')}
          <BreadthStatBoxes sectorCount={liveSectorCount} sectorTotal={card.sectorTable?.length || 11} />
        </div>
        {card.note && (
          <div>
            {sectionLabel('Summary')}
            <div style={{ background: '#0d1520', border: '1px solid #1e2d3d', borderRadius: 14, padding: '16px 20px' }}>
              <p style={{ fontFamily: DSANS, fontSize: 13.5, color: '#94a3b8', lineHeight: 1.65, margin: 0 }}>{card.note}</p>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (cardId === 'equities') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
        <EquitiesChart />
        <div>
          {sectionLabel('Equities History')}
          <div style={{ background: '#0d1520', border: '1px solid #1e2d3d', borderRadius: 16, padding: '18px 20px 20px' }}>
            <RegimeTimeline card={card} cardId={cardId} asOf={asOf} liveData={null} />
          </div>
        </div>
        <div>
          {sectionLabel('Indicators')}
          <IndicatorTable rows={card.rows} />
        </div>
        <div>
          {sectionLabel('Watchlist Summary — MA Position')}
          <EquitiesMASummary rows={card.rows} />
        </div>
        {card.note && (
          <div>
            {sectionLabel('Summary')}
            <div style={{ background: '#0d1520', border: '1px solid #1e2d3d', borderRadius: 14, padding: '16px 20px' }}>
              <p style={{ fontFamily: DSANS, fontSize: 13.5, color: '#94a3b8', lineHeight: 1.65, margin: 0 }}>{card.note}</p>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      {/* leadership-only: raw price history for all 6 underlying symbols, above the spread chart */}
      {cardId === 'leadership' && <LeadershipPriceChart />}
      {/* chart card */}
      <div style={{ background: '#0d1520', border: '1px solid #1e2d3d', borderRadius: 16, padding: '18px 20px 16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
          <div>
            <div style={{ fontFamily: DSANS, fontSize: 14, color: '#cbd5e1', fontWeight: 600 }}>
              {cardId === 'leadership' ? (qualityCheck.label || 'The Quality Check') : card.metric}
            </div>
            <div style={{ fontFamily: DSANS, fontSize: 11.5, color: '#8295a9', marginTop: 2 }}>
              {cardId === 'leadership'
                ? `Largest ${qcRange} divergence · ${qualityCheck.spread || ''}`
                : card.metricUnit}
            </div>
          </div>
          {cardId !== 'leadership' && <div style={{ fontFamily: DMONO, fontSize: 13, fontWeight: 600, color: sg.c }}>{card.metricVal}</div>}
        </div>
        <DeepChartLg card={card} cardId={cardId} color={cardId === 'leadership' ? (qualityCheck.live?.lineColor || sg.c) : sg.c} height={chartHeight}
          range={cardId === 'leadership' ? qcRange : range} setRange={cardId === 'leadership' ? setQcRange : setRange}
          live={cardId === 'leadership' ? qualityCheck.live : live}
          ranges={cardId === 'leadership' ? ['20D', '50D', '200D'] : cardId === 'regime' ? ['1W', '1M', '3M', '6M', '1Y', '5Y', '10Y', '20Y'] : undefined} />
      </div>
      {/* regime timeline — always 1Y, never tied to chart range */}
      <div>
        {sectionLabel(`${card.title} History`)}
        <div style={{ background: '#0d1520', border: '1px solid #1e2d3d', borderRadius: 16, padding: '18px 20px 20px' }}>
          <RegimeTimeline card={card} cardId={cardId} asOf={asOf} liveData={regimeLive} />
        </div>
      </div>
      {/* flags (global flows) */}
      {card.flags && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {card.flags.map((f) => (<img key={f} src={`/market-hub/assets/flags/${f}.svg`} alt={f} style={{ width: 30, height: 20, borderRadius: 3, objectFit: 'cover', border: '1px solid #1e2d3d' }} />))}
        </div>
      )}
      {/* indicators — hidden for regime and leadership (superseded by metrics boxes) */}
      {cardId !== 'regime' && cardId !== 'leadership' && (
        <div>
          {sectionLabel('Indicators')}
          <IndicatorTable rows={card.rows} />
        </div>
      )}
      {/* country breakdown — global flows card only */}
      {card.details && card.details.length > 0 && (
        <div>
          {sectionLabel('Country Breakdown')}
          <CountryTable details={card.details} />
        </div>
      )}
      {/* key metrics */}
      {card.stats && card.stats.length > 0 && (
        <div>
          {sectionLabel(cardId === 'regime' ? 'Regime Metrics' : 'Key Metrics')}
          {cardId === 'regime' ? (() => {
            const { row1, row2 } = buildRegimeMetrics(card);
            return (<><div style={{ marginBottom: 10 }}><StatBoxes stats={row1} /></div><StatBoxes stats={row2} /></>);
          })() : cardId === 'leadership' ? (() => {
            const { row1, row2 } = buildLeadershipMetrics(card, leadershipStats);
            return (<><div style={{ marginBottom: 10 }}><StatBoxes stats={row1} /></div><StatBoxes stats={row2} /></>);
          })() : (
            <StatBoxes stats={card.stats} />
          )}
        </div>
      )}
      {/* summary note */}
      {card.note && (
        <div>
          {sectionLabel(cardId === 'regime' ? 'Market Diagnostics' : 'Summary')}
          <div style={{ background: '#0d1520', border: '1px solid #1e2d3d', borderRadius: 14, padding: '18px 20px' }}>
            {cardId === 'regime' && (
              <div style={{ marginBottom: 16, paddingBottom: 16, borderBottom: '1px solid #1e2d3d' }}>
                {buildRegimeDiagnostics(card).map(({ label, q, a, c }, idx, arr) => (
                  <div key={label} style={{
                    paddingTop: idx === 0 ? 0 : 11,
                    paddingBottom: idx < arr.length - 1 ? 11 : 0,
                    borderBottom: idx < arr.length - 1 ? '1px solid #0d1e2e' : 'none',
                  }}>
                    <div style={{ fontFamily: DSANS, fontSize: 10, fontWeight: 700, letterSpacing: '.09em', textTransform: 'uppercase', color: '#334155', marginBottom: 3 }}>{label}</div>
                    <div style={{ fontFamily: DSANS, fontSize: 13, fontWeight: 600, color: c, lineHeight: 1.4, marginBottom: 4 }}>{a}</div>
                    <div style={{ fontFamily: DSANS, fontSize: 11, color: '#3d5166', lineHeight: 1.4 }}>{q}</div>
                  </div>
                ))}
              </div>
            )}
            {cardId === 'regime' && (
              <div style={{ fontFamily: DSANS, fontSize: 10, fontWeight: 700, letterSpacing: '.09em', textTransform: 'uppercase', color: '#334155', marginBottom: 7 }}>Market Narrative</div>
            )}
            <p style={{ fontFamily: DSANS, fontSize: 13, color: '#94a3b8', lineHeight: 1.7, margin: 0 }}>{card.note}</p>
          </div>
        </div>
      )}
    </div>
  );
}

Object.assign(window, { DSIG, DMONO, DSANS, postureColorD, DeepChartLg, RegimeTimeline, StatusPill, SparkD, StatBoxes, IndicatorTable, SectorBreakdown, CountryTable, BreadthStatBoxes, NyseBreadthChart, SectorBreadthChart, LeadershipPriceChart, EquitiesMASummary, EquitiesChart, DeepDiveContent });
