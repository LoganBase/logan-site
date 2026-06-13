// Mobile daily-glance — PocketGuard logic in Market Hub's institutional skin.
// One hero macro read, calm category bars, a tappable scorecard list, light deep-dive sheet.
const { useState, useEffect, useRef } = React;

// Live data hook — paints the bundled mock instantly, swaps in /api/scores when reachable.
function useGlance() {
  const [D, setD] = useState(window.GLANCE);
  useEffect(() => {
    let alive = true;
    if (window.MarketHubData) {
      window.MarketHubData.loadGlance().then((live) => { if (alive && live) setD(live); }).catch(() => {});
    }
    return () => { alive = false; };
  }, []);
  return D;
}

const SIG = {
  bullish: { c: '#22c55e', glow: 'rgba(34,197,94,.35)', fill: 'rgba(34,197,94,.12)', line: 'rgba(34,197,94,.25)', word: 'BULLISH' },
  neutral: { c: '#f59e0b', glow: 'rgba(245,158,11,.35)', fill: 'rgba(245,158,11,.10)', line: 'rgba(245,158,11,.20)', word: 'NEUTRAL' },
  bearish: { c: '#ef4444', glow: 'rgba(239,68,68,.35)', fill: 'rgba(239,68,68,.10)', line: 'rgba(239,68,68,.20)', word: 'BEARISH' },
};
const glowMap = { green: '#22c55e', yellow: '#f59e0b', red: '#ef4444' };
// Ring/bar color is driven by the score: >=6.5 Risk-On, 4.0-6.4 Neutral, <4.0 Risk-Off.
function scoreColor(score) { const v = parseFloat(score); return v >= 6.5 ? '#22c55e' : v >= 4 ? '#f59e0b' : '#ef4444'; }
const MONO = "'SF Mono','JetBrains Mono','Fira Code',ui-monospace,Menlo,Consolas,monospace";
const SANS = "'Inter',-apple-system,system-ui,sans-serif";

