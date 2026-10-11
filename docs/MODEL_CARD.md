# Model card

## Installed production bundle

Sigmoid-calibrated Histogram Gradient Boosting, 100 iterations, seed 42, automatic early-stopping holdout disabled. Version `lexical-v2-hist_gradient_boosting-a62d69962e84`; warning threshold `0.768571778610234`; scope **phishing**. Trusted local bundle `ml/production/`, enabled with `ENABLE_ML=true`.

The three baselines fit training data only. A frozen estimator is sigmoid-calibrated on validation, and its threshold maximizes recall under a 2% validation false-positive constraint. Model selection uses validation recall/F1/FPR/Brier; the holdout is untouched until scoring. Calibration and selection share validation, so validation estimates can be optimistic.

## Features and temporal experiment

The 12 lexical-v2 features describe URL/hostname length, depth, dots/hyphens, hostname digit ratio, query length, punycode, IP literals, encoded characters, HTTPS and hostname entropy. A leading `www.` is removed **only from numeric feature inputs**, eliminating the documented PhiUSIIL sampling shortcut. Submitted URLs, scanner targets, provider matching and domain grouping retain exact hostnames. v1 remains available for reading legacy artifacts.

PhreshPhish metadata sample: 148,352 retained records. Validation begins 2025-07-01; test begins 2025-09-09. Connected domain/campaign components crossing windows are removed from earlier windows: 51,462 train, 17,158 validation, 36,910 test, 42,822 purged. Day-precision source dates are ordered using UTC midnight; exact capture times are unknown. This is a custom temporal split, not reproduction of the authors' original experiment.

Selected holdout: precision **96.84%**, recall **58.41%**, F1 **72.87%**, false-positive rate **1.64%**, Brier **0.11689**; confusion matrix `[[19531,325],[7093,9961]]`. See [complete metrics](evidence/phreshphish-evaluation.json) and [provenance](evidence/phreshphish-provenance.json).

## Regression correction and limits

The old PhiUSIIL v1 model learned the dataset's convention that all legitimate URLs begin with `www.` and falsely flagged example.com near 100%. Normalizing that prefix alone still overflagged benign paths. The replacement uses a newer dataset with varied legitimate paths and dated evaluation. [Development checks](evidence/model-development-checks.json) verify identical www/bare predictions and below-threshold estimates for known benign cases without adding allowlists. Those cases are development regressions, not accuracy evidence. `example.com` estimates 36.54%, below the selected 76.86% warning threshold; this does not mean a 36.54% real-world chance of fraud.

Historical source distributions, class prevalence and calibration can differ from live traffic. The low-FPR operating point misses many phishing examples. The model does not establish store honesty, investment outcomes, withdrawals, wallet safety or business legitimacy. Independent current threat reports and observed warnings remain separate, and low model estimates do not suppress material warnings.

The separate ScamFerret research compares URL/domain/content signals for published store/investment/crypto labels. Those artifacts are research-only, are not installed as phishing models, and lack aligned historical threat-provider observations.

## Additional frozen research candidates

The [quality study](evidence/model-quality-study.json) adds prespecified character TF-IDF plus numeric lexical logistic candidates on the exact same PhreshPhish partitions. Validation selects C=1 before holdout scoring. The reused 36,910-record holdout measures precision 97.53%, recall 83.53%, FPR 1.82%; paired connected-domain bootstrap recall gain is +25.12 percentage points (95% interval +23.58 to +26.86). Its binomial FPR interval is 1.64–2.01%, crossing the intended 2% target, and legitimate HTTP FPR is 49.18% (60/122). A large train/validation gap and source drift remain. This is descriptive reuse of an already inspected holdout, not new independent confirmation or production approval.

Archived missingness-aware shallow-forest research reduces descriptive FPR from 8.47% to 4.24% while reducing recall from 90.63% to 77.08%. Legitimate cryptocurrency FPR is still 8.11% (3/37). Capacity and missingness handling change together, so the outcome cannot be attributed causally to either alone. Neither candidate is promoted; the installed bundle and threshold above remain unchanged.

Candidates use uncalibrated scores and a different input/artifact representation; Brier scores cannot be presented as a fair calibration improvement over the calibrated baseline. All global and sensitivity operating points are persisted from validation before scoring, and none may be selected afterward from test results. The [prospective reproduction protocol](RESEARCH_REPRODUCTION.md) keeps new-cohort model parameters frozen and reports population/label limitations explicitly.

The [new-source frozen-model comparison](evidence/external-model-validation.json) provides a concrete reason to reject promotion: on 100 PhishTank positives and 100 official references, character-candidate recall is 81% versus installed-model 62%, but its FPR rises to 12% (12/100) versus 0/100. After excluding all 76 rows sharing historical sample domains, the candidate still falsely flags 6/33 references (18.18%). The pilot's identity labels, root-page sampling and small denominators limit generalization; 0/100 installed-model false positives is compatible with a binomial upper 95% bound of 3.70%, not a zero operational FPR.

## Artifact trust

Promotion requires real documented data, validation selection, matching frozen holdout evaluation and development regressions. Checksummed filenames are published before atomic manifest replacement. Inference checks schema, class order and probability bounds before trusted-local joblib loading. Joblib can execute code; hashes detect alteration but cannot authenticate simultaneous hostile replacement of model and manifest. Load only owner-controlled artifacts. Python inference is bounded to 30 seconds; missing or timed-out inference stays unavailable.
