// Market Hub — desktop layout explorations. Three landing concepts behind a switcher.
// A: Full dashboard grid · B: Two-pane workspace · C: Glance → deep-dive page.
const { useState: useStateA, useEffect: useEffectA } = React;

// Live data hook: paints the bundled mock instantly, then swaps in /api/scores
// data if the adapter can reach it (production). In the preview it stays on mock.
function useGlance() {
  const [D, setD] = useStateA(window.GLANCE);
  useEffectA(() => {
    let alive = true;
    if (window.MarketHubData) {
      window.MarketHubData.loadGlance().then((live) => { if (alive && live) setD(live); }).catch(() => {});
    }
    return () => { alive = false; };
  }, []);
  return D;
}

// ── Compact horizontal breadth hero (used atop dashboard + glance) ──
function BreadthBar({ exec, cats }) {
  const total = exec.bull + exec.neutral + exec.bear;
  const color = postureColorD(exec.label);
  const R = 30, C = 2 * Math.PI * R, gap = 5;
  const segs = [['bullish', exec.bull], ['neutral', exec.neutral], ['bearish', exec.bear]].filter((x) => x[1] > 0);
  let acc = 0;
  const arcs = segs.map(([k, n]) => { const len = (n / total) * C; const off = acc; acc += len; return { k, len, off, c: DSIG[k].c }; });
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 24, rowGap: 16, flexWrap: 'wrap', background: '#0d1520', border: '1px solid #1e2d3d', borderRadius: 18, padding: '20px 26px' }}>
      <div style={{ position: 'relative', width: 76, height: 76, flexShrink: 0 }}>
        <div style={{ position: 'absolute', inset: 8, borderRadius: '50%', boxShadow: `0 0 30px ${color}44` }} />
        <svg width="76" height="76" viewBox="0 0 76 76" style={{ transform: 'rotate(-90deg)' }}>
          <circle cx="38" cy="38" r={R} fill="none" stroke="#16202e" strokeWidth="7" />
          {arcs.map((a) => (<circle key={a.k} cx="38" cy="38" r={R} fill="none" stroke={a.c} strokeWidth="7" strokeLinecap="round"
            strokeDasharray={`${Math.max(a.len - gap, 0)} ${C}`} strokeDashoffset={-(a.off + gap / 2)} style={{ filter: `drop-shadow(0 0 3px ${a.c}88)` }} />))}
        </svg>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontFamily: DMONO, fontSize: 22, fontWeight: 700, color: '#e8edf5' }}>{exec.bull}</span>
          <span style={{ fontFamily: DMONO, fontSize: 13, color: '#e8edf5' }}>/{total}</span>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0, maxWidth: 310 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 9 }}>
          <span style={{ width: 9, height: 9, borderRadius: '50%', background: color, boxShadow: `0 0 8px ${color}`, flexShrink: 0, marginTop: 4 }} />
          <span style={{ fontFamily: DSANS, fontSize: 17, fontWeight: 700, color: '#e8edf5', lineHeight: 1.25 }}>
            {exec.label.split(' — ').map((p, i, arr) => (
              <span key={i} style={{ display: 'block' }}>{i < arr.length - 1 ? p + ' —' : p}</span>
            ))}
          </span>
        </div>
        <span style={{ fontFamily: DSANS, fontSize: 13, color: '#94a3b8', lineHeight: 1.4, paddingLeft: 18 }}>{exec.posture}</span>
      </div>
      <div style={{ width: 1, height: 56, background: '#1e2d3d', margin: '0 4px' }} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 9, flex: 1 }}>
        {cats.map((c) => {
            const bull = c.cards.filter((s) => s === 'bullish').length;
            return (
              <div key={c.label} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ flex: 1 }} />
                <span style={{ flexShrink: 0, fontFamily: DSANS, fontSize: 12.5, color: '#cbd5e1', fontWeight: 500, whiteSpace: 'nowrap' }}>{c.label}</span>
                <div style={{ display: 'flex', gap: 6 }}>{c.cards.map((s, i) => (<span key={i} style={{ width: 10, height: 10, borderRadius: '50%', background: DSIG[s].c, boxShadow: `0 0 6px ${DSIG[s].glow}` }} />))}</div>
                <span style={{ fontFamily: DMONO, fontSize: 12, color: '#94a3b8', width: 36, textAlign: 'right' }}>{bull}/{c.cards.length}</span>
              </div>
            );
          })}
      </div>
    </div>
  );
}

