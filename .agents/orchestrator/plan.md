# Project Plan: DigitalMe Dashboard Web Application (Remediation V2)

## Architecture
DigitalMe is a high-fidelity single-page application (SPA) showcasing the Star of Mind (Core 00), the 13 Life Domains, the Holy Trinity Data Model, and the Ten Founding Principles.

The application will be structured as a modern Vite + React static application deployable to Cloudflare Pages.
- **Frontend Framework**: React 18 with Vite.
- **Styling**: Tailwind CSS for dark-themed, premium layout using Outfit (sans-serif), DM Mono (monospace), and Cormorant Garamond (serif) typography, along with HSL-tailored gradients and smooth transitions.
- **State Management**: React state with a Shared Data Bus representing signal flow.
- **Build Output**: Static assets compiled to the `dist` directory.
- **Target Working Directory**: `C:\Users\shane\logan-site\digital-me-web`

## Milestones

### Track 1: Implementation Track
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Project Setup & Architecture | Setup Vite + React, Tailwind CSS, configuration files, directory structure, routing, and deploy config. | None | DONE |
| M2 | Interactive Dashboard (R1) | Implement Star of Mind orbit visualizer, Core 00 details, 13 domain cards, and Shared Data Bus visualization. | M1 | IN_PROGRESS (Remediation) |
| M3 | Holy Trinity Visualizer (R2) | Implement Perception, Agent Feedback, and Hard Data sections with Domain-to-Source click mappings and Selected Trinity filtering. | M2 | IN_PROGRESS (Remediation) |
| M4 | Principles Explorer (R3) | Implement Ten Founding Principles interactive explorer with search/filtering by category or name. | M2 | IN_PROGRESS (Remediation) |
| M5 | Final Integration & Test Pass (Phase 1 & 2) | Run full E2E test pass (Tiers 1-4) once TEST_READY.md is available, then perform adversarial coverage hardening (Tier 5). | M3, M4, T1 | PLANNED |

### Track 2: E2E Testing Track
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| T1 | Test Infrastructure & Tier 1-4 Suite | Setup testing framework, rewrite tests/run-tests.js to perform genuine static code checking of active components, and run all 49+ tests. Publish `TEST_READY.md`. | M1 | IN_PROGRESS (Remediation) |

## Interface Contracts & Layout
- **Page ID Scheme**: Each major interactive container and button will use unique, descriptive IDs (e.g., `tab-home`, `domain-card-00` to `domain-card-13`, `trinity-source-P`, `trinity-source-A`, `trinity-source-H`, `shared-bus-node-01` to `shared-bus-node-13`, etc.) for automated testing.
- **Data Models**: All static configuration data is defined in `src/data.js` and imported by the active components.
