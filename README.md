# WebShield AI

An explainable website-risk analysis FYP using Next.js, NestJS, PostgreSQL, Redis and scikit-learn. It supports persistent scans, optional isolated static page/domain observations, threat reports and an evaluated phishing model.

**The application and phishing benchmark are implemented. The proposal's broader hybrid fraud-detection research is not complete.** Historical phishing results do not establish deceptive-store or investment-scam performance. See [current status](docs/IMPLEMENTATION_STATUS.md) and [verification evidence](docs/evidence/verification.md).

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

## Enable the evaluated model

The evaluated bundle is installed locally in `ml/production/`. Set `ENABLE_ML=true` in `.env` and restart the API. `/api/v1/model-info` shows the actual version, threshold, scope, provenance and metrics. Inference uses `.venv/bin/python` on the host; Compose includes its Python runtime and mounts the bundle read-only. If the runtime, bundle or schema is unavailable, reports show missing ML evidence. First-time numerical-library startup can exceed the ten-second inference deadline; such scans remain unavailable and can be resubmitted.

To reproduce the public experiment without visiting any listed URL:

```bash
mkdir -p ml/data
curl --fail --location 'https://archive.ics.uci.edu/static/public/967/phiusiil%2Bphishing%2Burl%2Bdataset.zip' -o ml/data/phiusiil.zip
make benchmark-import
make benchmark-train
make promote
```

The dataset is [UCI PhiUSIIL](https://archive.ics.uci.edu/dataset/967/phiusiil+phishing+url+dataset), Prasad and Chandra (2024), CC BY 4.0. Its original labels are inverted to this project's `0=legitimate, 1=phishing`. The importer records hashes, deduplication and exclusions. The 234,661 retained examples have no observation dates: evaluation uses domain-disjoint groups, not a temporal holdout. See [dataset card](docs/DATASET_CARD.md), [model card](docs/MODEL_CARD.md) and [evaluation](docs/EVALUATION.md).

The selected model's phishing F1 is 95.31% and false-positive rate is 2.10% on the 45,589-row holdout. These are historical benchmark measurements. A direct check falsely flags `example.com`; the model is not a website-safety oracle. Model estimates never become verified provider reports.

## Optional observations and providers

Defaults keep all external integrations off. To collect static page and DNS/RDAP observations, generate a random token of at least 32 characters, store it in `CONTENT_WORKER_TOKEN`, and set the corresponding `ENABLE_CONTENT_SCANNING` / `ENABLE_DOMAIN_INTELLIGENCE` flags. Start the worker before the API:

```bash
docker compose --profile analysis up -d --build --wait analysis-worker
make test-isolation
docker compose up -d --build --wait
```

The worker pins public DNS addresses, checks connected peers, revalidates redirects, bounds responses and runs unprivileged after installing namespace firewall rules. It inspects static HTML; it does not execute JavaScript or connect wallets. **Docker isolation and live content/RDAP acceptance remain unverified on this workstation because no Docker engine is available.** The isolation probe is also wired into CI.

`ENABLE_OPENPHISH=true` enables the fixed public-feed lookup. `ENABLE_EXTERNAL_PROVIDERS=true` plus a backend `SAFE_BROWSING_API_KEY` enables Google lookup. Compose forwards these settings. Reports preserve each source's observation time, expiry and availability; expired positives lose current authority. A successful live OpenPhish negative lookup was verified; Google requires credentials that were not supplied. Full URLs may be disclosed to enabled services.

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

Use `TEST_DATABASE_URL` and `TEST_REDIS_URL` to isolate test services. CI uses PostgreSQL 16 / Redis 7; local acceptance used temporary PostgreSQL 17.9 / Redis 8.6.1. Do not share test queues with other workers.

`make ml-smoke` validates the pipeline on 240 artificial examples and writes to `ml/artifacts/`; it replaces experiment outputs there. Preserve real results first. The production bundle is separate and synthetic bundles cannot be promoted. No synthetic metrics are shown as real accuracy.

For dated reviewed data, use `make train DATASET=/path/data.csv VALIDATION_START=YYYY-MM-DD TEST_START=YYYY-MM-DD`, then `make evaluate`. Hybrid experiments accept historical JSONL snapshots through `ml/ablations.py`; all four cumulative schemas share extraction code with production. The selected UCI benchmark lacks those snapshots, so real hybrid comparisons remain pending.

## Project map

`apps/web` contains the frontend; `apps/api` contains persistence, queue and orchestration; `packages/core` contains URL policy, features and screening; `services/analysis-worker` contains isolated collection; `ml` contains training/inference; `docs` contains requirements, evidence and handoff materials.

Use the dashboard's clearly labeled `.example` demonstrations for offline phishing, retail and crypto scenarios. See [API](docs/API.md), [architecture](docs/ARCHITECTURE.md), [threat model](docs/THREAT_MODEL.md) and [FYP defense](docs/FYP_DEFENSE.md).
