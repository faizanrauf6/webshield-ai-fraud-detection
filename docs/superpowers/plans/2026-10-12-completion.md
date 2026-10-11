# WebShield completion implementation plan

> Execute inline using superpowers:executing-plans and test-driven development, one task at a time.

**Goal:** Implement the pending code, research tooling, and deployment verification from the project review.

**Architecture:** Extend existing NestJS orchestration with versioned Python inference. Train and select offline; expose model estimates independently of provider evidence. Reuse shared TypeScript feature extraction and isolated static content observations.

**Tech stack:** Existing TypeScript, NestJS, Next.js, PostgreSQL, Redis, Python, scikit-learn, Docker, Vitest, unittest, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-12-completion-design.md`.

## Global constraints

- No fabricated labels, dates, metrics, hybrid experiments, or synthetic production models.
- Preserve local deployment defaults, safe target collection, and explicit missing-data states.
- Public benchmark scope is phishing; broader fraud generalization requires suitable data.
- No Git checkout exists; retain progress in `docs/COMPLETION_PROGRESS.md`.

## Review focus

- Tampered or synthetic models must never become a production prediction.
- Missing observations must remain missing, and low model scores must not hide warnings.
- Domain/campaign overlap and test data must not influence model/threshold selection.
- Expired provider findings must lose current authority independently.
- API failure and unavailable Docker must not be misreported as passed operational checks.

## Task 1 Production inference

- [x] Add failing Python bundle and TypeScript model-aggregation tests.
- [x] Implement `ml/inference.py`, `apps/api/src/model.ts`, shared prediction types, orchestration, and serialization. Validate schema/checksums and subprocess bounds; reject synthetic production artifacts.
- [x] Run Python and JavaScript suites and record evidence.

## Task 2 Data preparation and model selection

- [x] Add failing grouped-split, threshold-selection, label-mapping, and holdout-isolation tests.
- [x] Implement UCI import, provenance, reproducible group splits, validation selection, frozen evaluation, error cohorts, and production promotion. Preserve dated temporal evaluation.
- [x] Run benchmark comparison and promote only the selected real-data model. Record metrics and exclusions.

## Task 3 Hybrid experiments

- [x] Add failing feature-parity/missing-observation and ablation tests.
- [x] Implement optional observation feature groups shared with production and staged ablations with explicit availability requirements. Do not claim unavailable historical observations were evaluated.
- [x] Run parity tests and smoke ablations; record what needs further data.

## Task 4 Detection and evidence

- [x] Add failing HTTP-form summary, redirect, storefront, and provider-expiry tests.
- [x] Extend screening rules, accurate summaries, HTML form extraction, per-provider evidence/export, and expiry fallback.
- [x] Run scanner/core/API suites.

## Task 5 Configuration and frontend

- [x] Add browser tests for installed model estimates, measured research metrics, and provider freshness.
- [x] Wire provider and Python/model configuration through Compose/Docker; display model scope, estimates, thresholds, provenance, and actual results.
- [x] Run lint, types, production build, and browser checks.

## Task 6 Operational verification and handoff

- [x] Add scanner and isolation verification to CI and reproducible local checks.
- [x] Run database/queue, browser, live integrations, isolation, and failure checks where prerequisites are available.
- [x] Update project documentation and completion status with exact evidence and remaining external requirements.
- [x] Perform final code review, fix material findings, rerun affected checks, and summarize outcome.

## Final scope note

Implementation and all checks with available prerequisites are complete. Container/runtime acceptance, live Google lookup and broader temporal/hybrid research remain pending for the explicit prerequisites in `docs/evidence/verification.md`; checked implementation tasks do not mean those results exist.
