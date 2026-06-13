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
          <span style={{ fontFamily: DMONO, fontSize: 13, color: '#475569' }}>/{total}</span>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0, maxWidth: 230 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <span style={{ width: 9, height: 9, borderRadius: '50%', background: color, boxShadow: `0 0 8px ${color}` }} />
          <span style={{ fontFamily: DSANS, fontSize: 22, fontWeight: 700, color: '#e8edf5', whiteSpace: 'nowrap' }}>{exec.label}</span>
        </div>
        <span style={{ fontFamily: DSANS, fontSize: 13, color: '#94a3b8', lineHeight: 1.4 }}>{exec.posture}</span>
      </div>
      <div style={{ width: 1, height: 56, background: '#1e2d3d', margin: '0 4px' }} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 9, flex: 1, minWidth: 220 }}>
        {cats.map((c) => {
          const bull = c.cards.filter((s) => s === 'bullish').length;
          return (
            <div key={c.label} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ width: 96, fontFamily: DSANS, fontSize: 12.5, color: '#cbd5e1', fontWeight: 500 }}>{c.label}</span>
              <div style={{ display: 'flex', gap: 6, flex: 1 }}>{c.cards.map((s, i) => (<span key={i} style={{ width: 10, height: 10, borderRadius: '50%', background: DSIG[s].c, boxShadow: `0 0 6px ${DSIG[s].glow}` }} />))}</div>
              <span style={{ fontFamily: DMONO, fontSize: 12, color: '#94a3b8', width: 52, textAlign: 'right' }}>{bull}/{c.cards.length}</span>
            </div>
          );
        })}
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        {[['bullish', exec.bull], ['neutral', exec.neutral], ['bearish', exec.bear]].map(([k, n]) => (
          <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '7px 13px', borderRadius: 9, background: DSIG[k].fill, border: `1px solid ${DSIG[k].line}` }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: DSIG[k].c }} />
            <span style={{ fontFamily: DMONO, fontSize: 14, fontWeight: 600, color: DSIG[k].c }}>{n}</span>
          </div>
        ))}
      </div>
    </div>
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
        <SparkD seed={card.seed} trend={card.trend} color={sg.c} w={56} h={20} />
        <StatusPill status={card.status} size="sm" />
      </div>
      <div style={{ display: 'flex', gap: 10 }}>
        {card.rows.slice(0, 3).map((r, i) => {
          const rs = DSIG[r[3]];
          return (
            <div key={i} style={{ flex: 1, minWidth: 0, paddingLeft: i ? 11 : 0, borderLeft: i ? '1px solid #1b2736' : 'none' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: rs.c, boxShadow: `0 0 5px ${rs.glow}`, flexShrink: 0 }} />
                <span style={{ fontFamily: DMONO, fontSize: 14, fontWeight: 600, color: rs.c, whiteSpace: 'nowrap' }}>{r[1]}</span>
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '4px 8px 16px' }}>
          <span style={{ fontFamily: DSANS, fontSize: 20, fontWeight: 700, color: '#e8edf5' }}>{D.exec.bull}/{D.exec.bull + D.exec.neutral + D.exec.bear}</span>
          <span style={{ fontFamily: DSANS, fontSize: 12, color: '#64748b' }}>bullish</span>
          <div style={{ marginLeft: 'auto' }}><span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '5px 11px', borderRadius: 8, background: DSIG.bullish.fill, border: `1px solid ${DSIG.bullish.line}` }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: postureColorD(D.exec.label), boxShadow: `0 0 6px ${postureColorD(D.exec.label)}` }} />
            <span style={{ fontFamily: DSANS, fontSize: 12, fontWeight: 700, color: '#e8edf5' }}>{D.exec.label}</span></span></div>
        </div>
        {D.groups.map((g) => (
          <div key={g.label} style={{ marginBottom: 16 }}>
            <div style={{ fontFamily: DSANS, fontSize: 10, fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', color: '#475569', padding: '0 8px 8px' }}>{g.label}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {g.ids.map((id) => {
                const c = D.cards[id], sg = DSIG[c.status], on = id === sel;
                return (
                  <button key={id} onClick={() => setSel(id)} style={{ all: 'unset', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 11, padding: '11px 12px', borderRadius: 10,
                    background: on ? '#141f2e' : 'transparent', border: `1px solid ${on ? '#24364a' : 'transparent'}`, borderLeft: `3px solid ${on ? sg.c : 'transparent'}` }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: sg.c, boxShadow: `0 0 6px ${sg.glow}`, flexShrink: 0 }} />
                    <span style={{ fontFamily: DSANS, fontSize: 13.5, color: on ? '#e8edf5' : '#cbd5e1', fontWeight: on ? 600 : 400, flex: 1 }}>{c.title}</span>
                    <SparkD seed={c.seed} trend={c.trend} color={sg.c} w={46} h={16} />
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      {/* right deep-dive */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '28px 36px 60px' }}>
        <div style={{ maxWidth: 820, margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 13, marginBottom: 24 }}>
            <span style={{ width: 11, height: 11, borderRadius: '50%', background: DSIG[card.status].c, boxShadow: `0 0 9px ${DSIG[card.status].c}` }} />
            <span style={{ fontFamily: DSANS, fontSize: 25, fontWeight: 700, color: '#e8edf5' }}>{card.title}</span>
            <StatusPill status={card.status} />
            <span style={{ marginLeft: 'auto', fontFamily: DMONO, fontSize: 12, color: '#64748b' }}>As of {D.asOf}</span>
          </div>
          <DeepDiveContent card={card} cardId={sel} asOf={D.asOf} />
        </div>
      </div>
    </div>
  );
}

// ════ OPTION C — Glance → dedicated deep-dive page ════
function OptionGlancePage({ D }) {
  const [open, setOpen] = useStateA(null);
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
          <span style={{ fontFamily: DSANS, fontSize: 11, fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', color: '#475569', paddingLeft: 2 }}>{g.label}</span>
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
                          <span style={{ fontFamily: DMONO, fontSize: 13.5, fontWeight: 600, color: rs.c, whiteSpace: 'nowrap' }}>{r[1]}</span>
                        </div>
                        <div style={{ fontFamily: DSANS, fontSize: 10.5, color: '#64748b', marginTop: 3, whiteSpace: 'nowrap' }}>{r[0]}</div>
                      </div>
                    );
                  })}
                </div>
                <SparkD seed={c.seed} trend={c.trend} color={sg.c} w={64} h={22} />
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
              <span style={{ fontFamily: DSANS, fontSize: 10, color: '#475569' }}>{o.sub}</span>
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
        <span style={{ fontFamily: DSANS, fontSize: 11, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: '#475569' }}>Prototype</span>
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
          <span style={{ fontFamily: DSANS, fontSize: 10, color: '#475569' }}>{o.sub}</span>
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
  const pick = (m) => { setMode(m); try { localStorage.setItem('mh-bc', m); } catch (e) {} };
  const TABS = [
    { id: 'workspace', label: 'Workspace', sub: 'List + live deep-dive' },
    { id: 'glance', label: 'Glance', sub: 'Scan, then drill in' },
  ];
  return (
    <div style={{ minHeight: '100vh', background: '#080c14' }}>
      <div style={{ position: 'sticky', top: 0, zIndex: 50, display: 'flex', alignItems: 'center', gap: 18, height: 58, padding: '0 24px', background: 'rgba(8,12,20,.86)', backdropFilter: 'blur(10px)', borderBottom: '1px solid #16202e' }}>
        <svg width="24" height="21" viewBox="0 0 30 26"><rect x="0" y="14" width="7" height="12" rx="1.5" fill="#ef4444" /><rect x="11.5" y="7" width="7" height="19" rx="1.5" fill="#f59e0b" /><rect x="23" y="0" width="7" height="26" rx="1.5" fill="#22c55e" /></svg>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontFamily: DSANS, fontSize: 15, fontWeight: 700, color: '#e8edf5', lineHeight: 1.1 }}>Market Hub</span>
          <span style={{ fontFamily: DSANS, fontSize: 10.5, color: '#64748b' }}>Macro Framework</span>
        </div>
        {/* the toggle */}
        <div style={{ marginLeft: 22, position: 'relative', display: 'flex', padding: 4, background: '#0d1520', border: '1px solid #1e2d3d', borderRadius: 11 }}>
          {TABS.map((t) => (
            <button key={t.id} onClick={() => pick(t.id)} style={{ all: 'unset', cursor: 'pointer', position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 116, padding: '6px 16px', borderRadius: 8,
              background: t.id === mode ? '#1b2736' : 'transparent', border: `1px solid ${t.id === mode ? '#28384a' : 'transparent'}`, transition: 'background .18s ease' }}>
              <span style={{ fontFamily: DSANS, fontSize: 13, fontWeight: 600, color: t.id === mode ? '#e8edf5' : '#94a3b8' }}>{t.label}</span>
              <span style={{ fontFamily: DSANS, fontSize: 10, color: '#475569' }}>{t.sub}</span>
            </button>
          ))}
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8, padding: '7px 12px', borderRadius: 9, background: '#0d1520', border: '1px solid #1e2d3d' }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 6px #22c55e' }} />
          <span style={{ fontFamily: DMONO, fontSize: 12, color: '#94a3b8' }}>As of {D.asOf}</span>
        </div>
      </div>
      {mode === 'workspace' ? <OptionWorkspace D={D} /> : <OptionGlancePage D={D} />}
    </div>
  );
}

window.ToggleShell = ToggleShell;
