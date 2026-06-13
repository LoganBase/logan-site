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
function DeepChartLg({ card, cardId, color, height = 230 }) {
  const ranges = ['1M', '3M', '6M', '1Y', '5Y'];
  const [range, setRange] = useStateD('1Y');
  const [live, setLive] = useStateD(null); // { values:number[] } from the API, or null
  useEffectD(() => {
    let alive = true;
    setLive(null);
    if (window.MarketHubData && cardId) {
      window.MarketHubData.loadHistory(cardId, range).then((r) => { if (alive && r && r.values.length > 1) setLive(r); });
    }
    return () => { alive = false; };
  }, [cardId, range]);

  const W = 720, H = height, top = 12, bot = 26, padR = 4;
  const conf = { '1M': [24, 0.16], '3M': [44, 0.135], '6M': [56, 0.115], '1Y': [64, 0.10], '5Y': [70, 0.082] };
  let arr;
  if (live && live.values.length > 1) {
    // Normalize the real series to 0..1 for the same plot box.
    const vals = live.values, lo = Math.min(...vals), hi = Math.max(...vals), span = hi - lo || 1;
    arr = vals.map((x) => 0.07 + ((x - lo) / span) * 0.86);
  } else {
    const [n, vol] = conf[range];
    let s = card.seed * 9301 + 49297 + range.length * 1733;
    const rnd = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
    let v = 0.4; arr = [];
    for (let i = 0; i < n; i++) { v += (rnd() - 0.5) * vol + card.trend * 0.012; v = Math.max(0.07, Math.min(0.94, v)); arr.push(v); }
  }
  const n = arr.length;
  const dx = (W - padR) / (n - 1), yy = (p) => top + (1 - p) * (H - top - bot);
  const line = arr.map((p, i) => `${i ? 'L' : 'M'}${(i * dx).toFixed(1)},${yy(p).toFixed(1)}`).join(' ');
  const area = `${line} L${(n - 1) * dx},${H - bot} L0,${H - bot} Z`;
  const id = `dlg${card.seed}`;
  return (
    <div>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ display: 'block', height }}>
        <defs><linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={color} stopOpacity="0.28" /><stop offset="1" stopColor={color} stopOpacity="0" />
        </linearGradient></defs>
        {[0.2, 0.4, 0.6, 0.8].map((g) => (<line key={g} x1="0" x2={W} y1={top + g * (H - top - bot)} y2={top + g * (H - top - bot)} stroke="#16202e" strokeWidth="1" strokeDasharray="2 5" />))}
        <line x1="0" x2={W} y1={H - bot} y2={H - bot} stroke="#1e2d3d" strokeWidth="1" />
        <path d={area} fill={`url(#${id})`} />
        <path d={line} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        <circle cx={(n - 1) * dx} cy={yy(arr[n - 1])} r="3.5" fill={color} />
        <circle cx={(n - 1) * dx} cy={yy(arr[n - 1])} r="7" fill="none" stroke={color} strokeOpacity="0.35" strokeWidth="2" />
      </svg>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 12 }}>
        {ranges.map((r) => (
          <button key={r} onClick={() => setRange(r)} style={{ all: 'unset', cursor: 'pointer', padding: '6px 16px', borderRadius: 8,
            fontFamily: DMONO, fontSize: 12, fontWeight: 600, color: r === range ? '#e8edf5' : '#64748b',
            background: r === range ? '#1b2736' : 'transparent', border: `1px solid ${r === range ? '#243446' : 'transparent'}` }}>{r}</button>
        ))}
        <span title={live ? 'Live data from /api' : 'Sample data — connect /api for live history'} style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, fontFamily: DSANS, fontSize: 10.5, color: '#475569' }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: live ? '#22c55e' : '#475569', boxShadow: live ? '0 0 6px #22c55e' : 'none' }} />
          {live ? 'Live' : 'Sample'}
        </span>
      </div>
    </div>
  );
}

