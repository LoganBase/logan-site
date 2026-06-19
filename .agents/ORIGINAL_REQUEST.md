# Original User Request

## Initial Request — 2026-06-19T02:08:50-04:00

An autonomous personal sovereignty Life OS dashboard web application ("DigitalMe") representing a user's core values, 13 life domains, and data ingestion pipeline.

Working directory: `C:\Users\shane\logan-site\digital-me-web`
Integrity mode: development

## Requirements

### R1. Interactive Dashboard (Core & Domains)
* **What:** A high-fidelity single-page application (SPA) dashboard showcasing the **Star of Mind (Core 00)** and the **13 Life Domains** (01 Temporal to 13 Epistemic).
* **Details:** 
  * Displays the core values (Nucleus and Living Layer) clearly.
  * Provides visual representations of the 13 domains, displaying their name, tagline, description, maturity index, and associated data items.
  * Includes an interactive visualization of the **Shared Data Bus** showing cross-domain signals.
  * Uses premium styling: dark-themed UI, Outfit, DM Mono, and Cormorant Garamond typography, HSL tailored gradients, and smooth hover micro-animations.

### R2. Holy Trinity Data Sources Visualizer
* **What:** A dedicated view or section showing the **Holy Trinity Data Model**:
  1. *Perception Data (P):* Subjective, felt audits, journals.
  2. *Agent Feedback (A):* Signal bus, Meta-agent logs.
  3. *Hard Data (H):* Financial logs, medical charts, wearable feeds.
* **Details:** Displays the Domain-to-Source mappings (e.g., clicking on Fitness shows its dependency on Wearables and Medical inputs).

### R3. Core Principles Explorer
* **What:** An interactive reader for the **Ten Founding Principles (Version 2.0)**.
* **Details:** Includes search/filtering to explore principles by category or name. Fully integrates the philosophical roots (Memento Mori, Niksen, Socratic Mirror, Lindy Effect, etc.) and what each principle means for DigitalMe.

### R4. Cloudflare Pages & Git Ready Architecture
* **What:** The app must be structured to deploy seamlessly on Cloudflare Pages.
* **Details:** Uses a static compilation setup (such as Vite + React, or a optimized Vanilla HTML/CSS/JS architecture). All project source files must reside in the working directory `C:\Users\shane\logan-site\digital-me-web` within the existing `logan-site` Git repository, enabling version tracking and deployment.

## Acceptance Criteria

### Technical Build & Structure
- [ ] The application builds successfully (e.g., `npm run build` exits with code 0 if using a builder, or all index links resolve correctly).
- [ ] No placeholder content is used; all data structures (domains, principles, source mappings) are fully populated.
- [ ] All interactive dashboard modules (such as domain detail cards and navigation) have unique, descriptive IDs for automated browser tests.

### Design & Aesthetic Quality
- [ ] The app uses the specified typographic system: Cormorant Garamond for serif headings, Outfit for sans-serif text, and DM Mono for code/status tags.
- [ ] Dynamic background canvases and grid elements include subtle entry animations and CSS hover transitions.
