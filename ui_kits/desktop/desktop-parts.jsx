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
function DeepChartLg({ card, cardId, color: colorProp, height = 230, range, setRange, live }) {
  const color = live?.lineColor || colorProp;
  const ranges = ['1W', '1M', '3M', '6M', '1Y', '5Y', '10Y'];
  const [hidden, setHidden] = useStateD({});
  const [hover, setHover] = useStateD(null);
  const svgRef = useRefD(null);

  const W = 720, H = height, top = 12, bot = 26, padR = 4;
  const conf = { '1W': [7, 0.09], '1M': [24, 0.16], '3M': [44, 0.135], '6M': [56, 0.115], '1Y': [64, 0.10], '5Y': [70, 0.082], '10Y': [80, 0.07] };

  // ── Normalise all series into the same 0..1 plot space ──
  let primaryArr = [], overlayArrs = [], zeroY = null;
  if (live && live.values.length > 1) {
    const allVals = [
      ...live.values,
      ...(live.overlays || []).flatMap((o) => o.values || []),
    ].filter((v) => v != null && !isNaN(v));
    const lo = Math.min(...allVals), hi = Math.max(...allVals), span = hi - lo || 1;
    const norm = (v) => (v != null && !isNaN(v)) ? 0.07 + ((v - lo) / span) * 0.86 : null;
    primaryArr = live.values.map(norm);
    overlayArrs = (live.overlays || []).map((o) => ({ ...o, arr: (o.values || []).map(norm) }));
    if (live.format === 'pct' && lo <= 0 && hi >= 0) zeroY = norm(0);
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
    primaryArr.forEach((p, i) => {
      const v = live.colorBy[i];
      const c = (v == null || isNaN(v)) ? '#3b82f6' : v > 14 ? '#ef4444' : v < 0 ? '#f97316' : '#3b82f6';
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
  const isPrice = live?.format !== 'pct' && overlayArrs.length > 0;
  const fmtVal = (v) => live?.format === 'pct'
    ? (v >= 0 ? '+' : '') + v.toFixed(2) + '%'
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
        <span title={live ? 'Live data from /api' : 'Sample data — connect /api for live history'} style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, fontFamily: DSANS, fontSize: 10.5, color: '#475569' }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: live ? '#22c55e' : '#475569', boxShadow: live ? '0 0 6px #22c55e' : 'none' }} />
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
                <span style={{ fontFamily: DSANS, fontSize: 11.5, color: isHidden ? '#475569' : '#94a3b8' }}>{label}</span>
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
              <span style={{ fontFamily: DMONO, fontSize: 9.5, color: last ? '#cbd5e1' : '#475569', fontWeight: last ? 700 : 400 }}>{labels[i]}</span>
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
            <span style={{ marginLeft: 'auto', fontFamily: DSANS, fontSize: 11, color: '#475569', fontStyle: 'italic' }}>
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
function StatBoxes({ stats }) {
  if (!stats || !stats.length) return null;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${stats.length}, 1fr)`, gap: 10 }}>
      {stats.map((st, i) => {
        const tone = st[3] === 'pos' ? '#22c55e' : st[3] === 'neg' ? '#ef4444' : '#f59e0b';
        return (
          <div key={i} style={{ background: '#0d1520', border: '1px solid #1e2d3d', borderRadius: 12, padding: '14px 14px' }}>
            <div style={{ fontFamily: DMONO, fontSize: 20, fontWeight: 700, color: tone }}>{st[1]}</div>
            <div style={{ fontFamily: DSANS, fontSize: 12, color: '#94a3b8', marginTop: 5 }}>{st[0]}</div>
            <div style={{ fontFamily: DSANS, fontSize: 10.5, color: '#475569', marginTop: 2 }}>{st[2]}</div>
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
        <span style={{ fontFamily: DSANS, fontSize: 10, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: '#475569', width: 130, flexShrink: 0 }}>Signal</span>
        <span style={{ fontFamily: DSANS, fontSize: 10, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: '#475569', width: 220, flexShrink: 0 }}>Indicator</span>
        <span style={{ fontFamily: DSANS, fontSize: 10, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: '#475569', flex: 1 }}>Condition</span>
        <span style={{ fontFamily: DSANS, fontSize: 10, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: '#475569', width: 100, textAlign: 'right', flexShrink: 0 }}>Value</span>
      </div>
      {rows.map((r, i) => {
        const rs = DSIG[r[3]] || DSIG.neutral;
        return (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '13px 0', borderBottom: i < rows.length - 1 ? '1px solid #16202e' : 'none' }}>
            <span style={{ width: 9, height: 9, borderRadius: '50%', background: rs.c, boxShadow: `0 0 6px ${rs.glow}`, flexShrink: 0 }} />
            <span style={{ fontFamily: DSANS, fontSize: 14, fontWeight: 600, color: '#e8edf5', width: 130, flexShrink: 0 }}>{r[0]}</span>
            <span style={{ fontFamily: DSANS, fontSize: 12, color: '#64748b', width: 220, flexShrink: 0 }}>{r[4]}</span>
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
  return (
    <div style={{ background: '#0d1520', border: '1px solid #1e2d3d', borderRadius: 14, padding: '4px 18px' }}>
      {sorted.map((s, i) => {
        const c = s.bull ? '#22c55e' : '#ef4444';
        const glow = s.bull ? 'rgba(34,197,94,.35)' : 'rgba(239,68,68,.35)';
        return (
          <div key={s.ticker} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '10px 0', borderBottom: i < sorted.length - 1 ? '1px solid #16202e' : 'none' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: c, boxShadow: `0 0 5px ${glow}`, flexShrink: 0 }} />
            <span style={{ fontFamily: DSANS, fontSize: 13.5, color: '#e8edf5', flex: 1 }}>{s.name}</span>
            <span style={{ fontFamily: DMONO, fontSize: 11, color: '#64748b', width: 44, textAlign: 'right', flexShrink: 0 }}>{s.ticker}</span>
            <span style={{ fontFamily: DMONO, fontSize: 13, fontWeight: 600, color: c, width: 72, textAlign: 'right', flexShrink: 0 }}>
              {(s.vs200 >= 0 ? '+' : '') + s.vs200.toFixed(1) + '%'}
            </span>
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

// ── NYSE Breadth — $MMTH & $MMFI historical chart (breadth card only) ──
function NyseBreadthChart() {
  const RMAP = { '10Y': '10y', '5Y': '5y', '1Y': '1y', '6MO': '6mo', '3MO': '3mo', '1MO': '1mo', '1WK': '1wk' };
  const RANGES = ['10Y', '5Y', '1Y', '6MO', '3MO', '1MO', '1WK'];
  const [sel, setSel] = useStateD('5Y');
  const [data, setData] = useStateD(null);

  useEffectD(() => {
    let alive = true;
    setData(null);
    fetch(`/api/breadth-history?range=${RMAP[sel]}`)
      .then(r => r.json())
      .then(j => { if (alive && (Array.isArray(j.mmth) || Array.isArray(j.mmfi))) setData(j); })
      .catch(() => {});
    return () => { alive = false; };
  }, [sel]);

  const W = 800, H = 200, top = 10, bot = 20;
  const yy  = (v) => v == null ? null : +(top + (1 - v / 100) * (H - top - bot)).toFixed(1);
  const col = (v) => v >= 70 ? '#22c55e' : v >= 40 ? '#f59e0b' : '#ef4444';
  const n   = data?.mmth?.length || data?.mmfi?.length || 0;
  const dx  = n > 1 ? W / (n - 1) : W;

  // Colored segments for $MMTH (zone: green/amber/red)
  const buildColorSegs = (values) => {
    if (!values?.length) return [];
    const segs = [];
    let seg = null;
    for (let i = 0; i < values.length; i++) {
      const v = values[i];
      const x = +(i * dx).toFixed(1);
      const y = yy(v);
      if (v == null) { if (seg) { segs.push(seg); seg = null; } continue; }
      const c = col(v);
      if (!seg || c !== seg.c) {
        if (seg) {
          const prev = seg.pts[seg.pts.length - 1];
          const mid = [+((prev[0] + x) / 2).toFixed(1), +((prev[1] + y) / 2).toFixed(1)];
          seg.pts.push(mid);
          segs.push(seg);
          seg = { c, pts: [mid, [x, y]] };
        } else {
          seg = { c, pts: [[x, y]] };
        }
      } else {
        seg.pts.push([x, y]);
      }
    }
    if (seg) segs.push(seg);
    return segs;
  };

  // Null-safe single-color segments for $MMFI
  const buildSegs = (values) => {
    if (!values?.length) return [];
    const segs = [];
    let cur = [];
    for (let i = 0; i < values.length; i++) {
      const v = values[i];
      if (v != null) { cur.push([+(i * dx).toFixed(1), yy(v)]); }
      else if (cur.length) { segs.push(cur); cur = []; }
    }
    if (cur.length) segs.push(cur);
    return segs;
  };

  const summary   = data?.summary || {};
  const curMmth   = summary.currentMmth;
  const curMmfi   = summary.currentMmfi;
  const daysInZone = summary.daysInZone;
  const mmthSegs  = buildColorSegs(data?.mmth || []);
  const mmfiSegs  = buildSegs(data?.mmfi || []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ fontFamily: DSANS, fontSize: 11, fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', color: '#475569' }}>
        NYSE Breadth — $MMTH &amp; $MMFI Historical
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
        {[
          { label: '$MMTH (200D)', val: curMmth != null ? curMmth.toFixed(1) + '%' : '—', sub: '% NYSE above 200d SMA', color: curMmth != null ? col(curMmth) : '#e2e8f0' },
          { label: '$MMFI (50D)',  val: curMmfi != null ? curMmfi.toFixed(1) + '%' : '—', sub: '% NYSE above 50d SMA',  color: curMmfi != null ? col(curMmfi) : '#e2e8f0' },
          { label: 'DAYS IN ZONE', val: daysInZone != null ? String(daysInZone) : '—', sub: 'consecutive days at level', color: '#e2e8f0' },
        ].map(({ label, val, sub, color }) => (
          <div key={label} style={{ background: '#0d1520', border: '1px solid #1e2d3d', borderRadius: 12, padding: '12px 16px' }}>
            <div style={{ fontFamily: DSANS, fontSize: 11, fontWeight: 600, color: '#475569', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '.08em' }}>{label}</div>
            <div style={{ fontFamily: DMONO, fontSize: 26, fontWeight: 700, color, lineHeight: 1.1, marginBottom: 2 }}>{val}</div>
            <div style={{ fontFamily: DSANS, fontSize: 11, color: '#475569' }}>{sub}</div>
          </div>
        ))}
      </div>
      <div style={{ background: '#0d1520', border: '1px solid #1e2d3d', borderRadius: 16, padding: '14px 18px 12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            {[
              { c: '#f59e0b', lab: '$MMTH (200d)', dash: false },
              { c: '#60a5fa', lab: '$MMFI (50d)',  dash: true  },
              { c: '#22c55e', lab: '70% — Bullish', dash: true  },
              { c: '#ef4444', lab: '40% — Bearish', dash: true  },
            ].map(({ c, lab, dash }) => (
              <span key={lab} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <svg width="20" height="10" style={{ flexShrink: 0 }}>
                  <line x1="0" y1="5" x2="20" y2="5" stroke={c} strokeWidth="2" strokeLinecap="round" strokeDasharray={dash ? '4 3' : undefined} />
                </svg>
                <span style={{ fontFamily: DSANS, fontSize: 11, color: '#94a3b8' }}>{lab}</span>
              </span>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 3 }}>
            {RANGES.map(r => (
              <button key={r} onClick={() => setSel(r)} style={{
                all: 'unset', cursor: 'pointer', fontFamily: DMONO, fontSize: 11, fontWeight: 600,
                padding: '3px 7px', borderRadius: 5, letterSpacing: '.04em',
                background: sel === r ? '#1e3a5f' : 'transparent',
                color:      sel === r ? '#93c5fd' : '#475569',
                border: `1px solid ${sel === r ? '#2d5a8e' : 'transparent'}`,
              }}>{r}</button>
            ))}
          </div>
        </div>
        {!data && <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#475569', fontFamily: DSANS, fontSize: 12 }}>Loading…</div>}
        {data && (
          <svg width="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ display: 'block', height: 200 }}>
            <line x1="0" x2={W} y1={yy(70)} y2={yy(70)} stroke="#22c55e" strokeWidth="1" strokeDasharray="4 4" strokeOpacity="0.4" />
            <line x1="0" x2={W} y1={yy(40)} y2={yy(40)} stroke="#ef4444" strokeWidth="1" strokeDasharray="4 4" strokeOpacity="0.4" />
            {mmfiSegs.map((seg, i) => (
              <polyline key={i} points={seg.map(p => `${p[0]},${p[1]}`).join(' ')}
                fill="none" stroke="#60a5fa" strokeWidth="1.5" strokeDasharray="4 3" strokeLinejoin="round" strokeLinecap="round" />
            ))}
            {mmthSegs.map((s, i) => (
              <polyline key={i} points={s.pts.map(p => `${p[0]},${p[1]}`).join(' ')}
                fill="none" stroke={s.c} strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" />
            ))}
            <line x1="0" x2={W} y1={H - bot} y2={H - bot} stroke="#1e2d3d" strokeWidth="1" />
          </svg>
        )}
      </div>
    </div>
  );
}

// ── Sector ETF Breadth historical line chart (breadth card only) ──
function SectorBreadthChart() {
  const RMAP = { '10Y': '10y', '5Y': '5y', '3Y': '3y', '1Y': '1y', '6MO': '6mo' };
  const RANGES = ['10Y', '5Y', '3Y', '1Y', '6MO'];
  const [sel, setSel] = useStateD('5Y');
  const [data, setData] = useStateD(null);

  useEffectD(() => {
    let alive = true;
    setData(null);
    fetch(`/api/sector-breadth-history?range=${RMAP[sel]}`)
      .then(r => r.json())
      .then(j => { if (alive && Array.isArray(j.above) && j.above.length) setData(j); })
      .catch(() => {});
    return () => { alive = false; };
  }, [sel]);

  const W = 800, H = 160, top = 12, bot = 16, MAX = 11, BULL = 8, BEAR = 5;
  const yy  = (v) => top + (1 - v / MAX) * (H - top - bot);
  const col = (v) => v >= BULL ? '#22c55e' : v > BEAR ? '#f59e0b' : '#ef4444';
  const n   = data?.above?.length || 0;
  const dx  = n > 1 ? W / (n - 1) : W;
  const cur = n > 0 ? data.above[n - 1] : null;

  // Build colored polyline segments — split at color-zone boundaries
  const segs = [];
  if (n > 0) {
    const above = data.above;
    const pts = above.map((v, i) => [+(i * dx).toFixed(1), +yy(v).toFixed(1)]);
    let seg = { c: col(above[0]), pts: [pts[0]] };
    for (let i = 1; i < pts.length; i++) {
      const c = col(above[i]);
      if (c !== seg.c) {
        const mid = [+((pts[i - 1][0] + pts[i][0]) / 2).toFixed(1), +((pts[i - 1][1] + pts[i][1]) / 2).toFixed(1)];
        seg.pts.push(mid);
        segs.push(seg);
        seg = { c, pts: [mid] };
      }
      seg.pts.push(pts[i]);
    }
    segs.push(seg);
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <div style={{ fontFamily: DSANS, fontSize: 11, fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', color: '#475569' }}>
          Sector ETF Breadth — Historical
        </div>
        <div style={{ display: 'flex', gap: 3 }}>
          {RANGES.map(r => (
            <button key={r} onClick={() => setSel(r)} style={{
              all: 'unset', cursor: 'pointer', fontFamily: DMONO, fontSize: 11, fontWeight: 600,
              padding: '3px 8px', borderRadius: 5, letterSpacing: '.04em',
              background: sel === r ? '#1e3a5f' : 'transparent',
              color: sel === r ? '#93c5fd' : '#475569',
              border: `1px solid ${sel === r ? '#2d5a8e' : 'transparent'}`,
            }}>{r}</button>
          ))}
        </div>
      </div>
      <div style={{ background: '#0d1520', border: '1px solid #1e2d3d', borderRadius: 16, padding: '14px 18px 12px' }}>
        <div style={{ display: 'flex', gap: 14, marginBottom: 10, alignItems: 'center' }}>
          <span style={{ fontFamily: DSANS, fontSize: 11, color: '#475569' }}>Sectors above 200d MA</span>
          <span style={{ width: 1, height: 12, background: '#1e2d3d', flexShrink: 0 }} />
          {[['#22c55e', `8+ — Bullish`], ['#f59e0b', `6–7 — Mixed`], ['#ef4444', `≤5 — Bearish`]].map(([c, lab]) => (
            <span key={lab} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <svg width="20" height="10" style={{ flexShrink: 0 }}><line x1="0" y1="5" x2="20" y2="5" stroke={c} strokeWidth="2" strokeLinecap="round" /></svg>
              <span style={{ fontFamily: DSANS, fontSize: 11, color: '#94a3b8' }}>{lab}</span>
            </span>
          ))}
          {cur != null && (
            <span style={{ marginLeft: 'auto', fontFamily: DMONO, fontSize: 13, fontWeight: 700, color: col(cur) }}>
              {cur} / {data.totals?.[n - 1] ?? MAX}
            </span>
          )}
        </div>
        {!data && <div style={{ height: 160, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#475569', fontFamily: DSANS, fontSize: 12 }}>Loading…</div>}
        {data && (
          <svg width="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ display: 'block', height: 160 }}>
            <line x1="0" x2={W} y1={yy(BULL).toFixed(1)} y2={yy(BULL).toFixed(1)} stroke="#22c55e" strokeWidth="1" strokeDasharray="3 4" strokeOpacity="0.4" />
            <line x1="0" x2={W} y1={yy(BEAR).toFixed(1)} y2={yy(BEAR).toFixed(1)} stroke="#ef4444" strokeWidth="1" strokeDasharray="3 4" strokeOpacity="0.4" />
            {segs.map((s, i) => (
              <polyline key={i}
                points={s.pts.map(p => `${p[0]},${p[1]}`).join(' ')}
                fill="none" stroke={s.c} strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" />
            ))}
            <line x1="0" x2={W} y1={H - bot} y2={H - bot} stroke="#1e2d3d" strokeWidth="1" />
          </svg>
        )}
      </div>
    </div>
  );
}

// ── Full deep-dive content (chart + regime timeline + stats + indicators) — shared by all options ──
function DeepDiveContent({ card, cardId, asOf, chartHeight = 230 }) {
  const sg = DSIG[card.status];
  const [range, setRange] = useStateD('1Y');
  const [live, setLive] = useStateD(null);
  const [regimeLive, setRegimeLive] = useStateD(null);

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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      {/* breadth card: Sector Breakdown → SectorBreadthChart → NyseBreadthChart */}
      {cardId === 'breadth' && card.sectorTable && card.sectorTable.length > 0 && (
        <div>
          <div style={{ fontFamily: DSANS, fontSize: 11, fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', color: '#475569', marginBottom: 10 }}>Sector Breakdown</div>
          <SectorBreakdown sectorTable={card.sectorTable} />
        </div>
      )}
      {cardId === 'breadth' && <SectorBreadthChart />}
      {/* chart card — breadth uses NyseBreadthChart, all others use DeepChartLg */}
      {cardId === 'breadth' ? <NyseBreadthChart /> : (
        <div style={{ background: '#0d1520', border: '1px solid #1e2d3d', borderRadius: 16, padding: '18px 20px 16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
            <div>
              <div style={{ fontFamily: DSANS, fontSize: 14, color: '#cbd5e1', fontWeight: 600 }}>{card.metric}</div>
              <div style={{ fontFamily: DSANS, fontSize: 11.5, color: '#475569', marginTop: 2 }}>{card.metricUnit}</div>
            </div>
            <div style={{ fontFamily: DMONO, fontSize: 13, fontWeight: 600, color: sg.c }}>{card.metricVal}</div>
          </div>
          <DeepChartLg card={card} cardId={cardId} color={sg.c} height={chartHeight} range={range} setRange={setRange} live={live} />
        </div>
      )}
      {/* regime timeline — always 1Y, never tied to chart range */}
      <div>
        <div style={{ fontFamily: DSANS, fontSize: 11, fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', color: '#475569', marginBottom: 10 }}>{card.title} History</div>
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
      {/* indicators */}
      <div>
        <div style={{ fontFamily: DSANS, fontSize: 11, fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', color: '#475569', marginBottom: 10 }}>Indicators</div>
        <IndicatorTable rows={card.rows} />
      </div>
      {/* country breakdown — global flows card only */}
      {card.details && card.details.length > 0 && (
        <div>
          <div style={{ fontFamily: DSANS, fontSize: 11, fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', color: '#475569', marginBottom: 10 }}>Country Breakdown</div>
          <CountryTable details={card.details} />
        </div>
      )}
      {/* stat boxes with section heading */}
      {card.stats && card.stats.length > 0 && (
        <div>
          <div style={{ fontFamily: DSANS, fontSize: 11, fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', color: '#475569', marginBottom: 10 }}>{cardId === 'regime' ? 'Regime Metrics' : 'Key Metrics'}</div>
          <StatBoxes stats={card.stats} />
        </div>
      )}
      {/* summary note */}
      {card.note && (
        <div>
          <div style={{ fontFamily: DSANS, fontSize: 11, fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', color: '#475569', marginBottom: 10 }}>Summary</div>
          <div style={{ background: '#0d1520', border: '1px solid #1e2d3d', borderRadius: 14, padding: '16px 20px' }}>
            <p style={{ fontFamily: DSANS, fontSize: 13.5, color: '#94a3b8', lineHeight: 1.65, margin: 0 }}>{card.note}</p>
          </div>
        </div>
      )}
    </div>
  );
}

Object.assign(window, { DSIG, DMONO, DSANS, postureColorD, DeepChartLg, RegimeTimeline, StatusPill, SparkD, StatBoxes, IndicatorTable, SectorBreakdown, CountryTable, NyseBreadthChart, SectorBreadthChart, DeepDiveContent });
