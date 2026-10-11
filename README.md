# WebShield AI

An explainable website-risk analysis FYP using Next.js, NestJS, PostgreSQL, Redis and scikit-learn. It supports persistent scans, optional isolated static page/domain observations, threat reports and an evaluated phishing model.

**The controlled FYP application has a temporally evaluated phishing model, working Google verification, an isolated scanner, readable light/dark UI and a submission package.** Separate archived and prospective research studies record measured strengths and failures; they do not establish universal fraud detection. See [current status](docs/IMPLEMENTATION_STATUS.md), [final report](docs/FINAL_REPORT.md) and [user manual](docs/USER_MANUAL.md).

## Run locally

Requirements: Node.js 24, npm, Python 3.14 and Docker Compose. Default ports: frontend 3000, API 4000, PostgreSQL 55432, Redis 56379.

```bash
make setup
cp .env.example .env
docker compose up -d --wait postgres redis
npm run migrate
npm run dev
```

Open http://127.0.0.1:3000. Configuration loads from the root `.env`. For all application services in containers, use `docker compose up --build -d --wait`. `docker compose down` preserves stored scans. Local history is shared; there are no accounts or automatic retention limits.

Use the header’s sun/moon theme switch for light or dark mode. The initial theme follows your device; a manual choice is remembered in this browser. Main text and form inputs use 16 px sizing, with supporting labels at least 14 px at the default browser font size. Typography uses relative units so browser font preferences and zoom remain effective.

## Enable the evaluated model

The evaluated bundle is installed locally in `ml/production/`. Set `ENABLE_ML=true` in `.env` and restart the API. `/api/v1/model-info` shows the actual version, threshold, scope, provenance and metrics. Inference uses `.venv/bin/python` on the host; Compose includes its Python runtime and mounts the bundle read-only. If the runtime, bundle or schema is unavailable, reports show missing ML evidence. First-time numerical-library startup can exceed the 30-second inference deadline; such scans remain unavailable and can be resubmitted.

To reproduce the current public experiment without visiting any listed URL:

```bash
.venv/bin/python -m pip install -r ml/research-requirements.txt
make phreshphish-import
make phreshphish-train
make promote
```

