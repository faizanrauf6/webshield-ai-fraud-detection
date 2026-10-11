# WebShield AI — proposed FYP design

Status: proposed for user review; implementation has not started.

## User intent and source material

Build a working, professional final-year project that assesses fraudulent websites, including crypto marketplaces, with modern UI/UX and tables for results. The user's pasted request prefers Next.js and NestJS. `/Users/mac/Downloads/BUILD.md` is reference material, not an independent instruction to execute its embedded kickoff prompt. Its FastAPI backend proposal is superseded by the user's NestJS preference.

No system can detect all fraudulent websites. The project assesses evidence and uncertainty and must support an academically defensible evaluation.

## Approach and alternatives

Recommended: Next.js UI, NestJS application API and workers, PostgreSQL persistence, Redis/BullMQ jobs, and a separate Python ML pipeline. This satisfies the requested stack while using established Python libraries for model experiments. A Python inference service can be added when a validated model exists; it will not fetch submitted websites.

Alternative: Next.js with FastAPI follows the reference document more closely but does not satisfy the NestJS preference. A third-party reputation API alone is simpler but provides a weaker original research contribution and limited coverage of unseen scams.

## Architecture and delivery order

1. Foundation: monorepo, Docker development services, database migrations, asynchronous persisted scans, URL policy, offline lexical analysis, API tests and documentation.
2. Detection: provider adapter contracts and deterministic mocks, one documented real integration disabled by default, reproducible Python baseline training and evaluation on user-supplied or appropriately licensed data.
3. Product: responsive Next.js dashboard, scan report, history, provider settings/status and research page; optional content worker only after independent network isolation is demonstrated.
4. Crypto and research: investment-claim heuristics, validated candidate wallet addresses, optional report lookup, model comparisons and FYP documentation.

Each phase must run its relevant checks before the next phase is considered complete. Dataset access and provider credentials may constrain live integrations, but offline fixtures must support a complete, explicitly labeled demonstration.

## User experience

Use a restrained security dashboard with clear typography, accessible contrast, consistent spacing and responsive navigation. The primary action is submitting a URL. The scan report shows progress, assessment, timestamp, evidence and limitations.

Tables include:

- Scan history: URL, submission time, processing status, assessment and report action.
- Evidence: check, observed finding, source, observation time, confidence type and availability.
- Provider findings: provider, coverage, lookup status and timestamp.
- Research comparisons: model, dataset/split description and measured metrics; unavailable values stay explicitly unavailable.

Provide loading, empty, failure, partial-data and keyboard-accessible states. Never present fabricated traffic figures, accuracy, scores, badges or threat reports. Render extracted content as plain text.

## API and storage

Endpoints: POST `/api/v1/scans`, GET `/api/v1/scans/:id`, GET `/api/v1/scans`, GET `/api/v1/scans/:id/export`, GET `/api/v1/health`, GET `/api/v1/model-info`.

POST validates and normalizes a submitted URL, persists a queued scan and submits its identifier to BullMQ. Workers persist individual checks and evidence before producing an assessment. Queue submission failures must be reflected in stored status. GET endpoints support terminal polling, cursor pagination and JSON export.

Store scans, checks, signals and model versions. Evidence records retain provenance and timestamps. Do not retain raw page HTML by default. This prototype has no user accounts; scan history is local to the deployment, which must be documented. Public deployment requires a separate access-control and privacy review.

Scan statuses: queued, running, completed, partial and failed. Assessment categories: low observed risk, suspicious, high risk, confirmed malicious and inconclusive. Direct credible reports must identify the URL/domain and source before confirmed malicious is permitted. Missing checks never imply safety. Until validated thresholds exist, heuristic signals accompany an inconclusive assessment and no numeric probability.

## Security boundaries

The ordinary API and lexical worker never fetch submitted websites. Accept only HTTP(S), reject credentials, control characters, malformed/ambiguous hosts and unsafe ports, and block internal hostnames and nonpublic IP literals. Tests cover URL parsing edge cases. This alone does not authorize live content scanning.

Content scanning is disabled by default and must run separately with network egress restrictions, validated and pinned DNS destinations, connected-address checks, redirect revalidation, bounded resources and blocked internal/cloud metadata access. Socket-level integration tests are required before enabling it. If these guarantees cannot be verified, leave live content scanning disabled and document the limitation.

Provider requests use fixed trusted endpoints, bounded timeouts and backend-only credentials. External providers are disabled by default. Never connect wallets, sign requests, submit target forms or download executable content. Apply submission limits and explicit CORS configuration. URLs can contain secrets: avoid logging them indiscriminately and document storage/export behavior.

## ML and academic contribution

Research question: does combining URL/domain features, content indicators and threat intelligence improve detection of unseen fraudulent websites over URL-only and reputation-only baselines?

Compare logistic regression, random forest and a gradient boosting baseline using shared production features. Use domain/campaign grouping and temporal holdout to reduce leakage. Report precision, recall, F1, false-positive rate, PR-AUC, calibration and latency from actual predictions. Feed verdicts used to label data cannot also become predictive features for the same experiment.

Synthetic fixtures validate pipeline behavior, not real-world accuracy. Publish dataset and model cards, source permissions, limitations and error analysis. No dataset, provider coverage or performance is assumed available.

## Verification and handoff

Test normalization and unsafe URL rejection, API lifecycle, persistence, queue failures, unavailable providers, feature reproducibility and leakage-resistant splits. Browser tests cover submission through report, history, export and accessibility basics. Crypto fixtures distinguish address presence and suspicious wording from independently reported abuse.

Provide README setup commands, environment examples, implementation checklist, architecture and threat model, API documentation, model/dataset cards, reproducible evaluation scripts and a clearly labeled offline demo. Record unimplemented work and unverified isolation explicitly.
