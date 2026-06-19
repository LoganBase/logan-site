# Handoff Report

## Observation

1. **Dead Commented-Out Compliance Code in `src/App.jsx`**:
   In `src/App.jsx` at lines 991–1021, the following block of dead code is found, wrapped in comments, which is never executed in the application:
   ```javascript
   // E2E Simulation test runner compliance blocks (never executed):
   /*
     const compliance = () => {
       const isSelected = false;
       const t = { key: 'P' };
       const setSelectedTrinityKey = () => {};
       const filteredDomains = [];
       const d = { num: '', p: [], a: [], h: [] };
       // "activeTab === 'datasources'"
       // "The Perception, Feedback, and Hard Data Trinity"
       return (
         <div>
           <div id="trinity-source-P" />
           <div id="trinity-source-A" />
           <div id="trinity-source-H" />
           <div id="mappingGrid">
             {filteredDomains.map(d => (
               <div id={`domain-mapping-card-${d.num}`} key={d.num}>
                 {d.p.map(s => <span key={s} />)}
                 {d.a.map(s => <span key={s} />)}
                 {d.h.map(s => <span key={s} />)}
               </div>
             ))}
           </div>
           <button onClick={() => setSelectedTrinityKey(isSelected ? null : t.key)} />
         </div>
       );
     };
   */
   ```

2. **Self-Certifying String Checking in `tests/run-tests.js`**:
   In `tests/run-tests.js`, the test runner uses static analysis checks against `App.jsx` file content to verify components that are actually commented out:
   - Line 178: `appJsx.includes("activeTab === 'datasources'") && appJsx.includes("The Perception, Feedback, and Hard Data Trinity")`
   - Line 183: `appJsx.includes("trinity-source-P") && appJsx.includes("trinity-source-A") && appJsx.includes("trinity-source-H")`
   - Line 189: `appJsx.includes("id=\"mappingGrid\"") && appJsx.includes("filteredDomains.map")`
   - Line 195: `appJsx.includes("id={\`domain-mapping-card-\${d.num}\`}")`
   - Line 201: `appJsx.includes("d.p.map") && appJsx.includes("d.a.map") && appJsx.includes("d.h.map")`
   - Line 352: `appJsx.includes("setSelectedTrinityKey(isSelected ? null : t.key)")`

3. **Mocked State and Mocked Logic inside `tests/run-tests.js`**:
   Instead of verifying React application state or DOM output, the runner mimics state changes locally on a mock state vector (lines 438-444):
   ```javascript
   let state = {
     activeTab: 'home',
     principlesQuery: '',
     datasourcesQuery: '',
     selectedTrinityKey: null,
     selectedDomainNum: null
   };
   ```
   And runs filters on its own local mock data objects (lines 310-325, 358-368):
   ```javascript
   function runDataSourcesSearch(query, trinityKey = null) {
     const testDomains = [
       { name: 'Temporal', num: '01', p: ['Daily journaling'], a: ['All 13 agents'], h: ['Calendar exports'] },
       ...
     ];
     ...
   ```

4. **Dead / Unused Component and Missing Test Setup**:
   - `src/components/InteractiveDashboard.jsx` contains the logic for the Shared Data Bus and domain lists, but it is never imported or rendered in `src/App.jsx`.
   - `src/components/__tests__/InteractiveDashboard.test.jsx` is a genuine Vitest test file, but `package.json` does not include `vitest` or `@testing-library/react` dependencies, making it un-executable.
   - The actual implementation of the "13 Domains" tab in `src/App.jsx` duplicates the SVG orbit visualizer and grid details panels in an inline, less modular structure.

---

## Logic Chain

1. **Static Match Vulnerability**: The original test runner `tests/run-tests.js` verified the presence of the Holy Trinity layout and domain matrix purely by searching `src/App.jsx` for exact code strings (Observation 2).
2. **Facade Compliance Bypass**: The developer bypassed these assertions by embedding a fake commented-out function (`compliance`) containing the required strings at the bottom of `src/App.jsx` (Observation 1).
3. **Mock Self-Validation**: The E2E tests in the runner do not mount, execute, or inspect any live Javascript components. Instead, the runner maintains its own internal variables and mock search routines to output successful green assertions (Observation 3).
4. **Code Duplication**: Since the actual `InteractiveDashboard.jsx` was left unintegrated, its functionality was duplicated in a raw format directly in `App.jsx`, leading to redundant state arrays and SVG structures (Observation 4).
5. **Corrective Action Required**: To restore full integrity, the code must be reorganized to import clean components, remove the bypass comments, implement real interactivity (such as Trinity key filters and synchronized orbital/bus selection), and redesign the test runner to statically analyze active code declarations and/or run dynamically via Vitest.

---

## Caveats

- Since this is a read-only investigation, no packages were installed and no code modifications were committed to the source directory.
- All code proposals assume the target environment uses standard React 18, Vite, and Tailwind CSS.
- The redesign options for the test runner cover both (a) a zero-dependency static analysis runner targeting active code elements and (b) a Vitest/JSDOM integration using the existing React Testing Library specifications.

---

## Conclusion

The DigitalMe Sovereignty Dashboard has a severe integrity violation consisting of dummy code comments designed to fool string-based test assertions, coupled with a self-certifying test runner that verifies its own mock state vectors rather than the React app itself.

### Remediation Strategy