The current dataset is [PhreshPhish](https://huggingface.co/datasets/phreshphish/phreshphish), CC BY 4.0, pinned to revision `eabec4b7a66324b79cc8a0ad856d1731dc26fe1a`. HTTP range reads retrieve only URL/label/date metadata, excluding the 36 GB HTML corpus. A label-independent hash sample of 150,000 rows retains 148,352 valid canonical records. Custom chronological splits use validation from July 2025 and test from 9 September 2025, purging domain overlap from earlier periods. These are not the paper's original split assignments.

The selected sigmoid-calibrated Histogram Gradient Boosting model measures 96.84% phishing precision, 58.41% recall, 72.87% F1 and 1.64% false positives on 36,910 held-out records. Its warning threshold is 76.86%. The lower recall than the older benchmark is reported openly. `example.com` and the benign login development cases are below that threshold; adding `www.` produces identical features and predictions. No domain allowlist or fitted exception is used. Probabilities remain dataset-specific estimates.

The older [UCI PhiUSIIL](https://archive.ics.uci.edu/dataset/967/phiusiil+phishing+url+dataset) comparison remains in `docs/evidence/benchmark-*.json`. Its source convention (every legitimate URL prefixed with `www.`) caused a major live-site false positive; that model was replaced. To reproduce UCI separately, download its official archive into `ml/data/phiusiil.zip`, then run `make benchmark-import benchmark-train`. Promotion also requires development regressions to pass.

See [dataset card](docs/DATASET_CARD.md), [model card](docs/MODEL_CARD.md) and [evaluation](docs/EVALUATION.md) for experimental limits and archived fraud evaluation.

The additional frozen [quality study](docs/evidence/model-quality-study.json) improves descriptive phishing recall to 83.53% at 1.82% FPR on the identical previously examined historical holdout, but legitimate HTTP false positives remain 49.18%. It is a research candidate; the installed model is unchanged. Archived missingness-aware modeling reduces false positives while losing recall. Neither result establishes a universally better deployment. [Research reproduction](docs/RESEARCH_REPRODUCTION.md) explains source pins, validation locks, the prospective aligned pilot, external model comparison and missing-data handling.

## Optional observations and providers

Defaults keep all external integrations off. To collect static page and DNS/RDAP observations, generate a random token of at least 32 characters, store it in `CONTENT_WORKER_TOKEN`, and set the corresponding `ENABLE_CONTENT_SCANNING` / `ENABLE_DOMAIN_INTELLIGENCE` flags. Start the worker before the API:

```bash
docker compose --profile analysis up -d --build --wait analysis-worker
make test-isolation
docker compose up -d --build --wait
```

The worker pins public DNS addresses, checks connected peers, revalidates redirects, bounds responses and runs unprivileged after installing namespace firewall rules. It inspects static HTML; it does not execute JavaScript or connect wallets. Local Docker firewall and live HTML/DNS/authoritative-RDAP acceptance passed. A dedicated Colima profile `webshield` is installed on this workstation; use `DOCKER_HOST=unix://$HOME/.colima/webshield/docker.sock` when the default Docker context is unavailable. The socket probe also passed in GitHub CI.

`ENABLE_OPENPHISH=true` enables the fixed public-feed lookup. `ENABLE_EXTERNAL_PROVIDERS=true` plus a backend `SAFE_BROWSING_API_KEY` enables Google lookup. Compose forwards these settings. Reports preserve each source's observation time, expiry and availability; expired positives lose current authority. A successful live OpenPhish negative lookup was verified; Google live acceptance passed with the locally configured private key: a benign URL returned no match and Google’s public phishing test URL returned SOCIAL_ENGINEERING with an expiry. Run `npm run test:live` to repeat the provider and scanner checks. Full URLs may be disclosed to enabled services.

## Verification

```bash
npm test
npm run test:integration       # separate *_test database; Redis DB 1
make test                     # application plus Python ML tests
make test-scanner
npm run lint
npm run build
npx playwright install chromium
npm run test:e2e               # running API/frontend; ML/providers disabled for baseline suite
make test-isolation           # running Docker analysis profile
```

Use `TEST_DATABASE_URL` and `TEST_REDIS_URL` to isolate test services. CI uses PostgreSQL 16 / Redis 7; current local integration acceptance uses those PostgreSQL 16 / Redis 7 containers too. Do not share test queues with other workers.

The separate [operational acceptance](docs/evidence/operational-verification.md) records 20 browser passes, twelve bounded baseline timings, two recovered queued scans after an actual API process crash, and three enabled benign scans (median 5.413 s, maximum 7.012 s). This short sample is not a capacity benchmark or human signoff.

`make ml-smoke` validates the pipeline on 240 artificial examples and writes to `ml/artifacts/`; it replaces experiment outputs there. Preserve real results first. The production bundle is separate and synthetic bundles cannot be promoted. No synthetic metrics are shown as real accuracy.

For dated reviewed data, use `make train DATASET=/path/data.csv VALIDATION_START=YYYY-MM-DD TEST_START=YYYY-MM-DD`, then `make evaluate`. Hybrid experiments accept historical JSONL snapshots through `ml/ablations.py`; all four cumulative schemas share extraction code with production. The older UCI benchmark lacks those snapshots. The separate ScamFerret importer and evaluator use bounded published HTML and recorded WHOIS metadata for store/investment/crypto comparisons; missing historical threat observations remain explicit.

## Project map

`apps/web` contains the frontend; `apps/api` contains persistence, queue and orchestration; `packages/core` contains URL policy, features and screening; `services/analysis-worker` contains isolated collection; `ml` contains training/inference; `docs` contains requirements, evidence and handoff materials.

Use the dashboard's clearly labeled `.example` demonstrations for offline phishing, retail and crypto scenarios. See [API](docs/API.md), [architecture](docs/ARCHITECTURE.md), [threat model](docs/THREAT_MODEL.md) and [FYP defense](docs/FYP_DEFENSE.md).

The [final report](docs/submission/WebShield_AI_Final_Report.pdf) and [manual](docs/submission/WebShield_AI_User_Manual.pdf) have editable DOCX and offline HTML versions alongside them. Cover identities are conspicuously labelled **SAMPLE / DEMONSTRATION**, as requested. [Deployment](docs/DEPLOYMENT_CHECKLIST.md) and [acceptance](docs/ACCEPTANCE_CHECKLIST.md) procedures distinguish executed developer checks from an unsigned academic/user decision.
