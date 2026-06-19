## 2026-06-19T06:36:53Z

Perform a clean refactoring of the DigitalMe dashboard components to eliminate duplicate code, remove the facade comments, and ensure fully functional interactivity.

1. Create a unified data file `src/data.js` containing all static data structures:
   - `PRINCIPLES` (10 principles)
   - `DOMAINS` (14 domains: Core 00 and 13 orbitals)
   - `SOVEREIGNTY_WORDS` (mapping names)
   - `CONNECTIONS_MAP` (domain cross-connections)
   - `BUS_SIGNALS` (domain-specific data bus messages)
   - `TRINITY_DATA` (perception, agent feedback, hard data structures)
   Ensure that these data objects are fully populated and correspond to the structures currently defined in `src/App.jsx`, `src/components/InteractiveDashboard.jsx`, and `src/components/HolyTrinityVisualizer.jsx`.

2. Create a new modular component `src/components/PrinciplesExplorer.jsx`:
   - Move the principles explorer UI from `src/App.jsx` into this file.
   - Implement the search input (`id="principles-search-input"`) which filters principles by title, body, sovereignty, refinement, or roots (case-insensitively).
   - Implement the thread bar navigation (`id="threadBar"`) with buttons that toggle-filter/jump to specific principles.
   - Render the principle cards with ID `id={\`principle-card-\${p.num}\`}`.
   - Follow style rules: Cormorant Garamond for serif headings, Outfit for sans-serif text, and DM Mono for code/status tags.

3. Refactor `src/components/InteractiveDashboard.jsx`:
   - Import its data structures from `../data.js` rather than defining them inline.
   - Implement the full interactive Orbit SVG (`id="orbitSvg"`) and the click handler `handleNodeClick` which updates `activeNode` state. Clicking an orbit node (ID `id={\`domain-orbit-\${d.num}\`}`) selects it.
   - Implement the Shared Data Bus visualizer (`id="shared-data-bus-section"`) with interactive nodes (ID `id={\`shared-bus-node-\${d.num}\`}`).
   - Clicking a bus node or orbit node must synchronize. Update the central telemetry text dynamically to show the bus signal.
   - Add telemetry control triggers: Pulse Telemetry (`id="bus-flow-trigger"`) selects a random domain, and Clear Lock (`id="bus-clear-trigger"`) clears selection.
   - Render the Core Card (`id="domain-card-00"`) and 13 orbital cards (`id={\`domain-card-\${d.num}\`}`).
   - Display domain icon, number, tagline, description, layers, agent details, and a dynamic data maturity progress bar.

4. Refactor `src/components/HolyTrinityVisualizer.jsx`:
   - Import its data structures from `../data.js`.
   - Render the root node (`id="trinity-tree-root"`) and the three pillar header cards: Perception (ID `id="trinity-source-P"`), Agent Feedback (ID `id="trinity-source-A"`), and Hard Data (ID `id="trinity-source-H"`).
   - Render the mapping matrix grid (`id="mappingGrid"`) with cards for each domain (ID `id={\`domain-mapping-card-\${d.num}\`}`).
   - Implement `selectedTrinityKey` state (filters domains by 'P', 'A', or 'H'). Clicking on a pillar card (Perception, Feedback, or Hard Data) updates `selectedTrinityKey`. Clicking it again clears it (toggle-clearing).
   - When a trinity key is selected (e.g. 'P'), the mapping matrix cards must dynamically filter (only show domains that have perception sources) and/or filter the sources shown inside the card.
   - Implement search input (`id="datasources-search-input"`) that filters domains and sources.
   - Clicking on any of the domain mapping cards (ID `id={\`domain-mapping-card-\${d.num}\`}`) sets `selectedDomainNum` and highlights the corresponding sources in the tree visualizer (e.g., matching glow borders).
   - Add a "Clear Selection" button to reset the selected domain and trinity key filters.

5. Refactor `src/App.jsx`:
   - Import `PrinciplesExplorer`, `InteractiveDashboard`, and `HolyTrinityVisualizer`.
   - Render them conditionally based on `activeTab` ('home', 'principles', 'domains', 'datasources').
   - Remove ALL inline definitions of principles, domains, and trinity datasets.
   - **Crucially: Remove the commented-out \`compliance\` function at the bottom of the file (lines 991-1021) completely.** Do not leave any facade strings or compliance mock comments.
   - Keep the shell navigation bar and home page intact, referencing imported data.

6. Build and verify:
   - Propose and run \`npm run build\` in \`C:\Users\shane\logan-site\digital-me-web\` to ensure compilation succeeds (exit code 0).
