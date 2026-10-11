# Dataset card

## Evaluated public benchmark

Source: [PhiUSIIL, UCI Machine Learning Repository](https://archive.ics.uci.edu/dataset/967/phiusiil+phishing+url+dataset), Arvind Prasad and Shalini Chandra (2024), CC BY 4.0. Research citation: doi:10.1016/j.cose.2023.103545. The user authorized this public phishing benchmark. Published labels were used; this project did not independently re-review every website.

235,795 source rows yielded 234,661 canonical records: 134,849 legitimate and 99,812 phishing. Import excluded 33 unsupported URLs, 1,100 duplicate rows and the retained entry for one conflicting canonical URL. UCI uses `1=legitimate, 0=phishing`; import maps to `0=legitimate, 1=phishing`. No listed website was visited. Only URL strings and labels were imported; existing UCI content/similarity columns were not reused.

[Machine-readable provenance](evidence/benchmark-provenance.json) records download URL, archive/prepared hashes, import time, source attribution and exclusions. Raw URLs, error lists and model binaries stay outside version control. Aggregate metrics and provenance are retained under `docs/evidence/`.

## Dates, grouping and limits

Per-record observation dates and campaign IDs are unavailable. Publication/import time is not first-seen time. Blank observation dates are allowed only for explicit grouped evaluation. Registrable-domain components are disjoint across deterministic seed-42 partitions; unknown cross-domain campaign overlap may remain. The holdout is frozen and checksum verified before evaluation.

This historical phishing benchmark cannot establish investment-fraud or deceptive-store performance, temporal robustness or real hybrid improvements. Do not collect today's content and describe it as the benchmark's historical content.

## Additional datasets

CSV requires `url,label,first_seen_at,source,campaign_or_domain_group`. Labels must be independently justified; negative feed lookup or popularity is not ground-truth legitimacy. Dated temporal runs require real observation dates and purge overlapping connected domain/campaign groups from earlier windows. Undated data must use the explicit group protocol.

Hybrid JSONL adds `observations` with historical `domain`, `content`, `providers` and historical assessment time `asOf`. Nonmissing observations must be at or before `asOf`; for dated rows, `asOf` cannot postdate the labeled observation. Empty groups cannot establish an ablation result. Record collection timestamps, license, label basis, missingness and label/feature independence. Threat findings used to produce labels must not also become predictive features for the same comparison. See `ml/ablations.py` and the shared observation schemas.

Collect separate reviewed deceptive-store and investment cohorts before making broader claims. Preserve uncertainty and reviewer disagreement. Include hard negatives such as legitimate login pages, international domains, new stores and lawful cryptocurrency services. Never visit suspicious URLs outside the isolated collection boundary.

## Synthetic fixtures

The 240-row generator validates training/calibration/evaluation tooling only. Synthetic experiments are marked in their manifests, excluded from production promotion and never represented as measured real-world accuracy.