// ── Regime list sparkline — 20D SPY (cyan) + 200d SMA (purple), falls back to synthetic spark ──
function RegimeMiniSpark({ seed, trend, color, w = 56, h = 20 }) {
  const [data, setData] = useStateA(null);
  useEffectA(() => {
    let alive = true;
    if (window.MarketHubData) {
      window.MarketHubData.loadHistory('regime', '20D').then((r) => {
        if (!alive || !r || !r.values || r.values.length < 2) return;
        const sma200 = (r.overlays || []).find(o => o.label === '200d SMA');
        setData({ spy: r.values, sma200: sma200 ? sma200.values : [] });
      });
    }
    return () => { alive = false; };
  }, []);
  if (!data) return <SparkD seed={seed} trend={trend} color={color} w={w} h={h} />;
  const allVals = [...data.spy, ...data.sma200].filter(v => v != null && v > 0);
  const lo = Math.min(...allVals), hi = Math.max(...allVals), span = hi - lo || 1;
  const dx = w / Math.max(data.spy.length - 1, 1);
  const mkPath = (vals) => vals.map((v, i) => v == null ? '' :
    `${(i === 0 || vals[i - 1] == null) ? 'M' : 'L'}${(i * dx).toFixed(1)},${(h - ((v - lo) / span) * h * 0.86 - h * 0.07).toFixed(1)}`
  ).join(' ');
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ display: 'block' }}>
      <path d={mkPath(data.sma200)} fill="none" stroke="#a855f7" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
      <path d={mkPath(data.spy)} fill="none" stroke="#22d3ee" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

// ── Commodities list sparkline — live 20D USCI (cyan) + 200d SMA (purple), falls back to SparkD ──
function CommoditiesMiniSpark({ seed, trend, color, w = 56, h = 20 }) {
  const [data, setData] = useStateA(null);
  useEffectA(() => {
    let alive = true;
    if (window.MarketHubData) {
      window.MarketHubData.loadHistory('commodities', '20D').then((r) => {
        if (!alive || !r || !r.values || r.values.length < 2) return;
        const sma200 = (r.overlays || []).find(o => o.label === '200d SMA');
        setData({ usci: r.values, sma200: sma200 ? sma200.values : [] });
      });
    }
    return () => { alive = false; };
  }, []);
  if (!data) return <SparkD seed={seed} trend={trend} color={color} w={w} h={h} />;
  const allVals = [...data.usci, ...data.sma200].filter(v => v != null && v > 0);
  const lo = Math.min(...allVals), hi = Math.max(...allVals), span = hi - lo || 1;
  const dx = w / Math.max(data.usci.length - 1, 1);
  const mkPath = (vals) => vals.map((v, i) => v == null ? '' :
    `${(i === 0 || vals[i - 1] == null) ? 'M' : 'L'}${(i * dx).toFixed(1)},${(h - ((v - lo) / span) * h * 0.86 - h * 0.07).toFixed(1)}`
  ).join(' ');
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ display: 'block' }}>
      <path d={mkPath(data.sma200)} fill="none" stroke="#a855f7" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
      <path d={mkPath(data.usci)}   fill="none" stroke="#22d3ee" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

// ── Leadership list sparkline — live 20D SPY + RSP rebased to 0%, falls back to SparkD ──
function LeadershipMiniSpark({ seed, trend, color, w = 56, h = 20 }) {
  const [data, setData] = useStateA(null);
  useEffectA(() => {
    let alive = true;
    fetch('/api/leadership?range=1mo')
      .then(r => r.json())
      .then(j => {
        if (!alive || !j.prices || !j.dates?.length) return;
        const rebase = (arr) => {
          const first = (arr || []).find(v => v != null && v > 0);
          if (!first) return arr || [];
          return (arr || []).map(v => v == null ? null : ((v - first) / first) * 100);
        };
        setData({ spy: rebase(j.prices.SPY || []), rsp: rebase(j.prices.RSP || []) });
      })
      .catch(() => {});
    return () => { alive = false; };
  }, []);
  if (!data) return <SparkD seed={seed} trend={trend} color={color} w={w} h={h} />;
  const allVals = [...data.spy, ...data.rsp].filter(v => v != null);
  const lo = Math.min(...allVals), hi = Math.max(...allVals), span = hi - lo || 1;
  const dx = w / Math.max(data.spy.length - 1, 1);
  const mkPath = (vals) => vals.map((v, i) => v == null ? '' :
    `${(i === 0 || vals[i - 1] == null) ? 'M' : 'L'}${(i * dx).toFixed(1)},${(h - ((v - lo) / span) * h * 0.86 - h * 0.07).toFixed(1)}`
  ).join(' ');
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ display: 'block' }}>
      <path d={mkPath(data.spy)} fill="none" stroke="#22d3ee" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
      <path d={mkPath(data.rsp)} fill="none" stroke="#a855f7" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

// ── Breadth list sparkline — live 20D MMTH (purple) + MMFI (cyan), falls back to SparkD ──
function BreadthMiniSpark({ seed, trend, color, w = 56, h = 20 }) {
  const [data, setData] = useStateA(null);
  useEffectA(() => {
    let alive = true;
    const cb = new Date().toISOString().slice(0, 10);
    fetch(`/api/breadth-history?range=20d&_cb=${cb}`)
      .then(r => r.json())
      .then(j => {
        if (!alive || !Array.isArray(j.mmth) || !j.mmth.length) return;
        setData({ mmth: j.mmth, mmfi: j.mmfi || [] });
      })
      .catch(() => {});
    return () => { alive = false; };
  }, []);
  if (!data) return <SparkD seed={seed} trend={trend} color={color} w={w} h={h} />;
  const allVals = [...data.mmth, ...data.mmfi].filter(v => v != null);
  const lo = Math.min(...allVals), hi = Math.max(...allVals), span = hi - lo || 1;
  const dx = w / Math.max(data.mmth.length - 1, 1);
  const mkPath = (vals) => vals.map((v, i) => v == null ? '' :
    `${(i === 0 || vals[i - 1] == null) ? 'M' : 'L'}${(i * dx).toFixed(1)},${(h - ((v - lo) / span) * h * 0.86 - h * 0.07).toFixed(1)}`
  ).join(' ');
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ display: 'block' }}>
      <path d={mkPath(data.mmth)} fill="none" stroke="#a855f7" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
      <path d={mkPath(data.mmfi)} fill="none" stroke="#22d3ee" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