// ── Seeded sparkline (matches the product's signal-colored area chart) ──
function Spark({ seed, trend, color, w = 64, h = 24 }) {
  const pts = [];
  let v = 0.5, s = seed * 9301 + 49297;
  const rnd = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
  const N = 22;
  for (let i = 0; i < N; i++) { v += (rnd() - 0.5) * 0.22 + trend * 0.018; v = Math.max(0.08, Math.min(0.92, v)); pts.push(v); }
  const dx = w / (N - 1);
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${(i * dx).toFixed(1)},${(h - p * h).toFixed(1)}`).join(' ');
  const area = `${line} L${w},${h} L0,${h} Z`;
  const id = `g${seed}`;
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ display: 'block' }}>
      <defs><linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor={color} stopOpacity="0.28" /><stop offset="1" stopColor={color} stopOpacity="0" />
      </linearGradient></defs>
      <path d={area} fill={`url(#${id})`} />
      <path d={line} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

// ── Hero breadth ring — directional posture + how many cards are bullish ──
function postureColor(label) { return /off/i.test(label) ? '#ef4444' : /on/i.test(label) ? '#22c55e' : '#f59e0b'; }
function HeroGauge({ exec }) {
  const total = exec.bull + exec.neutral + exec.bear;
  const color = postureColor(exec.label);
  const R = 78, C = 2 * Math.PI * R, gap = 7;
  // Segment the ring by directional breadth: green=bullish, amber=neutral, red=bearish.
  const segDefs = [['bullish', exec.bull], ['neutral', exec.neutral], ['bearish', exec.bear]].filter((s) => s[1] > 0);
  let acc = 0;
  const arcs = segDefs.map(([k, n]) => { const len = (n / total) * C; const off = acc; acc += len; return { k, len, off, c: SIG[k].c, glow: SIG[k].glow }; });
  const [mounted, setMounted] = useState(false);
  useEffect(() => { const t = setTimeout(() => setMounted(true), 120); return () => clearTimeout(t); }, []);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '8px 0 4px' }}>
      <div style={{ position: 'relative', width: 196, height: 196 }}>
        <div style={{ position: 'absolute', inset: 18, borderRadius: '50%', boxShadow: `0 0 56px ${color}44`, opacity: mounted ? 1 : 0, transition: 'opacity 1s ease' }} />
        <svg width="196" height="196" viewBox="0 0 196 196" style={{ transform: 'rotate(-90deg)' }}>
          <circle cx="98" cy="98" r={R} fill="none" stroke="#16202e" strokeWidth="10" />
          {arcs.map((a) => (
            <circle key={a.k} cx="98" cy="98" r={R} fill="none" stroke={a.c} strokeWidth="10" strokeLinecap="round"
              strokeDasharray={`${Math.max(mounted ? a.len - gap : 0, 0)} ${C}`} strokeDashoffset={-(a.off + gap / 2)}
              style={{ transition: 'stroke-dasharray 1.1s cubic-bezier(.22,.61,.36,1)', filter: `drop-shadow(0 0 4px ${a.glow})` }} />
          ))}
        </svg>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ fontFamily: MONO, fontWeight: 700, color: '#e8edf5', letterSpacing: '-0.02em', lineHeight: 1 }}>
            <span style={{ fontSize: 50 }}>{exec.bull}</span><span style={{ fontSize: 26, color: '#475569' }}>/{total}</span>
          </div>
          <div style={{ fontFamily: SANS, fontSize: 11, color: '#64748b', marginTop: 5, letterSpacing: '.06em', textTransform: 'uppercase' }}>bullish</div>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 14 }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, boxShadow: `0 0 8px ${color}` }} />
        <span style={{ fontFamily: SANS, fontSize: 19, fontWeight: 700, color: '#e8edf5', letterSpacing: '0.01em' }}>{exec.label}</span>
      </div>
      <div style={{ fontFamily: SANS, fontSize: 12.5, color: '#94a3b8', marginTop: 5, textAlign: 'center', maxWidth: 260, lineHeight: 1.45 }}>{exec.posture}</div>
      {/* breadth legend */}
      <div style={{ display: 'flex', gap: 7, marginTop: 14 }}>
        {[['bullish', exec.bull], ['neutral', exec.neutral], ['bearish', exec.bear]].map(([k, n]) => (
          <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 11px', borderRadius: 8, background: SIG[k].fill, border: `1px solid ${SIG[k].line}` }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: SIG[k].c }} />
            <span style={{ fontFamily: MONO, fontSize: 13, fontWeight: 600, color: SIG[k].c }}>{n}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Category breadth — one dot per card, colored by directional status ──
function CategoryBreadth({ cats }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 13, padding: '4px 4px 0' }}>
      {cats.map((c) => {
        const bull = c.cards.filter((s) => s === 'bullish').length;
        return (
          <div key={c.label} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 104, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
              <span style={{ fontFamily: SANS, fontSize: 12.5, color: '#cbd5e1', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.label}</span>
              <span style={{ fontFamily: MONO, fontSize: 9.5, color: '#64748b', letterSpacing: '.04em' }}>{c.weight} weight</span>
            </div>
            <div style={{ flex: 1, display: 'flex', gap: 7, alignItems: 'center' }}>
              {c.cards.map((s, i) => (
                <span key={i} style={{ width: 11, height: 11, borderRadius: '50%', background: SIG[s].c, boxShadow: `0 0 7px ${SIG[s].glow}` }} />
              ))}
            </div>
            <span style={{ fontFamily: MONO, fontSize: 12.5, color: '#94a3b8', whiteSpace: 'nowrap' }}>{bull}/{c.cards.length}<span style={{ color: '#475569' }}> bull</span></span>
          </div>
        );
      })}
    </div>
  );
}

// ── Scorecard — header + inline top-3 KPIs + sparkline; tap for the full set ──
function CardRow({ card, onTap }) {
  const sig = SIG[card.status];
  const [press, setPress] = useState(false);
  const kpis = card.rows.slice(0, 3);
  return (
    <button onClick={onTap} onPointerDown={() => setPress(true)} onPointerUp={() => setPress(false)} onPointerLeave={() => setPress(false)}
      style={{ all: 'unset', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 11, padding: '12px 14px',
        borderRadius: 14, background: '#111827', border: '1px solid #1e2d3d',
        boxShadow: press ? 'none' : '0 1px 2px rgba(0,0,0,.3)', transform: press ? 'scale(0.99)' : 'scale(1)',
        transition: 'transform .12s ease, border-color .15s ease', borderLeft: `3px solid ${sig.c}`, width: '100%', boxSizing: 'border-box' }}>
      {/* header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
        <span style={{ fontFamily: SANS, fontSize: 14.5, fontWeight: 600, color: '#e8edf5', flex: 1, minWidth: 0 }}>{card.title}</span>
        <Spark seed={card.seed} trend={card.trend} color={sig.c} w={50} h={18} />
        <svg width="7" height="12" viewBox="0 0 7 12" style={{ flexShrink: 0 }}><path d="M1 1l5 5-5 5" stroke="#334155" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </div>
      {/* inline KPI strip */}
      <div style={{ display: 'flex', gap: 8 }}>
        {kpis.map((r, i) => {
          const rs = SIG[r[3]];
          return (
            <div key={i} style={{ flex: 1, minWidth: 0, paddingLeft: i ? 9 : 0, borderLeft: i ? '1px solid #1b2736' : 'none' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: rs.c, boxShadow: `0 0 5px ${rs.glow}`, flexShrink: 0 }} />
                <span style={{ fontFamily: MONO, fontSize: 13, fontWeight: 600, color: rs.c, whiteSpace: 'nowrap' }}>{r[1]}</span>
              </div>
              <div style={{ fontFamily: SANS, fontSize: 9.5, color: '#64748b', marginTop: 3, lineHeight: 1.25, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r[0]}</div>
            </div>
          );
        })}
      </div>
    </button>
  );
}

// ── Deep-dive chart with range toggle ──
function DeepChart({ card, cardId, color }) {
  const ranges = ['1M', '3M', '6M', '1Y', '5Y'];
  const [range, setRange] = useState('1Y');
  const [live, setLive] = useState(null);
  useEffect(() => {
    let alive = true;
    setLive(null);
    if (window.MarketHubData && cardId) {
      window.MarketHubData.loadHistory(cardId, range).then((r) => { if (alive && r && r.values.length > 1) setLive(r); });
    }
    return () => { alive = false; };
  }, [cardId, range]);
  const W = 332, H = 150, top = 10, bot = 22;
  const conf = { '1M': [24, 0.16], '3M': [40, 0.135], '6M': [52, 0.115], '1Y': [60, 0.10], '5Y': [60, 0.08] };
  let arr;
  if (live && live.values.length > 1) {
    const vals = live.values, lo = Math.min(...vals), hi = Math.max(...vals), span = hi - lo || 1;
    arr = vals.map((x) => 0.08 + ((x - lo) / span) * 0.85);
  } else {
    const [n0, vol] = conf[range];
    let s = card.seed * 9301 + 49297 + range.length * 1733;
    const rnd = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
    let v = 0.4; arr = [];
    for (let i = 0; i < n0; i++) { v += (rnd() - 0.5) * vol + card.trend * 0.013; v = Math.max(0.08, Math.min(0.93, v)); arr.push(v); }
  }
  const n = arr.length;
  const dx = W / (n - 1), yy = (p) => top + (1 - p) * (H - top - bot);
  const line = arr.map((p, i) => `${i ? 'L' : 'M'}${(i * dx).toFixed(1)},${yy(p).toFixed(1)}`).join(' ');
  const area = `${line} L${W},${H - bot} L0,${H - bot} Z`;
  const id = `dc${card.seed}`;
  return (
    <div>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: 'block' }}>
        <defs><linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={color} stopOpacity="0.3" /><stop offset="1" stopColor={color} stopOpacity="0" />
        </linearGradient></defs>
        {[0.25, 0.5, 0.75].map((g) => (<line key={g} x1="0" x2={W} y1={top + g * (H - top - bot)} y2={top + g * (H - top - bot)} stroke="#16202e" strokeWidth="1" strokeDasharray="3 4" />))}
        <line x1="0" x2={W} y1={H - bot} y2={H - bot} stroke="#1e2d3d" strokeWidth="1" />
        <path d={area} fill={`url(#${id})`} />
        <path d={line} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        <circle cx={(n - 1) * dx} cy={yy(arr[n - 1])} r="3.5" fill={color} />
        <circle cx={(n - 1) * dx} cy={yy(arr[n - 1])} r="6.5" fill="none" stroke={color} strokeOpacity="0.35" strokeWidth="2" />
      </svg>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 10 }}>
        {ranges.map((r) => (
          <button key={r} onClick={() => setRange(r)} style={{ all: 'unset', cursor: 'pointer', flex: 1, textAlign: 'center', padding: '7px 0', borderRadius: 8,
            fontFamily: MONO, fontSize: 12, fontWeight: 600, color: r === range ? '#e8edf5' : '#64748b',
            background: r === range ? '#1b2736' : 'transparent', border: `1px solid ${r === range ? '#243446' : 'transparent'}` }}>{r}</button>
        ))}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, justifyContent: 'flex-end' }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: live ? '#22c55e' : '#475569', boxShadow: live ? '0 0 6px #22c55e' : 'none' }} />
        <span style={{ fontFamily: SANS, fontSize: 10, color: '#475569' }}>{live ? 'Live data' : 'Sample data'}</span>
      </div>
    </div>
  );
}

