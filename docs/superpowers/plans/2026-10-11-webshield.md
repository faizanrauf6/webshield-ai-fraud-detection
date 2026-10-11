# WebShield AI Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Deliver a runnable, transparent website-risk FYP with Next.js, NestJS, persisted asynchronous scans and reproducible ML tooling.

**Architecture:** NestJS stores scan lifecycle and evidence in PostgreSQL and runs BullMQ jobs through Redis. Next.js renders results and research pages. Python experiments consume the same versioned lexical feature contract; no submitted website is fetched.

**Tech Stack:** Next.js App Router, React, TypeScript, NestJS, TypeORM, BullMQ, PostgreSQL, Redis, scikit-learn, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-11-webshield-design.md`

## Global constraints

- Content scanning and external providers are disabled by default.
- No invented scores, threat reports or accuracy; fixtures are labeled synthetic.
- No target-page HTTP requests, wallet interaction or unsafe HTML rendering.
- Missing evidence results in inconclusive, not safe.

## Review focus

- Ambiguous IP spellings and encoded hosts must not bypass normalization policy.
- Queue failures and repeated jobs must not leave misleading completed scans.
- Bad pagination cursors and unknown identifiers must return controlled errors.
- Provider outages and malformed responses must remain unavailable evidence.
- Fixture ML metrics must never become claims of real-world performance.

## Task 1 — Safe analysis contract

Files: `packages/core/src/{index,policy,features,analysis,types}.ts`, `packages/core/tests/core.test.ts`.
Produces: `normalizeUrl(input: string): string`, `extractFeatures(url: string): Record<string, number>`, `analyzeUrl(url: string, fixture?: Fixture): Analysis`.

- [ ] Write failing tests for unsafe hosts, ports, credentials, alternate IP spellings, controls and accepted public URLs.
- [ ] Run `npm test`; confirm missing implementation fails.
- [ ] Implement conservative syntax policy without network access, shared numeric features and evidence-only analysis; fixture content is explicit and bounded.
- [ ] Test investment language, address validation and provider-unavailable evidence; verify no numeric score or confirmed verdict is fabricated.
- [ ] Run core tests and typecheck.

## Task 2 — Persistent NestJS scan service

Files: `apps/api/src/{main,module,controller,service,entity,queue,providers}.ts`, `apps/api/tests/api.test.ts`, `apps/api/migrations/001.sql`.
Consumes core contract. Produces HTTP endpoints from the approved spec, scan UUIDs, cursor history, JSON export, provider/model status.

- [ ] Write lifecycle tests against a disposable local PostgreSQL/Redis stack, including queue failure, unsafe URLs, unknown UUIDs and malformed cursors.
- [ ] Implement migrations, TypeORM persistence, idempotent worker and bounded retries; persist queue failures.
- [ ] Add fixed-endpoint Safe Browsing adapter with strict parsing, timeout and unavailable state, disabled by default.
- [ ] Run API tests and build; confirm restart persistence.

## Task 3 — Working dashboard

Files: `apps/web/app/{page,layout,globals.css}`, `apps/web/app/{history,research,settings,scan/[id]}/page.tsx`, `apps/web/components/{shell,dashboard,report,history,research,settings}.tsx`, `apps/web/lib/api.ts`, `tests/e2e.spec.ts`.
Consumes NestJS endpoints via same-origin Next.js rewrite. Produces responsive dashboard, scan flow, evidence/history tables, export, research and provider status.

- [ ] Write browser tests for submit/report/history/export, invalid input, keyboard use and unavailable providers.
- [ ] Implement pages with truthful empty and unavailable states, labeled fixture scenarios, accessible navigation and polling cleanup.
- [ ] Run production build and Playwright desktop/mobile checks.

## Task 4 — Reproducible ML and documentation

Files: `ml/{pipeline.py,test_pipeline.py,requirements.txt,feature_schema.json}`, `docs/{DATASET_CARD,MODEL_CARD,EVALUATION,THREAT_MODEL,ARCHITECTURE,API,IMPLEMENTATION_STATUS,DECISIONS}.md`, `README.md`, `.env.example`, `docker-compose.yml`, `Makefile`, `.github/workflows/ci.yml`.
Produces three measured offline baselines, timestamp/group split validation, feature parity checks and JSON metrics; synthetic data is pipeline validation only.

- [ ] Write tests rejecting overlapping domains/campaigns and invalid labels and checking feature parity with TypeScript.
- [ ] Implement prepare/train/evaluate commands with frozen temporal/group holdout, calibration metrics and trusted-local artifact checks.
- [ ] Run synthetic smoke experiments and clearly label their limited meaning; leave real-world model deployment unavailable.
- [ ] Document setup, threat boundaries, experiments, limitations and remaining content-isolation work.
- [ ] Run full test, typecheck, build and integration checks; review final implementation and record actual outcomes.