// ── Equities list sparkline — live 20D IWM (indigo) / FCX (cyan) / GDX (amber) rebased to 0% ──
function EquitiesMiniSpark({ seed, trend, color, w = 56, h = 20 }) {
  const [data, setData] = useStateA(null);
  useEffectA(() => {
    let alive = true;
    fetch('/api/equities-history?range=3mo')
      .then(r => r.json())
      .then(j => {
        if (!alive || !j.dates?.length || !j.equities?.length) return;
        const rebase = (sym) => {
          const eq = j.equities.find(e => e.sym === sym);
          const sliced = (eq?.prices || []).slice(-20);
          const first = sliced.find(v => v != null && v > 0);
          if (!first) return sliced;
          return sliced.map(v => v == null ? null : ((v / first - 1) * 100));
        };
        setData({ iwm: rebase('IWM'), fcx: rebase('FCX'), gdx: rebase('GDX') });
      })
      .catch(() => {});
    return () => { alive = false; };
  }, []);
  if (!data) return <SparkD seed={seed} trend={trend} color={color} w={w} h={h} />;
  const allVals = [...data.iwm, ...data.fcx, ...data.gdx].filter(v => v != null);
  const lo = Math.min(...allVals), hi = Math.max(...allVals), span = hi - lo || 1;
  const dx = w / Math.max(data.iwm.length - 1, 1);
  const mkPath = (vals) => vals.map((v, i) => v == null ? '' :
    `${(i === 0 || vals[i - 1] == null) ? 'M' : 'L'}${(i * dx).toFixed(1)},${(h - ((v - lo) / span) * h * 0.86 - h * 0.07).toFixed(1)}`
  ).join(' ');
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ display: 'block' }}>
      <path d={mkPath(data.gdx)} fill="none" stroke="#f59e0b" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
      <path d={mkPath(data.fcx)} fill="none" stroke="#22d3ee" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
      <path d={mkPath(data.iwm)} fill="none" stroke="#818cf8" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

// ── Credit list sparkline — live 20D HYG (green) vs LQD (purple) normalised return, falls back to SparkD ──
function CreditMiniSpark({ seed, trend, color, w = 56, h = 20 }) {
  const [data, setData] = useStateA(null);
  useEffectA(() => {
    let alive = true;
    Promise.all([
      fetch('/api/history?symbol=HYG&range=20d').then(r => r.json()),
      fetch('/api/history?symbol=LQD&range=20d').then(r => r.json()),
    ]).then(([hyg, lqd]) => {
      if (!alive) return;
      const rebase = (closes) => {
        const arr = (closes || []).slice(-20).map(v => v == null ? null : Number(v));
        const first = arr.find(v => v != null && v > 0);
        if (!first) return arr;
        return arr.map(v => v == null ? null : ((v - first) / first) * 100);
      };
      const h20 = rebase(hyg.closes), l20 = rebase(lqd.closes);
      if (!h20.length) return;
      setData({ hyg: h20, lqd: l20 });
    }).catch(() => {});
    return () => { alive = false; };
  }, []);
  if (!data) return <SparkD seed={seed} trend={trend} color={color} w={w} h={h} />;
  const allVals = [...data.hyg, ...data.lqd].filter(v => v != null && !isNaN(v));
  const lo = Math.min(...allVals), hi = Math.max(...allVals), span = hi - lo || 1;
  const dx = w / Math.max(data.hyg.length - 1, 1);
  const mkPath = (vals) => vals.map((v, i) => v == null || isNaN(v) ? '' :
    `${(i === 0 || vals[i - 1] == null) ? 'M' : 'L'}${(i * dx).toFixed(1)},${(h - ((v - lo) / span) * h * 0.86 - h * 0.07).toFixed(1)}`
  ).join(' ');
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ display: 'block' }}>
      <path d={mkPath(data.lqd)} fill="none" stroke="#a855f7" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
      <path d={mkPath(data.hyg)} fill="none" stroke="#22c55e" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

