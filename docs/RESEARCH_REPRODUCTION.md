# Research reproduction

The installed application uses the approved lexical-v2 phishing bundle. The quality studies and prospective hybrid pilot are separate research artifacts; these commands do not promote them. Keep raw labels, target URLs, downloaded observations and model binaries in the ignored `ml/data/` and `ml/artifacts/` directories. Never commit `.env` or provider credentials.

## Historical studies

Install the ordinary project and the additional metadata-import dependencies:

```sh
make setup
.venv/bin/python -m pip install -r ml/research-requirements.txt
make phreshphish-import phreshphish-train
.venv/bin/python ml/scamferret.py --download-tree
.venv/bin/python ml/scam_evaluation.py
make quality-study
```

Pinned public source revisions, licensing and label conventions are in the [dataset card](DATASET_CARD.md). These importers read published archives/metadata, without visiting listed target sites. The quality study verifies reconstructed partitions against baseline dataset/holdout hashes, then freezes candidate choices and sensitivity thresholds from validation before scoring. Its historical holdouts have previously been examined, so the resulting comparisons are descriptive reuse. The character/lexical candidate remains incompatible with the production bundle format and is not automatically promoted.

The measured quality study is in [model-quality-study.json](evidence/model-quality-study.json). Re-running it overwrites that evidence and local candidate files; retain the original artifacts first when auditing a particular run. Do not select a threshold from the reported test sensitivity table.

## Prospective aligned pilot

The pilot collects real contemporary observations rather than claiming current provider checks are historical evidence. It takes 100 recent, community-verified, online PhishTank URLs with distinct registrable domains, ordered by a label-independent URL hash, and all 100 prespecified official references in `ml/reference-sites.json`. One deterministic label-independent order controls acquisition. Failed content, DNS, RDAP or provider requests remain in the cohort.

After reproducing the historical studies, freeze the new experiment and external-model plans **before examining prospective model results**:

```sh
make aligned-plan
make aligned-source
make aligned-collect
make aligned-evaluate
```

`aligned-source` downloads one bounded public PhishTank snapshot. Unauthenticated downloads are rate limited; reuse an existing snapshot rather than downloading repeatedly. The helper refuses to overwrite it. The owner’s original ignored cache also contains an investigated CERT Polska snapshot; that source is **not used** for this experiment’s labels or features.

Collection requires the already verified Docker-isolated analysis worker, a private `CONTENT_WORKER_TOKEN`, and a configured backend `SAFE_BROWSING_API_KEY`. The worker endpoint must be reachable on loopback 4100. `scripts/aligned-cohort.ts` loads the root `.env`; it never prints keys or target URLs. It runs one candidate at a time with at most two isolated requests, preserving actual observation/provider times and expiry. Reserve the scanner during collection rather than combining it with live load measurements. Full submitted URLs are disclosed to enabled providers.

Candidates and labels are saved before acquisition; interruption resumes completed rows without changing candidates or label dates. A different public snapshot/reference set intentionally conflicts with the frozen candidate list. Preserve the original cache and use a separate checkout/experiment directory for a new study. Time-varying websites and provider feeds cannot reproduce the original observations bit for bit through fresh network requests.

The evaluator enforces frozen candidate identity, actual acquisition time, no future/expired completed evidence, identical partitions across all four cumulative feature stages, disjoint domain/campaign groups and validation-only model/threshold selection. All stage/protocol selections are written before any test predictions. It runs both domain-group 60/20/20 partitions and single-session chronological sensitivity; the latter is not a long-term temporal experiment. All candidates remain, with availability masks for missing evidence. Google, OpenPhish and either-provider alert baselines are measured on the same rows, with coverage/abstentions explicit.

Acquisition integrity checks found scanner/host clock differences up to 27.576 ms. A documented preprocessing amendment, made before model scoring, leaves raw JSONL and all source timestamps unchanged. In derived snapshots only, assessment `asOf` becomes the maximum reported source timestamp or host completion; chronological partitions retain the original host completion. The entire cohort is rejected if source clock skew exceeds one second, and provider expiry is reassessed without extending TTL. Evidence records raw/derived hashes, affected counts and the algorithm version. This is clock-watermark normalization, not reconstructed historical capture time.

The external comparison keeps both the installed production model and the character candidate frozen. It reports the entire cohort and a subset excluding domains anywhere in the historical PhreshPhish sample. No fitting, recalibration, threshold adjustment or promotion uses these labels.

This is a small convenience pilot: negatives are famous HTTPS homepages and positives retain arbitrary feed paths. Path/URL length, domain age, popularity and acquisition-source shortcuts can dominate. Official identity is not a compromise audit; community labels are not independent current-page adjudication. Different public feeds may share reports. This study cannot establish general store/investment fraud accuracy, repair the known legitimate-HTTP failure, or guarantee a 2% operational false-positive rate. Interpret binomial intervals and paired domain bootstrap conditionally on this sample and these fixed models.

## Verification and document exports

```sh
make test test-scanner
npm run test:integration
npm run lint
npm run build
```

The [operational evidence](evidence/operational-verification.md) explains isolated ports/databases, browser-build requirements, bounded performance and crash-recovery reproduction. The [final report](FINAL_REPORT.md) contains document-export instructions. Synthetic smoke tests validate plumbing only; developer checks do not supply a human signature or prove arbitrary-site safety.