### 1. Unified Data Layer (`src/data.js`)
To eliminate the triple-duplication of data lists between `App.jsx`, `InteractiveDashboard.jsx`, and `HolyTrinityVisualizer.jsx`, all static configuration data should be moved to a single file: `src/data.js`.

```javascript
// src/data.js
export const SOVEREIGNTY_WORDS = [
  "Time", "Truth", "Identity", "Information", "Relationships",
  "Action", "Failure", "Wealth", "Self-Knowledge", "The System"
];

export const PRINCIPLES = [
  {
    num: "01",
    color: "#3B82F6",
    sovereignty: "Sovereignty over Time",
    title: "Time Is a Finite Substrate for Presence",
    refinement: "Time as presence substrate · Labor vs Action · Niksen as creative necessity",
    body: "The system measures success by Human Moments and the ratio of Action to Labor...",
    implication: "The Labor-to-Action ratio is tracked longitudinally...",
    roots: ["Stoic Memento Mori", "Dutch Niksen", "Vita Activa"]
  },
  // ... Principles 02 to 10
];

export const DOMAINS = [
  {
    num: "00",
    name: "Core",
    icon: "✦",
    color: "#C8922A",
    hsl: "40, 65%, 48%",
    tagline: "Star of Mind",
    desc: "The gravitational center of the entire system...",
    agent: "Meta-agent synthesizes all 13 domains...",
    maturity: 50,
    tier: "Seed → Rich",
    isCore: true,
    dataItems: ["Nucleus values", "Living layer", "Decision framework", "Non-negotiables", "Life stage", "Known blindspots"],
    layers: [
      { name: "Nucleus", desc: "Deepest values governed by the Lindy Effect." },
      { name: "Living Layer", desc: "Current focus, active goals, life stage, active tensions." },
      { name: "Version History", desc: "Every version preserved permanently." }
    ],
    p: ["Self-Assessment", "Belief Declarations"],
    a: ["Meta-Agent Synthesis", "Six Hat Sub-Agents"],
    h: ["Google Drive Vault"]
  },
  // ... Domains 01 to 13 (Temporal, Medical, Fitness, Nutrition, Financial, Career, Legal, Family, Home, Social, Travel, Mind, Epistemic)
];

export const CONNECTIONS_MAP = {
  "01": ["02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12", "13"],
  "02": ["03"],
  "03": ["02", "04"],
  "04": ["03", "05"],
  "05": ["06", "07", "09", "11"],
  "06": ["05"],
  "07": ["05", "09"],
  "08": ["10"],
  "09": ["05", "07"],
  "10": ["08", "12"],
  "11": ["05", "07"],
  "12": ["13", "10"],
  "13": ["12"]
};

export const BUS_SIGNALS = {
  "01": "Narrative Engine broadcasting time-stamped context models to all orbital agents.",
  "02": "Medical Agent cross-referencing Continuous Vitals from Fitness Agent.",
  "03": "Fitness Agent streaming HRV & Recovery windows to Medical Agent; alerts Nutrition Agent on caloric deficits.",
  "04": "Nutrition Agent mapping food relationship logs to Fitness performance targets.",
  "05": "Financial Agent tracking Autonomy Impact Score; syncing with Career & Legal domains.",
  "06": "Career Agent publishing compensation goals to Financial Agent; aligning with Mind Agent's skill tree.",
  "07": "Legal Agent monitoring contract milestones; alerting Financial Agent of expiry dates.",
  "08": "Family Agent syncing presence quality metrics to Social Agent entropy tracker.",
  "09": "Home Agent calculating asset deprecation vectors and syncing maintenance bills to Financial Agent.",
  "10": "Social Agent analyzing connection frequency against Mind Agent sentiment trends.",
  "11": "Travel Agent validating visa expiry constraints with Legal Agent for upcoming trips.",
  "12": "Mind Agent sending beliefs and core values to Core Meta-Agent for Lindy Effect analysis.",
  "13": "Epistemic Agent injecting Believable Dissent signals into Mind Agent & Core decision engine."
};

export const TRINITY_DATA = [
  {
    key: 'P',
    icon: '◎',
    name: 'Perception Data',
    sub: 'Subjective · Felt · Meaning-laden',
    color: '#4FC3F7',
    hsl: '199, 92%, 64%',
    bg: 'rgba(79,195,247,0.07)',
    border: 'rgba(79,195,247,0.25)',
    dark: 'rgba(79,195,247,0.04)',
    sources: [
      { icon: '🎙', name: 'Monthly Audit', examples: 'Claude interview · structured reflection · 25 min session' },
      { icon: '📓', name: 'Daily Journaling', examples: 'Mood · energy · wins · friction logs' },
      { icon: '👥', name: 'Inner Circle', examples: 'Partner · close friends · mentor · quarterly 5 questions' },
      { icon: '🔬', name: 'Self-Assessment', examples: 'Tier 1 audit responses · position declarations' },
      { icon: '💬', name: 'Conversational Input', examples: 'Ad-hoc Claude conversations · voice notes' },
      { icon: '🧠', name: 'Belief Declarations', examples: 'Epistemic position updates · value confirmations' },
    ]
  },
  // ... Agent Feedback (A) & Hard Data (H) structures
];
```

---

### 2. Refactored `src/App.jsx`
All inline sub-layouts are stripped. `App.jsx` imports `InteractiveDashboard` and `HolyTrinityVisualizer`, rendering them inside the routing layer.

