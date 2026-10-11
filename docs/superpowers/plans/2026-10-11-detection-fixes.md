# Detection fixes implementation plan

> **For agentic workers:** Use superpowers:executing-plans for inline implementation, with test-driven-development for behavior changes.

**Goal:** Repair project failures and implement the detection paths specified in the revised proposal.

**Architecture:** NestJS persists and queues scans, then requests bounded observations from a separately isolated Python worker. Shared evidence aggregation combines observations, optional trusted model inference and time-bounded provider reports.

**Tech Stack:** Existing TypeScript/Next.js/NestJS/TypeORM/BullMQ and Python standard library/scikit-learn.

**Spec:** `docs/superpowers/specs/2026-10-11-detection-fixes-design.md`

## Global constraints

- No fabricated probabilities, metrics, labeled datasets or provider findings.
- Submitted targets are fetched only in the separate analysis worker.
- Network flags remain false by default; original fixture-only behavior remains reproducible.
- Preserve existing work and scan data; test migrations use the separate `_test` database.
- No external publication or credential disclosure.

## Review focus

- Queue recovery beyond 1,000 records and terminal-state races.
- DNS answers containing both public and private addresses, rebinding and redirect hops.
- Oversized/slow content and script or form execution.
- Synthetic, altered, schema-incompatible or unreviewed model artifacts.
- Provider report expiry with another independent model finding remaining.

### Task 1: Existing failures and scan recovery

Files: `apps/api/src/service.ts`, `apps/api/tests/lifecycle.test.ts`, existing formatting failures.

- [ ] Reproduce lint failures; format only implicated files.
- [ ] Add a failing paginated-recovery regression; run it red.
- [ ] Implement bounded pages of recovery and verify lifecycle suites.

### Task 2: Safe isolated website observations

Files: `services/analysis-worker/`, `docker-compose.yml`, `.env.example`.

Interface: authenticated `/content` and `/domain` return bounded JSON observations, with errors unavailable to the API rather than negative findings.

- [ ] Write failing Python tests for nonpublic answers, pinned connections, peer mismatch, redirects and bounded HTML parsing.
- [ ] Implement scanner, metadata, bounded server and independently enforced Docker network policy.
- [ ] Run Python suites and actual container socket-isolation checks.

### Task 3: Content evidence and orchestration

Files: `packages/core/src/content.ts`, `apps/api/src/observations.ts`, `apps/api/src/service.ts`, relevant tests.

Interface: `applyContentObservation(analysis, observation)` updates timestamped checks, signals and crypto indicators without inventing a verified verdict.

- [ ] Add failing content and unavailable-worker tests.
- [ ] Implement shared evidence analysis and optional worker invocation.
- [ ] Verify fixture compatibility and integration failure states.

### Task 4: Reviewed model deployment

Files: `ml/deployment.py`, `ml/test_deployment.py`, `apps/api/src/model.ts`, shared assessment types and report UI.

Interface: explicit promotion from evaluated artifacts; CLI metadata/inference accepts versioned lexical features and returns calibrated probability and reviewed thresholds.

- [ ] Add failing tests for synthetic/unreviewed/tampered/schema-mismatched artifacts and threshold validation.
- [ ] Implement promotion, model inference bridge and assessment aggregation.
- [ ] Verify unavailable behavior without real data and rendering with a deterministic model-response fixture.

### Task 5: Verification and handoff

Files: README, CI, Makefile, implementation status, architecture/model/threat documentation, frontend status panels.

- [ ] Display current module status and installed model information.
- [ ] Run lint, types, unit/Python/integration suites, production build and desktop/mobile/accessibility tests.
- [ ] Update checked implementation evidence and remaining external prerequisites.
