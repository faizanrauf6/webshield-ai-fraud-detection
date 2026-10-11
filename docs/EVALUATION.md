# Research evaluation

## Current phishing experiment

Question: how do three lexical baselines perform on later dated phishing examples after purging overlapping registrable-domain components from earlier periods?

PhreshPhish metadata sample: 148,352 canonical records; 51,462 training, 17,158 calibration/selection, 36,910 frozen holdout, 42,822 purged. Validation begins 2025-07-01; test begins 2025-09-09. UTC midnight only orders source days; it is not an invented exact capture time. The model and threshold are fixed on validation before scoring the holdout.

| Model                                  | Phishing precision | Recall | F1     | False-positive rate |
| -------------------------------------- | ------------------ | ------ | ------ | ------------------- |
| Logistic regression                    | 96.72%             | 58.07% | 72.57% | 1.69%               |
| Random forest                          | 96.44%             | 53.31% | 68.66% | 1.69%               |
| Histogram gradient boosting (selected) | 96.84%             | 58.41% | 72.87% | 1.64%               |

Selected threshold 0.76857; Brier score 0.11689; confusion matrix `[[19531,325],[7093,9961]]`, labels [0,1]. [Full metrics](evidence/phreshphish-evaluation.json) include calibration, ROC/PR summaries and cohorts. [Provenance](evidence/phreshphish-provenance.json) records the pinned source revision, metadata hashes and label-independent sampling. These are custom chronological partitions, not the paper's experiment.

The operating point reduces false positives at the cost of missing many phishing examples. This tradeoff is reported openly. Prefix-only correction on the old UCI dataset still overflagged paths, so the replacement uses varied modern benign URLs. [Development regressions](evidence/model-development-checks.json) check www invariance and known benign roots/login paths without whitelists. These are development checks, not held-out accuracy measurements.

## Archived store/investment/crypto comparisons

The separate [ScamFerret ablations](evidence/scamferret-ablations.json) compare lexical-v2, URL/domain-v2 and URL/domain/content-v2 on identical frozen domain-group holdouts, using validation-selected models/thresholds. Categories and coverage are reported separately. The identical holdout contains214 sites (118 legitimate / 96 scam), with763 training and213 validation. Selected results:

| Features                      | Selected model              | Scam recall | False-positive rate |
| ----------------------------- | --------------------------- | ----------- | ------------------- |
| URL                           | Histogram gradient boosting | 3.13%       | 3.39%               |
| URL + recorded domain age     | Histogram gradient boosting | 52.08%      | 0%                  |
| URL + domain + static content | Random forest               | 90.63%      | 8.47%               |

The content model's legitimate-crypto FPR is 21.62% (8/37); investment FPR 4.88% (2/41); shopping FPR 0% (0/40). Category scam recalls are 91.67%, 93.75%, 86.11% respectively. These are small samples. The 2% constraint applies to validation and failed to transfer for the content model, which is not promoted. Domain model 0/118 false positives does not establish a zero operational FPR. Recorded-data missingness may itself be predictive, so improvement is not causally attributed solely to domain age.

No source website was visited. Dates are unknown; publication upper bounds are not presented as capture timestamps or temporal evaluation.

The source does not provide independent timestamped historical threat-provider snapshots. Full threat-enriched hybrid and reputation-only historical comparisons therefore remain unavailable. Replaying today's providers against old labels would not supply that missing evidence. No improvement is assumed; report the measured results even when extra features reduce performance. Archived scam artifacts remain research-only and are not promoted into the phishing runtime.

## Legacy phishing comparison

The earlier undated PhiUSIIL group holdout measured 95.31% phishing F1 and 2.10% false positives. Its all-www legitimate collection convention and path distribution produced severe false positives on normal inputs. The old production model was replaced. Legacy [metrics](evidence/benchmark-evaluation.json) are retained for reproducibility and diagnosis, not combined with the newer results as though the test populations were interchangeable.

## Validity and reproduction

Published labels were not re-reviewed locally. Registrable domains cannot eliminate unknown cross-domain campaigns/shared templates. Calibration, model selection and threshold selection share validation. Historical sampling and class prevalence differ from live traffic. No URL-only score verifies a business or a financial outcome. Batch inference timing excludes Python startup, queue/database and external calls.

Run `make phreshphish-import phreshphish-train promote` after installing `ml/research-requirements.txt`. Import archived fraud data with `.venv/bin/python ml/scamferret.py --download-tree`, then `.venv/bin/python ml/scam_evaluation.py`. Synthetic `make ml-smoke` proves plumbing only and cannot be promoted. Original fully aligned historical hybrid studies still require appropriate dated threat-provider observations; none are fabricated.