// ── Historical regime timeline — how the card's status changed month over month ──
function RegimeTimeline({ card, asOf, months = 14, compact = false }) {
  const hist = regimeHistory(card.seed, card.status, months);
  const labels = monthLabels(asOf, months);
  let transitions = 0;
  for (let i = 1; i < hist.length; i++) if (hist[i] !== hist[i - 1]) transitions++;
  const barH = compact ? 26 : 38;
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ fontFamily: DSANS, fontSize: 11, fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', color: '#475569' }}>Regime history · {months} mo</div>
        <div style={{ fontFamily: DMONO, fontSize: 11.5, color: '#64748b' }}>{transitions} regime change{transitions === 1 ? '' : 's'}</div>
      </div>
      <div style={{ display: 'flex', gap: 3, alignItems: 'flex-end' }}>
        {hist.map((st, i) => {
          const sg = DSIG[st], changed = i > 0 && hist[i - 1] !== st, last = i === hist.length - 1;
          return (
            <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
              <div style={{ position: 'relative', width: '100%', height: barH, borderRadius: 5, background: sg.c,
                boxShadow: last ? `0 0 12px ${sg.glow}` : 'none', opacity: last ? 1 : 0.62 + (i / months) * 0.3,
                borderLeft: changed ? '2px solid rgba(232,237,245,.55)' : 'none' }}>
                {last && <div style={{ position: 'absolute', inset: 0, borderRadius: 5, border: '1.5px solid rgba(232,237,245,.6)' }} />}
              </div>
              <span style={{ fontFamily: DMONO, fontSize: 9.5, color: last ? '#cbd5e1' : '#475569', fontWeight: last ? 700 : 400 }}>{labels[i]}</span>
            </div>
          );
        })}
      </div>
      {!compact && (
        <div style={{ display: 'flex', gap: 18, marginTop: 16 }}>
          {[['bullish', 'Bullish'], ['neutral', 'Neutral'], ['bearish', 'Bearish']].map(([k, lab]) => (
            <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <span style={{ width: 10, height: 10, borderRadius: 3, background: DSIG[k].c }} />
              <span style={{ fontFamily: DSANS, fontSize: 12, color: '#94a3b8' }}>{lab}</span>
            </div>
          ))}
          <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 7 }}>
            <span style={{ width: 2, height: 12, background: 'rgba(232,237,245,.55)' }} />
            <span style={{ fontFamily: DSANS, fontSize: 12, color: '#94a3b8' }}>Regime change</span>
          </span>
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
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${stats.length}, 1fr)`, gap: 10 }}>
      {stats.map((st, i) => {
        const tone = st[3] === 'pos' ? '#22c55e' : st[3] === 'neg' ? '#ef4444' : '#e8edf5';
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
  return (
    <div style={{ background: '#0d1520', border: '1px solid #1e2d3d', borderRadius: 14, padding: '4px 18px' }}>
      {rows.map((r, i) => {
        const rs = DSIG[r[3]];
        return (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '13px 0', borderBottom: i < rows.length - 1 ? '1px solid #16202e' : 'none' }}>
            <span style={{ width: 9, height: 9, borderRadius: '50%', background: rs.c, boxShadow: `0 0 6px ${rs.glow}`, flexShrink: 0 }} />
            <span style={{ fontFamily: DSANS, fontSize: 14, color: '#e8edf5', flex: 1 }}>{r[0]}</span>
            <span style={{ fontFamily: DSANS, fontSize: 12.5, color: '#64748b', width: 160 }}>{r[2]}</span>
            <span style={{ fontFamily: DMONO, fontSize: 14, fontWeight: 600, color: rs.c, width: 90, textAlign: 'right' }}>{r[1]}</span>
          </div>
        );
      })}
    </div>
  );
}

// ── Full deep-dive content (chart + regime timeline + stats + indicators) — shared by all options ──
function DeepDiveContent({ card, cardId, asOf, chartHeight = 230 }) {
  const sg = DSIG[card.status];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      {/* chart card */}
      <div style={{ background: '#0d1520', border: '1px solid #1e2d3d', borderRadius: 16, padding: '18px 20px 16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
          <div>
            <div style={{ fontFamily: DSANS, fontSize: 14, color: '#cbd5e1', fontWeight: 600 }}>{card.metric}</div>
            <div style={{ fontFamily: DSANS, fontSize: 11.5, color: '#475569', marginTop: 2 }}>{card.metricUnit}</div>
          </div>
          <div style={{ fontFamily: DMONO, fontSize: 28, fontWeight: 700, color: sg.c }}>{card.metricVal}</div>
        </div>
        <DeepChartLg card={card} cardId={cardId} color={sg.c} height={chartHeight} />
      </div>
      {/* regime timeline */}
      <div style={{ background: '#0d1520', border: '1px solid #1e2d3d', borderRadius: 16, padding: '18px 20px 20px' }}>
        <RegimeTimeline card={card} asOf={asOf} />
      </div>
      {/* stat boxes */}
      <StatBoxes stats={card.stats} />
      {/* flags (global flows) */}
      {card.flags && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {card.flags.map((f) => (<img key={f} src={`../../assets/flags/${f}.svg`} alt={f} style={{ width: 30, height: 20, borderRadius: 3, objectFit: 'cover', border: '1px solid #1e2d3d' }} />))}
        </div>
      )}
      {/* indicators */}
      <div>
        <div style={{ fontFamily: DSANS, fontSize: 11, fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', color: '#475569', marginBottom: 10 }}>Indicators</div>
        <IndicatorTable rows={card.rows} />
      </div>
    </div>
  );
}

Object.assign(window, { DSIG, DMONO, DSANS, postureColorD, DeepChartLg, RegimeTimeline, StatusPill, SparkD, StatBoxes, IndicatorTable, DeepDiveContent });
