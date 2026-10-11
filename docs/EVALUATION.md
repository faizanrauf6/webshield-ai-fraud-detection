# Research evaluation

## Completed phishing experiment

Question tested: how do three lexical classifiers perform on unseen registrable-domain groups in the published PhiUSIIL phishing benchmark?

234,661 canonical records were split into 142,492 training, 46,580 calibration/selection and 45,589 frozen holdout examples. The holdout contains 27,202 legitimate and 18,387 phishing records. Seed 42; connected groups disjoint; exact production TypeScript lexical features. Model and operational threshold selection use validation only. Dates are unavailable, so this is not temporal evaluation.

| Model                                  | Phishing precision | Recall | F1     | False-positive rate |
| -------------------------------------- | ------------------ | ------ | ------ | ------------------- |
| Logistic regression                    | 96.82%             | 89.95% | 93.26% | 2.00%               |
| Random forest                          | 96.81%             | 93.51% | 95.13% | 2.08%               |
| Histogram gradient boosting (selected) | 96.79%             | 93.87% | 95.31% | 2.10%               |

The selected model's holdout confusion matrix is `[[26630,572],[1127,17260]]` for labels `[0,1]`. Threshold 0.31349; Brier score 0.02924. The 2% false-positive constraint applies to validation selection; holdout measured 2.10%. No threshold was retuned on the holdout.

[Complete measured results](evidence/benchmark-evaluation.json) include per-class metrics, ROC/PR summaries, calibration bins, inference timing and HTTPS/punycode/IP cohorts. Local `ml/artifacts/*-errors.json` contains false-positive/negative records for review; raw suspicious URLs are not included in shared documents. [Source provenance](evidence/benchmark-provenance.json) records labels, hashes and exclusions.

## Validity and error analysis

Published benchmark labels were not independently re-reviewed. Domain grouping cannot eliminate unknown cross-domain campaigns. Calibration and selection share validation data. Historical sampling, source-specific URL conventions and class prevalence may differ sharply from live traffic. A direct installed-model check falsely flags `example.com` near 100% phishing. Benchmark metrics therefore do not establish reliable arbitrary-site classification. No URL-only estimate is a verified fraud verdict.

Batch inference timing excludes Python startup, extraction, queue/database and external calls. The installed workflow check measures real submission, persistence, export and resubmission separately in [workflow evidence](evidence/installed-model-workflow.json). A single workflow run is not a latency distribution or service-level guarantee.

## Hybrid proposal hypothesis

The broader question—whether domain, content, threat and crypto observations improve detection of phishing, stores and investment fraud—remains open. Four cumulative feature schemas and historical-snapshot ablation tooling are implemented and smoke-tested with synthetic data. PhiUSIIL does not supply the aligned historical observations or broader labels needed for that conclusion. No real hybrid, reputation-only comparison or temporal robustness result is claimed.

To complete that study: obtain dated reviewed cohorts and historical snapshots; keep label-producing intelligence separate from predictor evidence; freeze connected-group/time splits; select thresholds on validation; compare cumulative ablations and reputation-only baselines on the same holdout; inspect false positives, missingness, language, domain age and crypto cohorts. Report results even if hybrid features do not improve performance.

## Reproduction

Use `make benchmark-import`, `make benchmark-train`, `make promote` after downloading the source archive as documented in README. Synthetic `make ml-smoke` validates plumbing only and replaces `ml/artifacts/` outputs; preserve benchmark artifacts first. Run historical ablations with `.venv/bin/python ml/ablations.py --dataset /path/snapshots.jsonl --provenance /path/source.json --validation-start YYYY-MM-DD --test-start YYYY-MM-DD`.
