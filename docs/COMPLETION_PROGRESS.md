# Completion progress

Plan: `docs/superpowers/plans/2026-10-12-completion.md`.

User authorized all pending implementation sequentially and selected a public phishing benchmark. Originally worked inline before Git existed; repository was subsequently initialized and pushed at commit 86b8d71. The proposal PDF remains the scope baseline.

Pre-flight: model metadata/types join tasks 1, 2, and 5; production feature schema joins tasks 1 and 3; screening fallback joins tasks 1 and 4. Preserve optional compatibility for historical reports. Real benchmark has no per-record dates, so group-disjoint evaluation must be labeled separately from temporal evaluation.

- Task 1: complete. JavaScript 70 passed / 8 integration skipped; Python 14 passed. Added bounded Python inference, artifact/schema checks, synthetic rejection, model aggregation and serialized estimates. Model installation awaits task 2.
- Task 2: complete. Imported 234,661 real benchmark records; selected Histogram Gradient Boosting on validation data and evaluated 45,589 untouched domain-group holdout records. Selected threshold 0.31349; holdout phishing precision 0.96792, recall 0.93871, F1 0.95309, false-positive rate 0.02103. Promoted the checksum-validated bundle; evaluation is historical phishing-only and non-temporal.
- Task 3: complete as tooling. Four cumulative feature schemas and shared observation extraction added, with missing-data masks, historical-snapshot validation and ablation runner. JavaScript 72 passed; Python 23 passed; four-stage synthetic smoke completed. Real hybrid performance still requires historical snapshots unavailable in the selected benchmark.
- Task 4: complete. Added accurate content summaries, HTTP-password/investment/redirect/storefront indicators, base href and associated-form extraction, per-provider persistence/export and independent expiry fallback. Scanner 8 passed; expanded JavaScript suite verified separately.
- Task 5: complete. Model estimates, actual baseline metrics/protocol/provenance and provider freshness are displayed. Python runtime and provider/model flags are wired through Docker/Compose. Lint/types/build passed; all 14 desktop/mobile browser tests passed. Local private `.env` enables the installed bundle.
- Task 6: implementation and available verification complete. Final isolated JavaScript suite: 85 passed including all 8 PostgreSQL/Redis integration cases; Python ML: 26 passed; scanner: 9 passed; four-stage synthetic ablation smoke passed. Real model submission/persistence/export/resubmission and live OpenPhish negative lookup passed. Documentation/cards/evidence updated. Independent review found three edge cases; red/green fixes and re-review completed. Docker engine absent and Google key unavailable, so container/live collection/Google acceptance remains pending; broader/temporal/hybrid research requires additional reviewed data. See `docs/evidence/verification.md`.

## Remaining-gap follow-up

Plan: `docs/superpowers/plans/2026-10-12-remaining-gaps.md`.

- Diagnosed PhiUSIIL's 100% www-prefixed legitimate cohort and path bias; added versioned lexical-v2 numeric normalization while preserving exact targets and v1 compatibility.
- Imported 666,315 PhreshPhish metadata rows from pinned public shards with no target requests/HTML downloads, sampled 150,000 by label-independent URL hash, retained 148,352. Trained three calibrated models with chronological overlap-purged partitions; promoted validation-selected HGB after frozen holdout and development checks. Holdout recall 58.41%, FPR 1.64%, F1 72.87%. Do not compare these populations as a model improvement over UCI.
- Installed dedicated Colima/Docker runtime. Actual firewall socket probe, public static HTML, DNS, authoritative RDAP and internal-target denial passed locally. Earlier GitHub run 38169512304 passed verify/isolation on the initial pushed commit.
- User configured private Google key. Benign example.com negative and Google public test-phishing positive with expiry passed; `.env` remains ignored and secrets excluded from container context. Correct app flag is ENABLE_EXTERNAL_PROVIDERS.
- Imported 1,190 published archived ScamFerret examples; 1,090 HTML snapshots and 759 domain ages. Three identical group-holdout ablations measured; domain recall 52.08%/FPR 0%, content recall 90.63%/FPR 8.47%. Crypto content FPR 21.62% prevents a broad production claim. Historical threat ablation remains unavailable; no timestamps or provider history invented.
- PostgreSQL 16 / Redis 7 integration: 86 tests passed including all eight database/queue cases. ML 41 and scanner 9 passed at this checkpoint. Full container build/browser workflow and final independent review recorded in verification evidence after completion.

- Final archive importer CLI/provenance re-review passed; 43 ML tests passed, and all 14 browser cases passed across production and targeted rerun. Enabled Docker ML acceptance exposed 13.88-second cold numerical import versus the 10-second subprocess cap; raised the bounded cap to 30 seconds and received scoped review approval.
- Rebuilt all five Docker services successfully. Final enabled HTTP workflow passed with installed v2 inference, benign example.com assessment, Google public phishing-test detection, completed live observations, persisted history, export parity and resubmission. The three-scan workflow took 16.27 seconds. The app is ready for controlled manual testing; historical threat comparison and broader deployment validation remain research limits, as recorded in the status document.
