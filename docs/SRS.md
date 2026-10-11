# Software requirements specification

## Purpose

A controlled FYP website-risk research application combining URL structure, optional domain/static content observations, threat reports, cryptocurrency indicators and an evaluated phishing model. Findings support review; they do not guarantee safety or prove business fraud.

## Functional requirements

1. FR-01 accept bounded public HTTP(S) URLs with readable validation errors.
2. FR-02 normalize inputs and reject unsafe or ambiguous syntax.
3. FR-03 persist asynchronous lifecycle, retry/failure history and recovery.
4. FR-04 extract versioned features and invoke a selected calibrated model; missing inference stays unavailable.
5. FR-05 expose bounded exact-URL threat observations with independent source/time/expiry.
6. FR-06 inspect bounded static content in an isolated worker, extracting forms, redirects and warning evidence.
7. FR-07 identify crypto address candidates and claim patterns without wallet actions or allegations based on address presence alone.
8. FR-08 explain model estimates, rules, current provider reports and missing checks separately.
9. FR-09 persist history, pagination, report retrieval, resubmission and JSON export.
10. FR-10 expose configuration without secrets and enforce validated collection boundaries.

## Research acceptance

Use documented source/label provenance, shared feature extraction, domain/campaign leakage controls, validation-only selection and a frozen holdout. Report class metrics, false positives, calibration, errors and limitations. The current dated PhreshPhish experiment measures temporal phishing performance. Separate published ScamFerret snapshots measure URL/domain/content comparisons for stores, investment and crypto. Historical threat/reputation comparisons remain unavailable without aligned independent provider history; broader production accuracy targets are not established by these research-only models.

## Nonfunctional requirements and evidence

Bound request/response sizes and execution time; keep secrets backend-only; render target content as text; keep integration failures distinct from clean observations. Provide responsive keyboard-accessible screens and reproducible deployment/tests. [Verification evidence](evidence/verification.md) records unit, persistence/queue, production build, mobile/desktop and accessibility outcomes plus actual container firewall, live static/DNS/RDAP and Google acceptance.

## Exclusions

Public multi-tenant hosting, accounts, full on-chain tracing, wallet transactions/seed collection, automated takedown, CAPTCHA/authentication bypass, screenshot classifiers and browser extensions. Static collection is in scope; JavaScript execution is not implemented.
