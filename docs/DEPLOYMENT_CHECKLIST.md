# WebShield AI Local Deployment Checklist

This checklist supports a controlled local demonstration using loopback ports, PostgreSQL 16, Redis 7, the API/frontend and optional isolated static scanner. Recorded local acceptance is described in [verification evidence](evidence/verification.md). Re-run checks when the environment changes. Public hosting requires separate access-control, privacy and retention work.

## 1 Prepare the environment

- [ ] Confirm Node.js 24, npm, Python 3.14, Docker and Docker Compose are available.
- [ ] Keep the supplied proposal and final submission artifacts separate; preserve any real research outputs before running synthetic tooling.
- [ ] Run `make setup` to install locked application and Python dependencies.
- [ ] Create root `.env` from `.env.example` only if `.env` does not already exist; do not overwrite configured private keys.
- [ ] Keep `.env`, private keys, raw URL datasets and model binaries out of Git, screenshots and shared documents.
- [ ] Confirm ports 3000, 4000, 55432, 56379 and optional 4100 are free and published only on loopback.

```bash
make setup
# First installation only; preserve an existing .env.
cp -n .env.example .env
```

The locally configured Docker VM is the Colima `webshield` profile. If needed on this workstation, prefix Docker commands with `DOCKER_HOST=unix://$HOME/.colima/webshield/docker.sock`. This is workstation-specific; other environments use their own working Docker endpoint.

## 2 Start the baseline

```bash
docker compose up -d --wait postgres redis
npm run migrate
npm run dev
```

Alternatively, start the complete container baseline:

```bash
docker compose up --build -d --wait
```

- [ ] Open `http://127.0.0.1:3000` and confirm Overview renders.
- [ ] Read `http://127.0.0.1:4000/api/v1/health`; health must query actual database and queue.
- [ ] Confirm fresh-install external observation flags remain off until configured.
- [ ] Run clearly labeled synthetic scenarios and verify saved history/export without visiting real targets.

## 3 Enable the installed model

- [ ] Confirm `ml/production/` is owner-controlled and contains a genuine selected bundle; never load uploaded/untrusted joblib files.
- [ ] Set `ENABLE_ML=true`; verify host `ML_PYTHON` or the Compose runtime path and artifact directory.
- [ ] Restart/recreate the API after configuration changes.
- [ ] Read `/api/v1/model-info` and confirm available lexical-v2 phishing scope, bundle version and validation-selected threshold.
- [ ] Submit `https://example.com/` and inspect actual saved model context. A missing bundle/runtime or 30-second timeout must remain unavailable.

To recreate the public temporal experiment rather than using existing local artifacts:

```bash
.venv/bin/python -m pip install -r ml/research-requirements.txt
make phreshphish-import
make phreshphish-train
make promote
```

Downloads use metadata only and do not visit listed targets. The archived ScamFerret models stay research-only. `make ml-smoke` writes synthetic experiment artifacts and does not establish real accuracy.

## 4 Enable isolated static collection

- [ ] Generate a random `CONTENT_WORKER_TOKEN` of at least 32 characters and store it only in `.env`.
- [ ] Set the required `ENABLE_CONTENT_SCANNING` / `ENABLE_DOMAIN_INTELLIGENCE` flags and validated internal worker endpoint.
- [ ] Start the restricted worker and run the actual kernel/socket acceptance before enabling API collection.

```bash
docker compose --profile analysis up -d --build --wait analysis-worker
make test-isolation
docker compose up -d --build --wait
```

- [ ] Confirm the internal control service is reachable from the control container and forbidden from the restricted worker.
- [ ] Confirm loopback/private/metadata destinations are denied and the unprivileged worker cannot flush firewall rules.
- [ ] Confirm the worker is read-only, resource limited and serving authenticated requests after dropping privileges.
- [ ] Re-run isolation after host, image or network changes. Do not replace the restricted container with an ordinary host process for live targets.

The collector uses bounded static HTML; it does not execute scripts, submit forms, bypass authentication or connect wallets.

## 5 Enable current providers

- [ ] Review [Google Safe Browsing usage restrictions](https://developers.google.com/safe-browsing/v4/usage-limits) for the intended deployment; the current adapter is for the documented noncommercial context.
- [ ] Set `ENABLE_EXTERNAL_PROVIDERS=true` and a backend `SAFE_BROWSING_API_KEY` to enable Google.
- [ ] Set `ENABLE_OPENPHISH=true` to enable the fixed community-feed adapter when desired.
- [ ] Restart the API and confirm Configuration shows the expected enablement without exposing secrets.
- [ ] Run `npm run test:live` for benign HTML/DNS/RDAP, internal denial and official Google benign/test-phishing acceptance.
- [ ] Confirm each provider's observation time, availability and expiry are visible; expired positives must lose current authority independently.
- [ ] Explain that full submitted URLs may be disclosed to providers; remove private URL parameters before demonstrations.

An enabled flag is configuration evidence, not provider health. A successful no-match lookup is not proof of safety.

## 6 Verify the deployment

```bash
npm run test:integration
make test
make test-scanner
npm run lint
npm run build
npm run test:e2e
make test-isolation
npm run test:live
```

- [ ] Use a separate `_test` database and Redis DB 1 for persistence/queue tests.
- [ ] Use separate browser ports/database/queue for the baseline suite, with providers/ML disabled unless a case explicitly supplies fixtures.
- [ ] Confirm current enabled workflow separately; baseline fixtures do not prove the installed runtime or live integrations.
- [ ] Check desktop/mobile, both themes, keyboard controls, safe text rendering and horizontally scrolling evidence tables.
- [ ] Verify saved history, export parity, resubmission UUID and partial/unavailable failures.
- [ ] Record exact outcomes, environment and any retries instead of copying prior results as a new run.

## 7 Restart and preserve data

```bash
docker compose --profile analysis stop
docker compose --profile analysis up -d --wait
```

- [ ] Keep PostgreSQL/Redis volumes and `ml/production/` artifacts when restarting.
- [ ] Confirm persisted history and model availability after restart; startup reconciliation should handle eligible interrupted work.
- [ ] Do not use volume-deletion options as ordinary cleanup; they destroy stored scans.
- [ ] Back up required records and preserve original evidence before any deliberate reset.

## 8 Handoff record

Operator: ____________________ Date: ____________________

Environment/version: ____________________

Recorded evidence location: ____________________

Remaining issues: ____________________

Human acceptance is recorded separately in [acceptance checklist](ACCEPTANCE_CHECKLIST.md). These blank fields are intentionally unsigned; sample submission identities do not constitute approval.