// ── Full deep-dive screen — charted, opens directly from a card tap ──
function DeepDive({ card, cardId, onBack }) {
  const sig = SIG[card.status];
  return (
    <div style={{ position: 'absolute', inset: 0, background: '#080c14', display: 'flex', flexDirection: 'column' }}>
      {/* top bar (clears status bar) */}
      <div style={{ paddingTop: 54, background: 'linear-gradient(#080c14 80%, rgba(8,12,20,0))' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '4px 14px 12px' }}>
          <button onClick={onBack} style={{ all: 'unset', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', width: 34, height: 34, borderRadius: 9, background: '#0d1520', border: '1px solid #1e2d3d' }}>
            <svg width="9" height="15" viewBox="0 0 9 15"><path d="M7.5 1L1.5 7.5l6 6.5" stroke="#94a3b8" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
          <span style={{ width: 9, height: 9, borderRadius: '50%', background: sig.c, boxShadow: `0 0 8px ${sig.c}` }} />
          <span style={{ fontFamily: SANS, fontSize: 18, fontWeight: 700, color: '#e8edf5' }}>{card.title}</span>
          <div style={{ marginLeft: 'auto', display: 'inline-flex', padding: '4px 10px', borderRadius: 6, background: sig.fill, border: `1px solid ${sig.line}` }}>
            <span style={{ fontFamily: SANS, fontSize: 10, fontWeight: 700, letterSpacing: '.08em', color: sig.c }}>{sig.word}</span>
          </div>
        </div>
      </div>
      {/* scroll body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '2px 16px calc(34px + 22px)', display: 'flex', flexDirection: 'column', gap: 18 }}>
        {/* chart card */}
        <div style={{ background: '#0d1520', border: '1px solid #1e2d3d', borderRadius: 16, padding: '14px 14px 12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
            <div>
              <div style={{ fontFamily: SANS, fontSize: 12.5, color: '#cbd5e1', fontWeight: 500 }}>{card.metric}</div>
              <div style={{ fontFamily: SANS, fontSize: 10, color: '#475569', marginTop: 1 }}>{card.metricUnit}</div>
            </div>
            <div style={{ fontFamily: MONO, fontSize: 22, fontWeight: 700, color: sig.c }}>{card.metricVal}</div>
          </div>
          <DeepChart card={card} cardId={cardId} color={sig.c} />
        </div>
        {/* stat boxes */}
        <div style={{ display: 'flex', gap: 8 }}>
          {card.stats.map((st, i) => {
            const tone = st[3] === 'pos' ? '#22c55e' : st[3] === 'neg' ? '#ef4444' : '#e8edf5';
            return (
              <div key={i} style={{ flex: 1, minWidth: 0, background: '#0d1520', border: '1px solid #1e2d3d', borderRadius: 12, padding: '11px 10px' }}>
                <div style={{ fontFamily: MONO, fontSize: 15, fontWeight: 700, color: tone }}>{st[1]}</div>
                <div style={{ fontFamily: SANS, fontSize: 10, color: '#94a3b8', marginTop: 3, lineHeight: 1.2 }}>{st[0]}</div>
                <div style={{ fontFamily: SANS, fontSize: 9, color: '#475569', marginTop: 2, lineHeight: 1.2 }}>{st[2]}</div>
              </div>
            );
          })}
        </div>
        {/* flag row (global flows) */}
        {card.flags && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
            {card.flags.map((f) => (<img key={f} src={`../../assets/flags/${f}.svg`} alt={f} style={{ width: 26, height: 17, borderRadius: 3, objectFit: 'cover', border: '1px solid #1e2d3d' }} />))}
          </div>
        )}
        {/* full indicator table */}
        <div>
          <div style={{ fontFamily: SANS, fontSize: 10, fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', color: '#475569', marginBottom: 8 }}>Indicators</div>
          <div style={{ background: '#0d1520', border: '1px solid #1e2d3d', borderRadius: 14, padding: '2px 14px' }}>
            {card.rows.map((r, i) => {
              const rs = SIG[r[3]];
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '12px 0', borderBottom: i < card.rows.length - 1 ? '1px solid #16202e' : 'none' }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: rs.c, boxShadow: `0 0 6px ${rs.glow}`, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: SANS, fontSize: 13, color: '#e8edf5' }}>{r[0]}</div>
                    <div style={{ fontFamily: SANS, fontSize: 11, color: '#64748b' }}>{r[2]}</div>
                  </div>
                  <span style={{ fontFamily: MONO, fontSize: 13, fontWeight: 600, color: rs.c }}>{r[1]}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Home (the daily glance) ──
function Home({ D, onOpen }) {
  return (
    <div style={{ minHeight: '100%', background: '#080c14', paddingTop: 54 }}>
      {/* app bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 18px 12px', position: 'sticky', top: 0, zIndex: 30,
        background: 'linear-gradient(#080c14 70%, rgba(8,12,20,0))' }}>
        <svg width="22" height="19" viewBox="0 0 30 26"><rect x="0" y="14" width="7" height="12" rx="1.5" fill="#ef4444" /><rect x="11.5" y="7" width="7" height="19" rx="1.5" fill="#f59e0b" /><rect x="23" y="0" width="7" height="26" rx="1.5" fill="#22c55e" /></svg>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontFamily: SANS, fontSize: 15, fontWeight: 700, color: '#e8edf5', lineHeight: 1.1 }}>Market Hub</span>
          <span style={{ fontFamily: SANS, fontSize: 10.5, color: '#64748b' }}>Macro Framework</span>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', borderRadius: 8, background: '#0d1520', border: '1px solid #1e2d3d' }}>
          <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 6px #22c55e' }} />
          <span style={{ fontFamily: MONO, fontSize: 11, color: '#94a3b8' }}>As of {D.asOf}</span>
        </div>
      </div>

      <div style={{ padding: '0 16px 28px', display: 'flex', flexDirection: 'column', gap: 18 }}>
        <HeroGauge exec={D.exec} />
        <div style={{ height: 1, background: '#16202e' }} />
        <CategoryBreadth cats={D.categories} />
        <div style={{ height: 1, background: '#16202e' }} />
        {D.groups.map((g) => (
          <div key={g.label} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontFamily: SANS, fontSize: 10, fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', color: '#475569', paddingLeft: 4 }}>{g.label}</div>
            {g.ids.map((id) => <CardRow key={id} card={D.cards[id]} onTap={() => onOpen(id)} />)}
          </div>
        ))}
      </div>
    </div>
  );
}

function Glance() {
  const D = useGlance();
  const [active, setActive] = useState(() => {
    try { const v = localStorage.getItem('mh-active'); return v && D.cards[v] ? v : null; } catch (e) { return null; }
  });
  const open = (id) => { setActive(id); try { localStorage.setItem('mh-active', id || ''); } catch (e) {} };
  const close = () => { setActive(null); try { localStorage.removeItem('mh-active'); } catch (e) {} };
  const wrapRef = useRef(null);
  useEffect(() => {
    // Reset the device's scroll area to the top whenever we navigate between Home and a deep-dive.
    let el = wrapRef.current;
    while (el) { if (typeof el.scrollTop === 'number') el.scrollTop = 0; el = el.parentElement; }
  }, [active]);
  return (
    <div ref={wrapRef} style={{ position: 'relative', height: '100%', background: '#080c14' }}>
      {active
        ? <DeepDive key={active} card={D.cards[active]} cardId={active} onBack={close} />
        : <Home D={D} onOpen={open} />}
    </div>
  );
}

window.Glance = Glance;
