## 2026-06-19T03:03:19-04:00
You are running as a subagent (worker) to rewrite the E2E test runner for the DigitalMe dashboard.
Your working directory for metadata is C:\Users\shane\logan-site\.agents\worker_test_rewrite.
Your target project directory is C:\Users\shane\logan-site\digital-me-web.

TASK:
Rewrite `tests/run-tests.js` to perform a genuine static code audit and behavioral structure check on the active components and configuration files, completely eliminating the mocked logic and state duplication that triggered the integrity violation.

1. Do NOT include mocked data vectors or state simulation variables (like `let state = { ... }` or `runDataSourcesSearch` or `runPrinciplesSearch`) inside `tests/run-tests.js` itself.
2. The test runner must read the actual codebase files:
   - `src/App.jsx`
   - `src/data.js`
   - `src/components/PrinciplesExplorer.jsx`
   - `src/components/InteractiveDashboard.jsx`
   - `src/components/HolyTrinityVisualizer.jsx`
   - `package.json`
   - `index.html`
   - `tailwind.config.js`
   - `postcss.config.js`
   - `vite.config.js`
3. Formulate all 49 E2E test cases across the 4 tiers as assertions running directly on these active codebase files, using regex matching or substring checks to verify that:
   - React state hooks (e.g. `useState('home')`, `activeNode`, `selectedTrinityKey`, `principlesQuery`) are declared and updated.
   - Click handlers (e.g. `setActiveTab`, `handleNodeClick`, `handlePillarClick`, `handleDomainCardClick`) are bound to elements with correct IDs.
   - The correct components are imported and conditionally mounted in `App.jsx`.
   - The search filters in the components are implemented correctly and search case-insensitively (e.g. checking `.toLowerCase().trim()` and the required fields).
   - Configuration files have correct paths, plugins, scripts, and font families.
   - Core data structures in `src/data.js` are fully populated and contain the expected terms (like "Critical Deficit Alert", "Lindy Effect", "Six Hat", "Wearable Devices", etc.).
4. Keep the runner zero-dependency so that it executes in Node.js with `node tests/run-tests.js` and exits with code 0 on success.
5. Print a detailed output of all 49 passing test cases and a final summary.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A Forensic Auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Write your handoff report to C:\Users\shane\logan-site\.agents\worker_test_rewrite\handoff.md and report back to the orchestrator.