// ── Sectors list sparkline — live 20D Cyclicals (purple) vs Defensives (cyan), falls back to SparkD ──
function SectorsMiniSpark({ seed, trend, color, w = 56, h = 20 }) {
  const [data, setData] = useStateA(null);
  useEffectA(() => {
    let alive = true;
    fetch('/api/sectors?range=3mo')
      .then(r => r.json())
      .then(j => {
        if (!alive || !j.cycAvgSeries?.length || !j.defAvgSeries?.length) return;
        setData({ cyc: j.cycAvgSeries.slice(-20).map(Number), def: j.defAvgSeries.slice(-20).map(Number) });
      })
      .catch(() => {});
    return () => { alive = false; };
  }, []);
  if (!data) return <SparkD seed={seed} trend={trend} color={color} w={w} h={h} />;
  const allVals = [...data.cyc, ...data.def].filter(v => v != null && !isNaN(v));
  const lo = Math.min(...allVals), hi = Math.max(...allVals), span = hi - lo || 1;
  const dx = w / Math.max(data.cyc.length - 1, 1);
  const mkPath = (vals) => vals.map((v, i) => v == null || isNaN(v) ? '' :
    `${(i === 0 || vals[i - 1] == null) ? 'M' : 'L'}${(i * dx).toFixed(1)},${(h - ((v - lo) / span) * h * 0.86 - h * 0.07).toFixed(1)}`
  ).join(' ');
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ display: 'block' }}>
      <path d={mkPath(data.def)} fill="none" stroke="#22d3ee" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
      <path d={mkPath(data.cyc)} fill="none" stroke="#a855f7" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

// ── Scorecard tile (grid) ──
function ScoreTile({ card, onOpen, active }) {
  const sg = DSIG[card.status];
  const [hover, setHover] = useStateA(false);
  return (
    <button onClick={onOpen} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{ all: 'unset', cursor: 'pointer', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: 12, padding: '16px 18px',
        background: '#111827', border: `1px solid ${active ? sg.line : hover ? '#28384a' : '#1e2d3d'}`, borderLeft: `3px solid ${sg.c}`, borderRadius: 14,
        boxShadow: hover ? '0 6px 20px rgba(0,0,0,.35)' : '0 1px 2px rgba(0,0,0,.3)', transform: hover ? 'translateY(-2px)' : 'none', transition: 'transform .15s ease, box-shadow .15s ease, border-color .15s ease' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontFamily: DSANS, fontSize: 15.5, fontWeight: 600, color: '#e8edf5', flex: 1 }}>{card.title}</span>
        {card.id === 'leadership'
          ? <LeadershipMiniSpark seed={card.seed} trend={card.trend} color={sg.c} w={56} h={20} />
          : card.id === 'equities'
          ? <EquitiesMiniSpark seed={card.seed} trend={card.trend} color={sg.c} w={56} h={20} />
          : card.id === 'sectors'
          ? <SectorsMiniSpark seed={card.seed} trend={card.trend} color={sg.c} w={56} h={20} />
          : card.id === 'credit'
          ? <CreditMiniSpark seed={card.seed} trend={card.trend} color={sg.c} w={56} h={20} />
          : card.id === 'commodities'
          ? <CommoditiesMiniSpark seed={card.seed} trend={card.trend} color={sg.c} w={56} h={20} />
          : <SparkD seed={card.seed} trend={card.trend} color={sg.c} w={56} h={20} />}
        <StatusPill status={card.status} size="sm" />
      </div>
      <div style={{ display: 'flex', gap: 10 }}>
        {card.rows.slice(0, 3).map((r, i) => {
          const rs = DSIG[r[3]];
          return (
            <div key={i} style={{ flex: 1, minWidth: 0, paddingLeft: i ? 11 : 0, borderLeft: i ? '1px solid #1b2736' : 'none' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: rs.c, boxShadow: `0 0 5px ${rs.glow}`, flexShrink: 0 }} />
                <span style={{ fontFamily: DMONO, fontSize: 14, fontWeight: 600, color: rs.c, whiteSpace: 'nowrap' }}>{r[1].split('\n')[0]}</span>
              </div>
              <div style={{ fontFamily: DSANS, fontSize: 10.5, color: '#64748b', marginTop: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r[0]}</div>
            </div>
          );
        })}
      </div>
    </button>
  );
}

