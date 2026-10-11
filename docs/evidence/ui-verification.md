# UI verification — 12 October 2026

Requested changes: readable typography across the existing application and light/dark mode.

- Replaced 6–13 px text with relative sizing: supporting text at least 14 px, main explanatory text and inputs 16 px at the default browser font size. Adjusted wrapping, card layouts and navigation spacing.
- Added shared semantic colors for both themes, a keyboard-accessible header switch, device preference on first visit, browser persistence, cross-tab synchronization and a storage-blocked fallback. The initial theme is applied before paint using the installed Next.js guidance.
- Fixed an absolute screen-reader table-header label escaping the mobile scroll container. Browser diagnosis measured document width 659 px in a 390 px viewport; adding a positioning context to the table scroller restored 390 px. The regression check compares document width with the configured viewport, since mobile `innerWidth` can expand with overflowing content.

Verification:

- Production browser suite: **20 passed** across desktop and mobile, including existing submission/report/export/history flows and new theme/device/persistence/storage/readability checks.
- Automated WCAG A/AA checks passed on overview, history, research and configuration in both themes. A separate dark synthetic crypto report check also passed.
- Visual and width checks passed at 390 px narrow desktop, iPhone 13 and 900 px tablet sizes. Tables retain their own horizontal scrolling.
- `npm test`: **78 passed, 8 database integration tests skipped** in this unit run. Backend behavior was unchanged; the earlier integration acceptance is recorded separately.
- ESLint, Prettier, TypeScript and production frontend/application builds passed. Focused independent review found no Critical or Important issues; its optional selection-highlight polish was applied.

Tests used frontend port 3002 and baseline API port 4001 with a separate browser-test database and Redis database 2. The running Docker application retains its enabled live integrations. Credentials and generated model/data files remain excluded from Git.
