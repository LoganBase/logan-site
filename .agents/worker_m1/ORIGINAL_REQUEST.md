## 2026-06-19T06:10:00Z

Initialize a React 18 project with Vite and Tailwind CSS inside C:\Users\shane\logan-site\digital-me-web.
1. Create a `package.json` with React 18, Vite, Tailwind CSS, Autoprefixer, PostCSS, and other standard packages.
2. Setup configurations: `vite.config.js`, `postcss.config.js`, `tailwind.config.js`. Make sure Tailwind config specifies the content paths correctly.
3. Configure the typography and styling tokens in `tailwind.config.js` or CSS files to support the requested typography:
   - sans-serif: Outfit
   - serif: Cormorant Garamond
   - monospace: DM Mono
4. Create the basic file structure:
   - `index.html` (loading fonts from Google Fonts: Outfit, DM Mono, Cormorant Garamond, Syne, Crimson Pro)
   - `src/main.jsx`
   - `src/App.jsx`
   - `src/index.css` (importing tailwind directives)
5. In `src/App.jsx`, implement a basic Shell Navigation chrome (brand title "DigitalMe", version tag "V2.0", tabs: Home, Principles, Domains, Data Sources) matching the navigation header in C:\Users\shane\logan-site\digital-me\WebSite\index.html. For now, the pages can just show placeholders, as the detailed view implementations are for subsequent milestones.
6. Verify the build. Propose/run build command `npm run build` in the project directory, and document the build result.