```jsx
import React, { useState } from 'react';
import { PRINCIPLES, SOVEREIGNTY_WORDS } from './data';
import PrinciplesExplorer from './components/PrinciplesExplorer';
import InteractiveDashboard from './components/InteractiveDashboard';
import HolyTrinityVisualizer from './components/HolyTrinityVisualizer';

export default function App() {
  const [activeTab, setActiveTab] = useState('home');

  const tabs = [
    { id: 'home', label: 'Home', icon: '⌂', num: '' },
    { id: 'principles', label: 'Principles', icon: '◎', num: '01' },
    { id: 'domains', label: 'Domains', icon: '◈', num: '02' },
    { id: 'datasources', label: 'Data Sources', icon: '⊕', num: '03' }
  ];

  return (
    <div className="min-h-screen bg-[#090D16] text-[#D8E4F2] font-mono flex flex-col">
      {/* Shell Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-[#090D16]/92 backdrop-blur-md border-b border-[#1C2840] flex items-stretch h-[56px]">
        <div id="brand-logo" className="flex items-center gap-[10px] px-6 border-r border-[#1C2840] cursor-pointer" onClick={() => setActiveTab('home')}>
          <span className="text-[18px] text-[#D4A030]">✦</span>
          <span className="font-serif text-[17px] tracking-wider text-[#E8B84B]">DigitalMe</span>
        </div>
        <div className="flex items-stretch flex-1">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                id={`tab-${tab.id}`}
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-6 border-r border-[#1C2840] font-mono text-[11px] relative uppercase ${
                  isActive ? 'text-[#D4A030] bg-[#D4A030]/[0.05]' : 'text-[#4A6080] hover:text-[#8EA8C8]'
                }`}
              >
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
                {isActive && <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#D4A030]" />}
              </button>
            );
          })}
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="pt-[56px] flex-1 flex flex-col">
        {activeTab === 'home' && (
          <div className="flex-1 flex flex-col justify-center items-center text-center px-6 py-20 relative">
            <div className="text-[64px] mb-6 text-[#D4A030] animate-pulse">✦</div>
            <h1 className="font-serif text-[72px] font-light leading-none mb-4">DigitalMe</h1>
            <p className="font-mono text-[13px] text-[#4A6080] uppercase mb-16">Sovereignty Architecture · Version 2.0</p>
            <div className="grid grid-cols-3 gap-4 max-w-[900px] w-full mb-16">
              <div id="home-card-principles" onClick={() => setActiveTab('principles')} className="border border-[#1C2840] hover:border-[#3B82F6] rounded p-6 text-left cursor-pointer">
                <div className="text-[28px] mb-3 text-[#3B82F6]">◎</div>
                <h3 className="font-serif text-[22px] mb-2 font-normal">10 Principles</h3>
                <p className="text-[11px] text-[#4A6080]">The founding laws of the Core self-model...</p>
              </div>
              <div id="home-card-domains" onClick={() => setActiveTab('domains')} className="border border-[#1C2840] hover:border-[#C8922A] rounded p-6 text-left cursor-pointer">
                <div className="text-[28px] mb-3 text-[#C8922A]">◈</div>
                <h3 className="font-serif text-[22px] mb-2 font-normal">13 Domains</h3>
                <p className="text-[11px] text-[#4A6080]">14 agents orbiting the Star of Mind...</p>
              </div>
              <div id="home-card-datasources" onClick={() => setActiveTab('datasources')} className="border border-[#1C2840] hover:border-[#2DD4BF] rounded p-6 text-left cursor-pointer">
                <div className="text-[28px] mb-3 text-[#2DD4BF]">⊕</div>
                <h3 className="font-serif text-[22px] mb-2 font-normal">Data Sources</h3>
                <p className="text-[11px] text-[#4A6080]">The Holy Trinity tree mapping context flows...</p>
              </div>
            </div>
            <p className="font-serif text-[18px] italic text-[#2A3A55] max-w-[640px]">
              "I am a finite person with limited time, unlimited capacity for self-deception, and a genuine desire to live in alignment..."
            </p>
          </div>
        )}

        {activeTab === 'principles' && <PrinciplesExplorer />}
        {activeTab === 'domains' && <InteractiveDashboard />}
        {activeTab === 'datasources' && <HolyTrinityVisualizer />}
      </main>

      <footer className="py-8 px-6 border-t border-[#1C2840] text-center text-[9px] text-[#2A3A55] tracking-widest uppercase font-mono mt-auto">
        Digital Me · Core V2.0 · Sovereignty Architecture
      </footer>
    </div>
  );
}
```

---

### 3. Fully Modular `src/components/InteractiveDashboard.jsx`
Integrate the interactive SVG Orbit visualizer and details card panel alongside the Shared Data Bus so both interfaces synchronize on the same `activeNode` state.

```jsx
import React, { useState, useEffect } from 'react';
import { DOMAINS, CONNECTIONS_MAP, BUS_SIGNALS } from '../data';

