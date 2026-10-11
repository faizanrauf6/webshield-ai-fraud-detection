# Implementation decisions

- Retain the existing Next.js/NestJS/PostgreSQL/Redis architecture and supplied workspace. No Git repository is present; no repository or commit was created.
- User requested sequential implementation of all review gaps and selected a public phishing benchmark. Use UCI PhiUSIIL with documented attribution, license, label conversion and hashes.
- Absent observation dates require explicit domain-group evaluation. Do not invent temporal dates or revisit current websites to reconstruct historical features.
- Keep calibration/model/threshold selection on validation data; the holdout is frozen before evaluation. Publish actual false positives and scope limits, including the example.com false positive.
- Keep model estimates separate from provider authority and rule warnings. Low model estimates cannot suppress existing material warnings. Synthetic demonstrations never invoke live inference or providers.
- Reuse the TypeScript feature contract for Python training and production inference, including cumulative observation schemas and missingness.
- Preserve per-provider observations in reports/exports and expire their authority independently without modifying stored history.
- The NestJS queue worker shares the API process; separate static collection uses the Python worker with pinned sockets, resource limits and firewall rules. Actual Docker acceptance remains pending locally.
- Verify persistence and browser flows using temporary loopback PostgreSQL 17.9 / Redis 8.6.1 when Docker is unavailable. CI retains PostgreSQL 16 / Redis 7 and adds scanner/isolation checks; a configured CI job is not a completed CI run.
- Preserve local deployment scope. Authentication/retention, on-chain execution, screenshots and extensions are separate work outside the agreed FYP scope. No publication, remote push or wallet operation was performed.
