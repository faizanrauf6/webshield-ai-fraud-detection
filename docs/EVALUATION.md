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

## Frozen quality study and new-source confirmation

The [prespecified quality study](evidence/model-quality-study.json) compares richer character/lexical and missingness-aware candidates on exactly reconstructed historical partitions. All candidate and sensitivity thresholds are durably selected on validation before holdout scoring. Historical holdouts had previously been examined, so this is descriptive reuse. The character/lexical candidate measures 97.53% precision, 83.53% recall and 1.82% FPR on 36,910 records; its paired connected-domain bootstrap recall gain is +25.12 percentage points (95% interval +23.58 to +26.86). Legitimate HTTP FPR remains 49.18% (60/122), and its global FPR interval crosses 2%. Archived shallow-forest FPR falls to 4.24% but recall falls to 77.08%; legitimate cryptocurrency FPR remains 8.11% (3/37). These tradeoffs do not justify promotion.

The [new-source comparison](evidence/external-model-validation.json) then applies the fixed installed and character models, without fitting/recalibration, to the 200-site prospective cohort below. Installed recall is 62% with 0/100 reference false positives; character recall is 81% with 12/100 false positives. Excluding all domains present anywhere in the historical PhreshPhish sample leaves 124 rows (91 positives, 33 references): installed recall 61.54% and FPR 0/33; character recall 81.32% and FPR 6/33 (18.18%). The candidate's historical gain does not transfer at the intended low-FPR operating point, so it remains research-only. Zero observed false positives has considerable uncertainty: the installed all-reference FPR upper descriptive binomial 95% bound is 3.70%.

## Prospective aligned hybrid and provider pilot

The [aligned experiment](evidence/aligned-evaluation.json) uses 100 recent PhishTank community-verified/online positive labels and all 100 prespecified official references. Labels are not produced by Google/OpenPhish feature outputs, although unknown shared upstream reports can limit independence. Actual static HTML, DNS/RDAP and provider observations were acquired over seven minutes, with every failed observation retained. Only 64 domain and 41 content requests completed. Host DNS failures were observed near completion; specific worker failure causes were not retained. The dataset/source/candidate hashes and missingness are recorded.

One source-clock preprocessing amendment was made after acquisition integrity checks and before scoring: raw JSONL and source timestamps remain unchanged, derived assessment time is a bounded source-clock watermark, and chronology uses original host completion. Eighteen content timestamps were ahead by at most 27.576 ms. Skew over one second rejects the entire cohort; provider TTL is never extended. Raw/derived hashes and affected counts are public evidence metadata.

Each of four cumulative feature stages fits the same three prespecified calibrated baseline algorithms on identical 120/40/40 partitions. Every model/threshold choice for both protocols is locked before any holdout prediction. The primary group holdout contains 22 references and 18 positives:

| Features                              | Validation-selected model | Holdout precision | Recall | Reference FPR |
| ------------------------------------- | ------------------------- | ----------------- | ------ | ------------- |
| URL                                   | Random forest             | 94.74%            | 100%   | 4.55% (1/22)  |
| URL + domain                          | Random forest             | 94.74%            | 100%   | 4.55% (1/22)  |
| URL + domain + content                | Random forest             | 94.74%            | 100%   | 4.55% (1/22)  |
| Full hybrid, including threat reports | Random forest             | 94.74%            | 100%   | 4.55% (1/22)  |

All four selected stages make identical predictions; no incremental hybrid benefit is established, and the 2% validation budget fails to transfer. Only 9/40 domain and 6/40 content observations are available in this holdout. With such small validation denominators, the budget forces zero empirical false positives rather than proving a 2% population rate.

The separate single-session chronological sensitivity holdout has 17 references and 23 positives. Lexical recall/FPR is 86.96%/5.88%; domain 82.61%/0%; content 86.96%/0%; full hybrid 78.26%/0%. Adding threat features reduces recall in this measured sensitivity comparison. Its holdout has no completed domain/content observations; this short within-session ordering cannot establish long-term temporal robustness. No later threshold or model is chosen from these test outcomes.

Provider-only baselines use the same cohort and preserve unavailable checks as abstentions. Across all 200 rows, Google completes 198 checks and detects 27/100 positives; OpenPhish completes 200 and detects 1/100; either provider detects 28/100. None reports a reference positive. The primary group-holdout provider recalls are 1/18, 1/18 and 2/18 respectively. The JSON also reports covered-only and all-row no-alert summaries; an unavailable/no-alert observation is not a safety finding.

This is a convenience pilot with conspicuous source shortcuts: famous HTTPS homepages are negatives while arbitrary feed paths are positives. URL/path length, age, popularity, acquisition source and missingness can dominate. Official identity is not a current compromise audit, community labels are not independent current-page adjudication, and historical-domain exclusion leaves only 33 external references. Neither aggregate scores nor this pilot establish broad business-fraud accuracy. Historical threat snapshots remain missing from the archived corpora; the prospective study is a new contemporary experiment. Reproduce with the [documented protocol](RESEARCH_REPRODUCTION.md), preserving the original caches before collecting a new time-varying cohort.

## Legacy phishing comparison

The earlier undated PhiUSIIL group holdout measured 95.31% phishing F1 and 2.10% false positives. Its all-www legitimate collection convention and path distribution produced severe false positives on normal inputs. The old production model was replaced. Legacy [metrics](evidence/benchmark-evaluation.json) are retained for reproducibility and diagnosis, not combined with the newer results as though the test populations were interchangeable.

## Validity and reproduction

Published labels were not re-reviewed locally. Registrable domains cannot eliminate unknown cross-domain campaigns/shared templates. Calibration, model selection and threshold selection share validation. Historical sampling and class prevalence differ from live traffic. No URL-only score verifies a business or a financial outcome. Batch inference timing excludes Python startup, queue/database and external calls.

Run `make phreshphish-import phreshphish-train promote` after installing `ml/research-requirements.txt`. Import archived fraud data with `.venv/bin/python ml/scamferret.py --download-tree`, then `.venv/bin/python ml/scam_evaluation.py`. Synthetic `make ml-smoke` proves plumbing only and cannot be promoted. Original fully aligned historical hybrid studies still require appropriate dated threat-provider observations; none are fabricated.
