# Model card

## Installed production bundle

Selected estimator: sigmoid-calibrated Histogram Gradient Boosting, 100 iterations, random seed 42, automatic early-stopping holdout disabled. Version `lexical-v1-hist_gradient_boosting-3ea803fc85c0`; threshold `0.3134917009376682`; scope **phishing**. The bundle is installed in `ml/production/`, enabled using `ENABLE_ML=true`. Missing runtime/artifacts/schema or inference failures return unavailable evidence.

Logistic regression and random forest are measured comparison baselines. Each estimator fits training data only; the frozen estimator is sigmoid-calibrated on validation data. Thresholds maximize validation recall under a 2% validation false-positive constraint. Model selection then uses validation recall, F1, false-positive rate and Brier score. Calibration and threshold selection share the validation partition; validation performance can be optimistic. Final holdout data is excluded from selection.

## Features and experiment

The 12 `lexical-v1` features are URL/hostname length, path depth, dot/hyphen counts, hostname digit ratio, query length, punycode flag, IP-literal flag, encoded-character count, HTTPS scheme and hostname entropy. Python uses the exact shared TypeScript extraction contract in bounded batches. No precomputed UCI content/similarity columns are used.

PhiUSIIL contributes 234,661 canonical examples: 142,492 training, 46,580 validation and 45,589 holdout. Connected registrable-domain/campaign components are disjoint. Observation dates are absent, so this is group-disjoint evaluation. See [provenance](evidence/benchmark-provenance.json) and [complete metrics](evidence/benchmark-evaluation.json).

Selected holdout phishing precision 96.79%, recall 93.87%, F1 95.31%; false-positive rate 2.10%; Brier score 0.02924. The holdout false-positive rate exceeds the validation constraint slightly; 2% is not a guaranteed operational ceiling.

## Intended use and limitations

Use for reproducible FYP phishing research and evidence-assisted review. It does not validate store honesty, investment returns, withdrawals, wallet interactions or business legitimacy. Historical source distributions and class prevalence differ from live traffic; calibrated benchmark probabilities can be poorly calibrated elsewhere. A live test on `https://example.com/` returned approximately 99.996% phishing, a false positive. Do not reinterpret this output as proof of fraud.

Warnings remain visible even for low model estimates. Model output never sets a verified-provider verdict. Demos stay synthetic and never invoke production inference. Low estimates cannot establish safety. Missing observations remain explicit.

Additional schemas `url-domain-v1`, `url-content-v1`, and `hybrid-v1` are implemented, but no real hybrid model is installed. Historical snapshot experiments and temporal validation remain pending.

## Artifact trust

Promotion requires a non-synthetic documented experiment, validation selection and matching frozen holdout evaluation. The selected artifact is published under a checksum filename before the manifest is atomically replaced. Inference validates the schema, class order, probability bounds and checksum before joblib deserialization. Runtime is Python 3.14 / scikit-learn 1.9.1 / joblib 1.6.0.

Joblib can execute code. Checksums detect alteration; they do not authenticate a hostile replacement of both artifact and manifest. Only load owner-controlled locally trained files. The Python subprocess has a ten-second deadline; cold library startup can return unavailable until a later scan.