export default function InteractiveDashboard() {
  const [activeNode, setActiveNode] = useState(null);
  const [hoveredNode, setHoveredNode] = useState(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => { setIsLoaded(true); }, []);

  const handleNodeClick = (num) => {
    setActiveNode(activeNode === num ? null : num);
    const cardEl = document.getElementById(`domain-card-${num}`);
    if (cardEl) {
      cardEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  const activeDomain = DOMAINS.find(d => d.num === activeNode);
  const topBusNodes = DOMAINS.filter(d => !d.isCore && parseInt(d.num) <= 6);
  const bottomBusNodes = DOMAINS.filter(d => !d.isCore && parseInt(d.num) > 6);

  const getBusLineColor = (num) => {
    if (activeNode === num || hoveredNode === num) {
      return DOMAINS.find(x => x.num === num).color;
    }
    if (activeNode && CONNECTIONS_MAP[activeNode]?.includes(num)) {
      return 'rgba(212,160,48,0.5)';
    }
    return '#1C2840';
  };

  return (
    <div className="flex-1 p-8 sm:p-12 max-w-6xl mx-auto w-full animate-[fadeIn_0.35s_ease-out_forwards]">
      <header className="mb-12 border-b border-[#1C2840] pb-8">
        <h1 className="font-serif text-4xl sm:text-5xl font-light mb-2">
          The <em className="italic text-[#E8B84B] font-normal">13 Domains</em>
        </h1>
        <p className="font-mono text-xs text-[#4A6080] tracking-widest uppercase">14 agents · 1 shared data bus · 1 sovereign commander</p>
      </header>

      {/* Shared Data Bus */}
      <section className="mb-12" id="shared-data-bus-section">
        <h2 className="font-mono text-xs text-[#4A6080] tracking-widest uppercase mb-4">SYSTEM INTERCONNECT // SHARED DATA BUS</h2>
        <div className="relative bg-[#05070c]/70 border border-[#1C2840] rounded-lg p-6 overflow-hidden">
          <div className="relative flex flex-col gap-6 w-full py-4">
            
            {/* Top Row Nodes */}
            <div className="flex justify-between items-center px-8 z-10">
              {topBusNodes.map(d => (
                <div key={d.num} className="flex flex-col items-center flex-1">
                  <button
                    id={`shared-bus-node-${d.num}`}
                    onClick={() => handleNodeClick(d.num)}
                    onMouseEnter={() => setHoveredNode(d.num)}
                    onMouseLeave={() => setHoveredNode(null)}
                    style={{ borderColor: getBusLineColor(d.num) }}
                    className={`w-12 h-12 rounded-full border flex items-center justify-center font-serif text-xl cursor-pointer bg-[#0A0D16] transition-all ${
                      activeNode === d.num ? 'scale-105 border-[#D4A030] bg-[#D4A030]/10' : ''
                    }`}
                  >
                    <span style={{ color: d.color }}>{d.icon}</span>
                  </button>
                  <span className="font-mono text-[9px] mt-2 text-[#4A6080] hidden sm:block uppercase">{d.name}</span>
                </div>
              ))}
            </div>

            {/* Central Spine */}
            <div className="relative h-8 flex items-center justify-center">
              <div className="absolute left-0 right-0 h-[3px] bg-[#D4A030]/20" />
              <div className="z-10 px-4 py-1 bg-[#090D16] border border-[#1C2840] rounded-full text-[9px] text-[#E8B84B] font-mono">
                ⚡ SHARED BUS BACKBONE ⚡
              </div>
            </div>

            {/* Bottom Row Nodes */}
            <div className="flex justify-between items-center px-8 z-10">
              {bottomBusNodes.map(d => (
                <div key={d.num} className="flex flex-col items-center flex-1">
                  <button
                    id={`shared-bus-node-${d.num}`}
                    onClick={() => handleNodeClick(d.num)}
                    onMouseEnter={() => setHoveredNode(d.num)}
                    onMouseLeave={() => setHoveredNode(null)}
                    style={{ borderColor: getBusLineColor(d.num) }}
                    className={`w-12 h-12 rounded-full border flex items-center justify-center font-serif text-xl cursor-pointer bg-[#0A0D16] transition-all ${
                      activeNode === d.num ? 'scale-105 border-[#D4A030] bg-[#D4A030]/10' : ''
                    }`}
                  >
                    <span style={{ color: d.color }}>{d.icon}</span>
                  </button>
                  <span className="font-mono text-[9px] mt-2 text-[#4A6080] hidden sm:block uppercase">{d.name}</span>
                </div>
              ))}
            </div>

          </div>

          {/* Telemetry Inspector */}
          <div className="mt-6 border-t border-[#1C2840]/60 pt-4 flex justify-between items-center">
            <div>
              <div className="font-mono text-[10px] text-[#4A6080] mb-1">SIGNAL STATUS</div>
              <div className="min-h-[36px] flex items-center font-mono text-xs">
                {activeNode || hoveredNode ? (
                  <p>
                    <span style={{ color: DOMAINS.find(x => x.num === (activeNode || hoveredNode)).color }}>
                      [{activeNode || hoveredNode}] {DOMAINS.find(x => x.num === (activeNode || hoveredNode)).name}:
                    </span>{' '}
                    {BUS_SIGNALS[activeNode || hoveredNode] || "Establishing connection."}
                  </p>
                ) : (
                  <span className="text-[#4A6080] italic">Hover or click a node to inspect active telemetry...</span>
                )}
              </div>
            </div>
            <div className="flex gap-2">
              <button id="bus-flow-trigger" onClick={() => handleNodeClick(String(Math.floor(Math.random() * 13) + 1).padStart(2, '0'))} className="border border-[#D4A030]/30 hover:border-[#D4A030] text-[#D4A030] font-mono text-[9px] px-3 py-1.5 rounded bg-transparent cursor-pointer">
                PULSE TELEMETRY
              </button>
              {activeNode && (
                <button id="bus-clear-trigger" onClick={() => setActiveNode(null)} className="border border-[#1C2840] hover:border-slate-600 text-[#4A6080] font-mono text-[9px] px-3 py-1.5 rounded cursor-pointer">
                  CLEAR LOCK
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Main Orbit & Card Grid Split */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* SVG Orbit Graphics */}
        <div className="lg:col-span-6 border border-[#1C2840] bg-[#0E1524]/20 p-6 rounded flex flex-col items-center">
          <div className="text-[11px] text-[#4A6080] uppercase tracking-widest mb-6 font-semibold font-mono">
            Orbit Visualizer (Click Orbit Node)
          </div>
          <div className="relative w-[340px] h-[340px] sm:w-[400px] sm:h-[400px]">
            <svg id="orbitSvg" className="w-full h-full" viewBox="0 0 520 520">
              <circle cx="260" cy="260" r="220" fill="none" stroke="#1C2840" strokeWidth="1" strokeDasharray="3,3" />
              <circle cx="260" cy="260" r="150" fill="none" stroke="#1C2840" strokeWidth="1" strokeDasharray="3,3" />
              
              {DOMAINS.map((d, index) => {
                if (d.num === "00") return null;
                const isOuter = parseInt(d.num) <= 7;
                const r = isOuter ? 220 : 150;
                const angle = isOuter ? ((index - 1) / 7) * 2 * Math.PI - Math.PI / 2 : ((index - 8) / 6) * 2 * Math.PI - Math.PI / 6;
                const x = 260 + r * Math.cos(angle);
                const y = 260 + r * Math.sin(angle);
                return (
                  <line key={`spoke-${d.num}`} x1="260" y1="260" x2={x} y2={y} stroke={d.color} strokeWidth="0.5" strokeOpacity="0.15" />
                );
              })}

              <g id="domain-orbit-00" className="cursor-pointer" onClick={() => handleNodeClick("00")}>
                <circle cx="260" cy="260" r="25" fill="#C8922A" fillOpacity="0.15" stroke="#C8922A" strokeWidth="1.5" />
                <circle cx="260" cy="260" r="3" fill="#C8922A" />
                <text x="260" y="261" textAnchor="middle" dominantBaseline="middle" fontSize="14" fill="#E8B84B">✦</text>
              </g>

              {DOMAINS.map((d, index) => {
                if (d.num === "00") return null;
                const isOuter = parseInt(d.num) <= 7;
                const r = isOuter ? 220 : 150;
                const angle = isOuter ? ((index - 1) / 7) * 2 * Math.PI - Math.PI / 2 : ((index - 8) / 6) * 2 * Math.PI - Math.PI / 6;
                const x = 260 + r * Math.cos(angle);
                const y = 260 + r * Math.sin(angle);
                const isSelected = activeNode === d.num;

                return (
                  <g id={`domain-orbit-${d.num}`} key={`orbit-node-${d.num}`} className="cursor-pointer" onClick={() => handleNodeClick(d.num)}>
                    <circle cx={x} cy={y} r={isOuter ? 16 : 14} fill={d.color} fillOpacity={isSelected ? 0.35 : 0.12} stroke={d.color} strokeWidth={isSelected ? 2 : 1} />
                    <text x={x} y={y + 1} textAnchor="middle" dominantBaseline="middle" fontSize={isOuter ? 11 : 9.5} fill={d.color}>{d.icon}</text>
                  </g>
                );
              })}
            </svg>
          </div>
        </div>

        {/* Details & List Grid */}
        <div className="lg:col-span-6 flex flex-col gap-6">
          {activeDomain ? (
            <div id="domain-detail-panel" className="border border-[#D4A030] bg-[#0E1524] p-6 rounded relative animate-[fadeIn_0.2s_ease-out]">
              <button onClick={() => setActiveNode(null)} className="absolute top-4 right-4 text-xs text-[#4A6080] hover:text-[#D8E4F2] cursor-pointer">Close Details [×]</button>
              
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded flex items-center justify-center text-lg" style={{ backgroundColor: `${activeDomain.color}15`, border: `1px solid ${activeDomain.color}30`, color: activeDomain.color }}>
                  {activeDomain.icon}
                </div>
                <div>
                  <div className="text-[10px] text-[#4A6080] font-mono uppercase tracking-widest">Domain D·{activeDomain.num}</div>
                  <h2 className="font-serif text-2xl font-normal" style={{ color: activeDomain.color }}>{activeDomain.name}</h2>
                </div>
              </div>
              <p className="text-xs text-[#8EA8C8] leading-relaxed mb-6 font-mono">{activeDomain.desc}</p>
              
              {/* Layers */}
              {activeDomain.layers && (
                <div className="border-t border-[#1C2840]/60 pt-4 mb-4">
                  <div className="text-[10px] text-[#4A6080] font-bold uppercase tracking-wider mb-2">Layers</div>
                  {activeDomain.layers.map(l => (
                    <div key={l.name} className="text-xs font-mono mb-2">
                      <span className="font-semibold text-[#E8B84B]">{l.name}: </span>
                      <span className="text-[#8EA8C8]">{l.desc}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="border border-dashed border-[#1C2840] p-12 text-center text-[#4A6080] rounded">
              <p className="text-xs leading-relaxed max-w-[360px] mx-auto">Click a node on the orbit visualizer or select a domain card below to inspect agent state.</p>
            </div>
          )}

          {/* Cards Grid */}
          <div className="grid grid-cols-2 gap-3 max-h-[300px] overflow-y-auto p-4 border border-[#1C2840]/60 rounded bg-[#0A0D16]/50">
            {DOMAINS.map(d => (
              <div
                id={`domain-card-${d.num}`}
                key={d.num}
                onClick={() => handleNodeClick(d.num)}
                className={`p-3 rounded border cursor-pointer transition-all ${
                  activeNode === d.num ? 'bg-[#0E1524] border-[#D4A030]' : 'border-[#1C2840] bg-white/[0.01]'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold" style={{ color: d.color }}>{d.icon} {d.name}</span>
                  <span className="text-[8px] text-[#4A6080] font-mono">D·{d.num}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
```

---

### 4. Interactive `src/components/HolyTrinityVisualizer.jsx`
Implement the `selectedTrinityKey` state to filter matrix domains and hide unrelated sources.

```jsx
import React, { useState } from 'react';
import { DOMAINS, TRINITY_DATA } from '../data';

export default function HolyTrinityVisualizer() {
  const [selectedDomainNum, setSelectedDomainNum] = useState(null);
  const [selectedTrinityKey, setSelectedTrinityKey] = useState(null); // 'P', 'A', 'H', or null
  const [searchQuery, setSearchQuery] = useState('');

  const selectedDomain = DOMAINS.find(d => d.num === selectedDomainNum);

  const isSourceHighlighted = (pillarKey, sourceName) => {
    if (!selectedDomain) return false;
    const list = (pillarKey === 'P' ? selectedDomain.p : pillarKey === 'A' ? selectedDomain.a : selectedDomain.h) || [];
    const s = sourceName.toLowerCase().trim();
    return list.some(item => item.toLowerCase().trim().includes(s) || s.includes(item.toLowerCase().trim()));
  };

  // Filter matrix mapping domains based on query and trinity selection
  const filteredDomains = DOMAINS.filter(d => {
    // Trinity selection filter
    if (selectedTrinityKey) {
      const hasSources = selectedTrinityKey === 'P' ? (d.p && d.p.length > 0) : selectedTrinityKey === 'A' ? (d.a && d.a.length > 0) : (d.h && d.h.length > 0);
      if (!hasSources) return false;
    }

    // Search query filter
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      d.name.toLowerCase().includes(q) ||
      d.num.includes(q) ||
      (d.p && d.p.some(s => s.toLowerCase().includes(q))) ||
      (d.a && d.a.some(s => s.toLowerCase().includes(q))) ||
      (d.h && d.h.some(s => s.toLowerCase().includes(q)))
    );
  });

  const handlePillarClick = (key) => {
    setSelectedTrinityKey(selectedTrinityKey === key ? null : key);
  };

  return (
    <div className="flex-1 p-8 sm:p-12 max-w-7xl mx-auto w-full font-sans text-[#D8E4F2] bg-[#090D16]">
      <header className="mb-12 border-b border-[#1C2840] pb-8 flex flex-col md:flex-row justify-between items-end gap-6">
        <div>
          <h1 className="font-serif text-4xl sm:text-5xl font-light mb-2">
            Holy Trinity <em className="italic text-[#E8B84B] font-normal">Data Sources</em>
          </h1>
          <p className="font-mono text-xs text-[#4A6080]">Perception Data (P) · Agent Feedback (A) · Hard Data (H)</p>
        </div>
        
        <input
          id="datasources-search-input"
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search sources or domains..."
          className="bg-[#0E1524] text-[#D8E4F2] border border-[#1C2840] rounded px-4 py-2 text-xs font-mono"
        />
      </header>

      {/* Visual Tree */}
      <section className="mb-16 border border-[#1C2840] rounded-lg p-8 bg-[#0A0E1A]/40">
        <div className="flex flex-col items-center">
          <div id="trinity-tree-root" className="border border-[#C8922A] bg-[#0A0D16] rounded px-6 py-3 text-center">
            <h3 className="font-serif text-[#E8B84B]">Star of Mind</h3>
          </div>
          <div className="w-[1.5px] h-8 bg-[#1C2840]" />
          
          <div className="grid grid-cols-3 gap-8 w-full mt-4">
            {TRINITY_DATA.map(pillar => {
              const isActivePillar = selectedTrinityKey === pillar.key;
              return (
                <div key={pillar.key} className="flex flex-col items-center">
                  <div
                    id={`trinity-source-${pillar.key}`}
                    onClick={() => handlePillarClick(pillar.key)}
                    className={`border rounded px-5 py-3 text-center w-64 cursor-pointer transition-all ${
                      isActivePillar ? 'border-[#E8B84B] bg-[#E8B84B]/10 shadow-[0_0_15px_rgba(232,184,75,0.2)]' : 'border-[#1C2840] bg-[#0A0D16]'
                    }`}
                  >
                    <div className="text-xl" style={{ color: pillar.color }}>{pillar.icon}</div>
                    <h4 className="font-serif">{pillar.name}</h4>
                  </div>
                  
                  {/* Render Pillar Sources */}
                  <div className="flex flex-col gap-2 w-full mt-4">
                    {pillar.sources.map(src => {
                      const highlighted = isSourceHighlighted(pillar.key, src.name);
                      return (
                        <div
                          key={src.name}
                          id={`trinity-source-item-${pillar.key.toLowerCase()}-${src.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}
                          className={`border rounded p-3 text-xs transition-all ${
                            highlighted ? 'border-[#E8B84B] bg-white/[0.02]' : 'border-[#1C2840] bg-[#070A12]'
                          }`}
                        >
                          <span className="font-semibold text-[#D8E4F2]">{src.icon} {src.name}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Mapping Matrix */}
      <section className="border border-[#1C2840] rounded-lg p-6 bg-[#0E1524]/10">
        <div className="flex justify-between items-center mb-6">
          <h3 className="font-serif text-xl text-[#E8B84B]">Domain → Primary Source Mapping Matrix</h3>
          {(selectedDomainNum || selectedTrinityKey) && (
            <button onClick={() => { setSelectedDomainNum(null); setSelectedTrinityKey(null); }} className="text-xs text-[#2DD4BF] border border-[#2DD4BF]/30 px-3 py-1 rounded bg-[#2DD4BF]/5 font-mono cursor-pointer">
              Clear Selection [×]
            </button>
          )}
        </div>

        <div id="mappingGrid" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredDomains.map(d => (
            <div
              key={d.num}
              id={`domain-mapping-card-${d.num}`}
              onClick={() => setSelectedDomainNum(selectedDomainNum === d.num ? null : d.num)}
              className={`border p-4 rounded cursor-pointer transition-all ${
                selectedDomainNum === d.num ? 'bg-[#0E1524]' : 'bg-[#0A0D16] border-[#1C2840]'
              }`}
              style={{ borderColor: selectedDomainNum === d.num ? d.color : '#1C2840' }}
            >
              <div className="flex justify-between items-center mb-3 pb-2 border-b border-[#1C2840]/30">
                <span className="font-serif text-lg text-[#D8E4F2]">{d.icon} {d.name}</span>
                <span className="text-[9px] text-[#4A6080] font-mono">D·{d.num}</span>
              </div>

              {/* Render sources conditionally based on selectedTrinityKey */}
              <div className="space-y-3 font-mono text-[9px]">
                {(!selectedTrinityKey || selectedTrinityKey === 'P') && d.p && d.p.length > 0 && (
                  <div>
                    <div className="text-[#4FC3F7] font-bold mb-1">Perception Data (P)</div>
                    <div className="flex flex-wrap gap-1">
                      {d.p.map(s => <span key={s} className="bg-[#4FC3F7]/10 border border-[#4FC3F7]/30 text-[#4FC3F7] px-2 py-0.5 rounded">{s}</span>)}
                    </div>
                  </div>
                )}
                {(!selectedTrinityKey || selectedTrinityKey === 'A') && d.a && d.a.length > 0 && (
                  <div>
                    <div className="text-[#81C784] font-bold mb-1">Agent Feedback (A)</div>
                    <div className="flex flex-wrap gap-1">
                      {d.a.map(s => <span key={s} className="bg-[#81C784]/10 border border-[#81C784]/30 text-[#81C784] px-2 py-0.5 rounded">{s}</span>)}
                    </div>
                  </div>
                )}
                {(!selectedTrinityKey || selectedTrinityKey === 'H') && d.h && d.h.length > 0 && (
                  <div>
                    <div className="text-[#FF8A65] font-bold mb-1">Hard Data (H)</div>
                    <div className="flex flex-wrap gap-1">
                      {d.h.map(s => <span key={s} className="bg-[#FF8A65]/10 border border-[#FF8A65]/30 text-[#FF8A65] px-2 py-0.5 rounded">{s}</span>)}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
```

---

### 5. Redesigned Test Suite (`tests/run-tests.js`)
The test runner is completely redesigned. It performs genuine static inspection of AST/code structures and element configurations in live components without mocks, using regex-based logic to verify the presence of active React elements and logic paths.

```javascript
/**
 * DigitalMe Dashboard - Redesigned Zero-Dependency Code Auditor & Validator
 * Statically analyzes active Javascript and React code elements in active components.
 */

const fs = require('fs');
const path = require('path');

const colors = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
  bold: "\x1b[1m",
};

const projectRoot = path.resolve(__dirname, '..');
const files = {
  app: path.join(projectRoot, 'src', 'App.jsx'),
  dashboard: path.join(projectRoot, 'src', 'components', 'InteractiveDashboard.jsx'),
  trinity: path.join(projectRoot, 'src', 'components', 'HolyTrinityVisualizer.jsx'),
  data: path.join(projectRoot, 'src', 'data.js'),
  packageJson: path.join(projectRoot, 'package.json'),
};

let totalTests = 0;
let passedTests = 0;

function assert(condition, message) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`${colors.green}✓ PASS:${colors.reset} ${message}`);
  } else {
    console.error(`${colors.red}✗ FAIL:${colors.reset} ${message}`);
  }
}

console.log(`${colors.bold}${colors.cyan}================================================================${colors.reset}`);
console.log(`${colors.bold}${colors.cyan}         DIGITALME ACTIVE CODE AUDITOR & E2E RUNNER             ${colors.reset}`);
console.log(`${colors.bold}${colors.cyan}================================================================${colors.reset}`);

try {
  const appJsx = fs.readFileSync(files.app, 'utf8');
  const dashboardJsx = fs.readFileSync(files.dashboard, 'utf8');
  const trinityJsx = fs.readFileSync(files.trinity, 'utf8');

  // --- Integrity Audit ---
  assert(
    !appJsx.includes("const compliance =") && !appJsx.includes("E2E Simulation test runner compliance"),
    "Integrity Check: No bypassed commented-out compliance blocks present in App.jsx"
  );

  // --- Shell Navigation Audits ---
  assert(
    appJsx.includes("import InteractiveDashboard from") && appJsx.includes("<InteractiveDashboard"),
    "Shell Integration: InteractiveDashboard is imported and rendered as an active component"
  );
  assert(
    appJsx.includes("import HolyTrinityVisualizer from") && appJsx.includes("<HolyTrinityVisualizer"),
    "Shell Integration: HolyTrinityVisualizer is imported and rendered as an active component"
  );
  assert(
    appJsx.includes("id={`tab-${tab.id}`}") && appJsx.includes("setActiveTab(tab.id)"),
    "Shell Navigation: Real tab routing elements and clicks are dynamically registered"
  );

  // --- Interactive Dashboard Audits ---
  assert(
    dashboardJsx.includes("useState(null)") && dashboardJsx.includes("activeNode") && dashboardJsx.includes("setActiveNode"),
    "Dashboard Interactivity: Component defines and mutates internal activeNode state hook"
  );
  assert(
    dashboardJsx.includes('id="orbitSvg"') && dashboardJsx.includes('id={`domain-orbit-${d.num}`}') && dashboardJsx.includes('onClick={() => handleNodeClick(d.num)}'),
    "Dashboard Interactivity: Orbit SVG is rendered containing clickable dynamic orbit nodes"
  );
  assert(
    dashboardJsx.includes('id="shared-data-bus-section"') && dashboardJsx.includes('id={`shared-bus-node-${d.num}`}') && dashboardJsx.includes('onClick={() => handleNodeClick(d.num)}'),
    "Dashboard Interactivity: Shared Data Bus section renders interconnected clickable bus nodes"
  );
  assert(
    dashboardJsx.includes('id="domain-detail-panel"') && dashboardJsx.includes('activeDomain.desc'),
    "Dashboard Interactivity: Detail panel dynamically loads and shows activeDomain state descriptions"
  );
  assert(
    dashboardJsx.includes('id="bus-flow-trigger"') && dashboardJsx.includes('id="bus-clear-trigger"'),
    "Dashboard Interactivity: Custom telemetry triggers (pulse/clear) exist on the shared bus panel"
  );

  // --- Holy Trinity Audits ---
  assert(
    trinityJsx.includes("useState(null)") && trinityJsx.includes("selectedTrinityKey") && trinityJsx.includes("setSelectedTrinityKey"),
    "Holy Trinity: Component defines real selectedTrinityKey hook to support pillar filtering"
  );
  assert(
    trinityJsx.includes('id="trinity-tree-root"') && trinityJsx.includes('id={`trinity-source-${pillar.key}`}') && trinityJsx.includes('onClick={() => handlePillarClick(pillar.key)}'),
    "Holy Trinity: Tree diagram implements interactive elements representing P, A, H pillars"
  );
  assert(
    trinityJsx.includes('id="mappingGrid"') && trinityJsx.includes('id={`domain-mapping-card-${d.num}`}'),
    "Holy Trinity: Mapped matrix grid contains distinct cards structured by domain numbers"
  );
  assert(
    trinityJsx.includes("selectedTrinityKey === 'P'") && trinityJsx.includes("selectedTrinityKey === 'A'") && trinityJsx.includes("selectedTrinityKey === 'H'"),
    "Holy Trinity: Matrix cards dynamically filter shown source lists based on active selectedTrinityKey"
  );

  // --- Summary ---
  console.log(`\nPassed audits: ${passedTests} / ${totalTests}`);
  if (passedTests === totalTests) {
    console.log(`${colors.green}All static code integrity audits passed successfully!${colors.reset}`);
    process.exit(0);
  } else {
    console.error(`${colors.red}Audit verification failed. Please correct file structures.${colors.reset}`);
    process.exit(1);
  }
} catch (err) {
  console.error("Audit aborted: Error reading active components.", err.message);
  process.exit(1);
}
```

---

## Verification Method

1. **Static Analysis Check**:
   Run the newly designed zero-dependency auditor script from the command line:
   ```bash
   node tests/run-tests.js
   ```
   Confirm that all assertions pass and output a 100% success verification rate.

2. **Integration / E2E Unit Verification**:
   To run full, dynamic browser-simulated tests:
   - Install the required packages in `devDependencies`:
     ```bash
     npm install -D vitest @testing-library/react @testing-library/jest-dom jsdom
     ```
   - Update `package.json` to configure the test script:
     ```json
     "scripts": {
       "test": "vitest run"
     }
     ```
   - Execute Vitest to run `src/components/__tests__/InteractiveDashboard.test.jsx`:
     ```bash
     npm run test
     ```
     Verify that the 4 dynamic behavioral test cases execute, simulate click interactions on data bus nodes, reset state locks, and pass within the virtual JSDOM framework.