// ════ OPTION A — Full dashboard grid (click a tile → deep-dive overlay) ════
function OptionDashboard({ D }) {
  const [open, setOpen] = useStateA(null);
  const card = open ? D.cards[open] : null;
  return (
    <div style={{ maxWidth: 1320, margin: '0 auto', padding: '26px 32px 60px', display: 'flex', flexDirection: 'column', gap: 26 }}>
      <BreadthBar exec={D.exec} cats={D.categories} />
      {D.groups.map((g) => (
        <div key={g.label} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <span style={{ fontFamily: DSANS, fontSize: 12, fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', color: '#64748b' }}>{g.label}</span>
            <div style={{ flex: 1, height: 1, background: '#16202e' }} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
            {g.ids.map((id) => <ScoreTile key={id} card={D.cards[id]} onOpen={() => setOpen(id)} />)}
          </div>
        </div>
      ))}
      {card && (
        <div onClick={() => setOpen(null)} style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(4,7,12,.72)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '52px 24px', overflowY: 'auto' }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 880, background: '#080c14', border: '1px solid #1e2d3d', borderRadius: 20, padding: '24px 28px 30px', boxShadow: '0 30px 80px rgba(0,0,0,.6)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 13, marginBottom: 22 }}>
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: DSIG[card.status].c, boxShadow: `0 0 8px ${DSIG[card.status].c}` }} />
              <span style={{ fontFamily: DSANS, fontSize: 22, fontWeight: 700, color: '#e8edf5' }}>{card.title}</span>
              <StatusPill status={card.status} />
              <button onClick={() => setOpen(null)} style={{ all: 'unset', cursor: 'pointer', marginLeft: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center', width: 34, height: 34, borderRadius: 9, background: '#0d1520', border: '1px solid #1e2d3d' }}>
                <svg width="13" height="13" viewBox="0 0 13 13"><path d="M1 1l11 11M12 1L1 12" stroke="#94a3b8" strokeWidth="1.8" strokeLinecap="round" /></svg>
              </button>
            </div>
            <DeepDiveContent card={card} cardId={open} asOf={D.asOf} chartHeight={210} />
          </div>
        </div>
      )}
    </div>
  );
}

// ════ OPTION B — Two-pane workspace (list left, deep-dive right) ════
function OptionWorkspace({ D }) {
  const allIds = D.groups.flatMap((g) => g.ids);
  const [sel, setSelRaw] = useStateA(() => { try { const v = localStorage.getItem('mh-ws-sel'); return v && D.cards[v] ? v : allIds[0]; } catch (e) { return allIds[0]; } });
  const setSel = (id) => { setSelRaw(id); try { localStorage.setItem('mh-ws-sel', id); } catch (e) {} };
  const card = D.cards[sel];
  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 58px)', overflow: 'hidden' }}>
      {/* left rail */}
      <div style={{ width: 340, flexShrink: 0, borderRight: '1px solid #16202e', background: '#0a0f17', overflowY: 'auto', padding: '20px 16px' }}>
        <div style={{ padding: '4px 8px 20px', borderBottom: '1px solid #16202e', marginBottom: 16 }}>
          {/* 4/10 left, posture + category grid right */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 10 }}>
            <span style={{ fontFamily: DSANS, fontSize: 20, fontWeight: 700, color: '#e8edf5', flexShrink: 0, lineHeight: 1.1 }}>{D.exec.bull}/{D.exec.bull + D.exec.neutral + D.exec.bear}</span>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 7 }}>
              <span style={{ fontFamily: DSANS, fontSize: 12.5, color: '#94a3b8' }}>{D.exec.posture}</span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {D.categories.map((c) => (
                  <div key={c.label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontFamily: DSANS, fontSize: 11, color: '#64748b', fontWeight: 500, flex: 1 }}>{c.label}</span>
                    <div style={{ display: 'flex', gap: 5 }}>
                      {c.cards.map((s, i) => (<span key={i} style={{ width: 8, height: 8, borderRadius: '50%', background: DSIG[s].c, boxShadow: `0 0 5px ${DSIG[s].glow}` }} />))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          {/* Risk-Off box — full width, left edge aligned with 4/10 */}
          {(() => {
            const pk = /off/i.test(D.exec.label) ? 'bearish' : /on/i.test(D.exec.label) ? 'bullish' : 'neutral';
            return (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px', borderRadius: 8, background: DSIG[pk].fill, border: `1px solid ${DSIG[pk].line}` }}>
                <span style={{ fontFamily: DSANS, fontSize: 12, fontWeight: 700, color: '#e8edf5', flex: 1 }}>
                  {D.exec.label.split(' — ').map((p, i, arr) => (
                    <span key={i} style={{ display: 'block' }}>{i < arr.length - 1 ? p + ' —' : p}</span>
                  ))}
                </span>
                <div style={{ display: 'flex', gap: 5 }}>
                  {[['bullish', D.exec.bull], ['neutral', D.exec.neutral], ['bearish', D.exec.bear]].map(([k, n]) => (
                    <span key={k} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 7px', borderRadius: 5, background: DSIG[k].fill, border: `1px solid ${DSIG[k].line}` }}>
                      <span style={{ width: 5, height: 5, borderRadius: '50%', background: DSIG[k].c, flexShrink: 0 }} />
                      <span style={{ fontFamily: DMONO, fontSize: 11, fontWeight: 600, color: DSIG[k].c }}>{n}</span>
                    </span>
                  ))}
                </div>
              </div>
            );
          })()}
        </div>
        {D.groups.map((g) => (
          <div key={g.label} style={{ marginBottom: 16 }}>
            <div style={{ fontFamily: DSANS, fontSize: 10, fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', color: '#8295a9', padding: '0 8px 8px' }}>{g.label}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {g.ids.map((id) => {
                const c = D.cards[id], sg = DSIG[c.status], on = id === sel;
                return (
                  <button key={id} onClick={() => setSel(id)} style={{ all: 'unset', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 11, padding: '11px 12px', borderRadius: 10,
                    background: on ? '#141f2e' : 'transparent', border: `1px solid ${on ? '#24364a' : 'transparent'}`, borderLeft: `3px solid ${on ? sg.c : 'transparent'}` }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: sg.c, boxShadow: `0 0 6px ${sg.glow}`, flexShrink: 0 }} />
                    <span style={{ fontFamily: DSANS, fontSize: 13.5, color: on ? '#e8edf5' : '#cbd5e1', fontWeight: on ? 600 : 400, flex: 1 }}>{c.title}</span>
                    {id === 'regime'
                      ? <RegimeMiniSpark seed={c.seed} trend={c.trend} color={sg.c} w={46} h={16} />
                      : id === 'leadership'
                      ? <LeadershipMiniSpark seed={c.seed} trend={c.trend} color={sg.c} w={46} h={16} />
                      : id === 'breadth'
                      ? <BreadthMiniSpark seed={c.seed} trend={c.trend} color={sg.c} w={46} h={16} />
                      : id === 'sectors'
                      ? <SectorsMiniSpark seed={c.seed} trend={c.trend} color={sg.c} w={46} h={16} />
                      : id === 'credit'
                      ? <CreditMiniSpark seed={c.seed} trend={c.trend} color={sg.c} w={46} h={16} />
                      : id === 'commodities'
                      ? <CommoditiesMiniSpark seed={c.seed} trend={c.trend} color={sg.c} w={46} h={16} />
                      : <SparkD seed={c.seed} trend={c.trend} color={sg.c} w={46} h={16} />}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      {/* right deep-dive */}
      <div style={{ flex: 1, overflowY: 'scroll', padding: '28px 36px 60px' }}>
        <div style={{ maxWidth: 820, margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 13, marginBottom: 24 }}>
            <span style={{ width: 11, height: 11, borderRadius: '50%', background: DSIG[card.status].c, boxShadow: `0 0 9px ${DSIG[card.status].c}` }} />
            <span style={{ fontFamily: DSANS, fontSize: 25, fontWeight: 700, color: '#e8edf5' }}>{card.title}</span>
            <StatusPill status={card.status} />
            <span style={{ marginLeft: 'auto', fontFamily: DMONO, fontSize: 12, color: '#64748b' }}>As of {D.asOf}</span>
          </div>
          <DeepDiveContent card={card} cardId={sel} asOf={D.asOf} chartHeight={190} />
        </div>
      </div>
    </div>
  );
}

// ════ OPTION C — Glance → dedicated deep-dive page ════
function OptionGlancePage({ D, open: openProp, onSetOpen }) {
  const [openState, setOpenState] = useStateA(null);
  const open = openProp !== undefined ? openProp : openState;
  const setOpen = onSetOpen || setOpenState;
  if (open) {
    const card = D.cards[open];
    return (
      <div style={{ maxWidth: 920, margin: '0 auto', padding: '24px 32px 60px' }}>
        <button onClick={() => setOpen(null)} style={{ all: 'unset', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 9, padding: '9px 15px', borderRadius: 10, background: '#0d1520', border: '1px solid #1e2d3d', marginBottom: 22 }}>
          <svg width="8" height="13" viewBox="0 0 8 13"><path d="M6.5 1L1.5 6.5l5 5.5" stroke="#94a3b8" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
          <span style={{ fontFamily: DSANS, fontSize: 13, color: '#94a3b8', fontWeight: 500 }}>All signals</span>
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 13, marginBottom: 24 }}>
          <span style={{ width: 11, height: 11, borderRadius: '50%', background: DSIG[card.status].c, boxShadow: `0 0 9px ${DSIG[card.status].c}` }} />
          <span style={{ fontFamily: DSANS, fontSize: 26, fontWeight: 700, color: '#e8edf5' }}>{card.title}</span>
          <StatusPill status={card.status} />
        </div>
        <DeepDiveContent card={card} cardId={open} asOf={D.asOf} />
      </div>
    );
  }
  return (
    <div style={{ maxWidth: 760, margin: '0 auto', padding: '30px 28px 60px', display: 'flex', flexDirection: 'column', gap: 22 }}>
      <BreadthBar exec={D.exec} cats={D.categories} />
      {D.groups.map((g) => (
        <div key={g.label} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <span style={{ fontFamily: DSANS, fontSize: 11, fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', color: '#8295a9', paddingLeft: 2 }}>{g.label}</span>
          {g.ids.map((id) => {
            const c = D.cards[id], sg = DSIG[c.status];
            return (
              <button key={id} onClick={() => setOpen(id)} style={{ all: 'unset', cursor: 'pointer', boxSizing: 'border-box', display: 'flex', alignItems: 'center', gap: 16, padding: '15px 18px', width: '100%',
                background: '#111827', border: '1px solid #1e2d3d', borderLeft: `3px solid ${sg.c}`, borderRadius: 13 }}>
                <span style={{ fontFamily: DSANS, fontSize: 15.5, fontWeight: 600, color: '#e8edf5', width: 150 }}>{c.title}</span>
                <div style={{ display: 'flex', gap: 22, flex: 1 }}>
                  {c.rows.slice(0, 3).map((r, i) => {
                    const rs = DSIG[r[3]];
                    return (
                      <div key={i} style={{ minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ width: 5, height: 5, borderRadius: '50%', background: rs.c, boxShadow: `0 0 5px ${rs.glow}` }} />
                          <span style={{ fontFamily: DMONO, fontSize: 13.5, fontWeight: 600, color: rs.c, whiteSpace: 'nowrap' }}>{r[1].split('\n')[0]}</span>
                        </div>
                        <div style={{ fontFamily: DSANS, fontSize: 10.5, color: '#64748b', marginTop: 3, whiteSpace: 'nowrap' }}>{r[0]}</div>
                      </div>
                    );
                  })}
                </div>
                {id === 'regime'
                  ? <RegimeMiniSpark seed={c.seed} trend={c.trend} color={sg.c} w={64} h={22} />
                  : id === 'leadership'
                  ? <LeadershipMiniSpark seed={c.seed} trend={c.trend} color={sg.c} w={64} h={22} />
                  : id === 'breadth'
                  ? <BreadthMiniSpark seed={c.seed} trend={c.trend} color={sg.c} w={64} h={22} />
                  : id === 'equities'
                  ? <EquitiesMiniSpark seed={c.seed} trend={c.trend} color={sg.c} w={64} h={22} />
                  : id === 'sectors'
                  ? <SectorsMiniSpark seed={c.seed} trend={c.trend} color={sg.c} w={64} h={22} />
                  : id === 'credit'
                  ? <CreditMiniSpark seed={c.seed} trend={c.trend} color={sg.c} w={64} h={22} />
                  : id === 'commodities'
                  ? <CommoditiesMiniSpark seed={c.seed} trend={c.trend} color={sg.c} w={64} h={22} />
                  : <SparkD seed={c.seed} trend={c.trend} color={sg.c} w={64} h={22} />}
                <StatusPill status={c.status} size="sm" />
                <svg width="7" height="12" viewBox="0 0 7 12"><path d="M1 1l5 5-5 5" stroke="#334155" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}

// ════ Shell with prototype switcher ════
const OPTIONS = [
  { id: 'dashboard', label: 'A · Dashboard grid', sub: 'All cards at once', render: (D) => <OptionDashboard D={D} /> },
  { id: 'workspace', label: 'B · Two-pane workspace', sub: 'List + live deep-dive', render: (D) => <OptionWorkspace D={D} /> },
  { id: 'glance', label: 'C · Glance → page', sub: 'Scan, then drill in', render: (D) => <OptionGlancePage D={D} /> },
];

function DesktopApp() {
  const D = useGlance();
  const [opt, setOpt] = useStateA(() => { try { return localStorage.getItem('mh-desk-opt') || 'dashboard'; } catch (e) { return 'dashboard'; } });
  const pick = (id) => { setOpt(id); try { localStorage.setItem('mh-desk-opt', id); } catch (e) {} };
  const current = OPTIONS.find((o) => o.id === opt) || OPTIONS[0];
  return (
    <div style={{ minHeight: '100vh', background: '#080c14' }}>
      {/* top bar */}
      <div style={{ position: 'sticky', top: 0, zIndex: 50, display: 'flex', alignItems: 'center', gap: 18, height: 58, padding: '0 24px', background: 'rgba(8,12,20,.86)', backdropFilter: 'blur(10px)', borderBottom: '1px solid #16202e' }}>
        <svg width="24" height="21" viewBox="0 0 30 26"><rect x="0" y="14" width="7" height="12" rx="1.5" fill="#ef4444" /><rect x="11.5" y="7" width="7" height="19" rx="1.5" fill="#f59e0b" /><rect x="23" y="0" width="7" height="26" rx="1.5" fill="#22c55e" /></svg>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontFamily: DSANS, fontSize: 15, fontWeight: 700, color: '#e8edf5', lineHeight: 1.1 }}>Market Hub</span>
          <span style={{ fontFamily: DSANS, fontSize: 10.5, color: '#64748b' }}>Macro Framework</span>
        </div>
        {/* prototype switcher */}
        <div style={{ marginLeft: 24, display: 'flex', gap: 4, padding: 4, background: '#0d1520', border: '1px solid #1e2d3d', borderRadius: 11 }}>
          {OPTIONS.map((o) => (
            <button key={o.id} onClick={() => pick(o.id)} title={o.sub} style={{ all: 'unset', cursor: 'pointer', display: 'flex', flexDirection: 'column', padding: '6px 14px', borderRadius: 8,
              background: o.id === opt ? '#1b2736' : 'transparent', border: `1px solid ${o.id === opt ? '#28384a' : 'transparent'}` }}>
              <span style={{ fontFamily: DSANS, fontSize: 12.5, fontWeight: 600, color: o.id === opt ? '#e8edf5' : '#94a3b8' }}>{o.label}</span>
              <span style={{ fontFamily: DSANS, fontSize: 10, color: '#8295a9' }}>{o.sub}</span>
            </button>
          ))}
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8, padding: '7px 12px', borderRadius: 9, background: '#0d1520', border: '1px solid #1e2d3d' }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 6px #22c55e' }} />
          <span style={{ fontFamily: DMONO, fontSize: 12, color: '#94a3b8' }}>As of {D.asOf}</span>
        </div>
      </div>
      {/* prototype label banner */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 28px', background: '#0a0f17', borderBottom: '1px solid #16202e' }}>
        <span style={{ fontFamily: DSANS, fontSize: 11, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: '#8295a9' }}>Prototype</span>
        <span style={{ fontFamily: DSANS, fontSize: 13, color: '#94a3b8' }}>{current.label.replace(/^.·\s/, '')} — {current.sub}</span>
      </div>
      {current.render(D)}
    </div>
  );
}

window.DesktopApp = DesktopApp;

// ── Solo shell — renders a single option full-screen (for per-option preview cards) ──
function SoloShell({ optId }) {
  const D = useGlance();
  const o = OPTIONS.find((x) => x.id === optId) || OPTIONS[0];
  return (
    <div style={{ minHeight: '100vh', background: '#080c14' }}>
      <div style={{ position: 'sticky', top: 0, zIndex: 50, display: 'flex', alignItems: 'center', gap: 16, height: 58, padding: '0 24px', background: 'rgba(8,12,20,.86)', backdropFilter: 'blur(10px)', borderBottom: '1px solid #16202e' }}>
        <svg width="24" height="21" viewBox="0 0 30 26"><rect x="0" y="14" width="7" height="12" rx="1.5" fill="#ef4444" /><rect x="11.5" y="7" width="7" height="19" rx="1.5" fill="#f59e0b" /><rect x="23" y="0" width="7" height="26" rx="1.5" fill="#22c55e" /></svg>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontFamily: DSANS, fontSize: 15, fontWeight: 700, color: '#e8edf5', lineHeight: 1.1 }}>Market Hub</span>
          <span style={{ fontFamily: DSANS, fontSize: 10.5, color: '#64748b' }}>Macro Framework</span>
        </div>
        <div style={{ marginLeft: 18, display: 'flex', flexDirection: 'column', padding: '6px 14px', borderRadius: 9, background: '#1b2736', border: '1px solid #28384a' }}>
          <span style={{ fontFamily: DSANS, fontSize: 12.5, fontWeight: 600, color: '#e8edf5' }}>{o.label}</span>
          <span style={{ fontFamily: DSANS, fontSize: 10, color: '#8295a9' }}>{o.sub}</span>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8, padding: '7px 12px', borderRadius: 9, background: '#0d1520', border: '1px solid #1e2d3d' }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 6px #22c55e' }} />
          <span style={{ fontFamily: DMONO, fontSize: 12, color: '#94a3b8' }}>As of {D.asOf}</span>
        </div>
      </div>
      {o.render(D)}
    </div>
  );
}

window.SoloShell = SoloShell;

// ── Toggle shell — flip between just B (workspace) and C (glance) ──
function ToggleShell() {
  const D = useGlance();
  const [mode, setMode] = useStateA(() => { try { return localStorage.getItem('mh-bc') || 'workspace'; } catch (e) { return 'workspace'; } });
  const [glanceOpen, setGlanceOpen] = useStateA(null);
  const pick = (m) => { setMode(m); try { localStorage.setItem('mh-bc', m); } catch (e) {} };
  const goHome = () => { if (mode === 'glance') setGlanceOpen(null); };
  const TABS = [
    { id: 'workspace', label: 'Workspace', sub: 'List + live deep-dive' },
    { id: 'glance', label: 'Glance', sub: 'Scan, then drill in' },
  ];
  return (
    <div style={{ minHeight: '100vh', background: '#080c14' }}>
      <div style={{ position: 'sticky', top: 0, zIndex: 50, display: 'flex', alignItems: 'center', gap: 18, height: 58, padding: '0 24px', background: 'rgba(8,12,20,.86)', backdropFilter: 'blur(10px)', borderBottom: '1px solid #16202e' }}>
        <button onClick={goHome} title="Back to home" style={{ all: 'unset', cursor: mode === 'glance' ? 'pointer' : 'default', display: 'flex', alignItems: 'center', gap: 10 }}>
          <svg width="24" height="21" viewBox="0 0 30 26"><rect x="0" y="14" width="7" height="12" rx="1.5" fill="#ef4444" /><rect x="11.5" y="7" width="7" height="19" rx="1.5" fill="#f59e0b" /><rect x="23" y="0" width="7" height="26" rx="1.5" fill="#22c55e" /></svg>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
            <span style={{ fontFamily: DSANS, fontSize: 15, fontWeight: 700, color: '#e8edf5', lineHeight: 1.1 }}>Market Hub</span>
            <span style={{ fontFamily: DSANS, fontSize: 10.5, color: '#64748b' }}>Macro Framework</span>
          </div>
        </button>
        {/* the toggle — right-aligned, replaces date */}
        <div style={{ marginLeft: 'auto', display: 'flex', padding: 3, background: '#0d1520', border: '1px solid #1e2d3d', borderRadius: 8 }}>
          {TABS.map((t) => (
            <button key={t.id} onClick={() => pick(t.id)} style={{ all: 'unset', cursor: 'pointer', padding: '4px 12px', borderRadius: 6,
              background: t.id === mode ? '#1b2736' : 'transparent', border: `1px solid ${t.id === mode ? '#28384a' : 'transparent'}`, transition: 'background .18s ease' }}>
              <span style={{ fontFamily: DSANS, fontSize: 12.5, fontWeight: 600, color: t.id === mode ? '#e8edf5' : '#64748b' }}>{t.label}</span>
            </button>
          ))}
        </div>
      </div>
      {mode === 'workspace' ? <OptionWorkspace D={D} /> : <OptionGlancePage D={D} open={glanceOpen} onSetOpen={setGlanceOpen} />}
    </div>
  );
}

window.ToggleShell = ToggleShell;
