# Dataset card

## Current phishing experiment: PhreshPhish

[PhreshPhish](https://huggingface.co/datasets/phreshphish/phreshphish), [primary paper](https://arxiv.org/abs/2507.10854), CC BY 4.0. Pinned revision `eabec4b7a66324b79cc8a0ad856d1731dc26fe1a`. Research importer retrieves URL, label, date and source hash columns using HTTP range requests across all 77 Parquet shards; no HTML column or listed target website is fetched.

666,315 source metadata rows are sampled by the lowest SHA-256(`webshield-v2:` + original URL), independently of label, retaining 150,000 before policy/deduplication. 148,352 valid canonical examples remain: 81,512 benign and 66,840 phishing. Exclusions: 1,627 unsupported URLs and 21 canonical duplicate rows, zero conflicting URLs. Labels are published `benign`/`phish`, converted to 0/1; not independently adjudicated by this project.

Published observation dates have day precision. Exact collection times are not invented. Custom temporal evaluation uses validation from 2025-07-01 and test from 2025-09-09, with connected domain/campaign overlap purged from earlier windows. This deliberately differs from the authors' published split. Domain grouping is a proxy because campaign IDs are unavailable. Dataset/date/class drift and benchmark prevalence limit live-site generalization.

[Provenance](evidence/phreshphish-provenance.json) records every cached source metadata hash, pinned revision, sample rule, exclusions and prepared CSV hash. Raw data, URL error lists and model binaries are excluded from Git and container build context.

## Archived fraud research: ScamFerret

[ScamFerret DIMVA 2025 artifact](https://github.com/ScamFerret/artifact), Nakano, Koide and Chiba, [primary paper](https://arxiv.org/abs/2502.10110). GPL-3.0 artifact pinned to `8cf8dc631edafe584141e2f95f0c0f51855fb7bc`. Only English shopping, investment and cryptocurrency categories are used. Labels come from the authors' published legitimate/scam cohorts and are not inferred from model output, URL spelling or provider absence.

The importer downloads archived gzip HTML and recorded tool traces from the pinned repository, validates Git blob hashes, bounds compressed and expanded bytes, and uses the production static parser offline. Archived scripts never execute; listed websites are not visited. Only WHOIS creation/database-reference dates are considered from tool observations; model thoughts, answers and search classifications are excluded from features. Unsupported dates remain missing. WHOIS is not mislabeled RDAP.

Original capture dates are unknown. Content timestamps carry an explicit artifact-publication upper-bound meaning, never first-seen/capture time. `first_seen_at` remains blank and splits are domain-grouped. Redirects/DNS/final destinations and historical threat observations are unavailable. Research artifacts preserve those limitations and are separate from the production phishing model. [Fraud provenance](evidence/scamferret-provenance.json) and [ablations](evidence/scamferret-ablations.json) record actual coverage, exclusions, splits and measurements.

Manual adjudication used web content/screenshots/searches, so content features overlap the evidence basis for labels. The labels establish published expert classifications, not independently verified financial outcomes. Small single-source category holdouts cannot establish current arbitrary-site accuracy.

## Legacy benchmark: PhiUSIIL

[UCI PhiUSIIL](https://archive.ics.uci.edu/dataset/967/phiusiil+phishing+url+dataset), Prasad and Chandra (2024), CC BY 4.0, doi:10.1016/j.cose.2023.103545. 235,795 source rows yielded 234,661 records (134,849 legitimate / 99,812 phishing), excluding 33 unsupported URLs, 1,100 duplicates and one conflicting canonical URL. Original 1=legitimate/0=phishing labels were inverted. Dates are absent, so its experiment is group-disjoint only.

Every legitimate source URL begins with `www.`, a harmful collection shortcut; the installed v1 model also overflagged benign paths. Its high historical score did not transfer to normal live inputs. The production model was replaced with lexical-v2 trained on PhreshPhish. Legacy [provenance](evidence/benchmark-provenance.json) and [metrics](evidence/benchmark-evaluation.json) remain as an audit trail, not the current model's performance.

## Additional datasets

CSV requires `url,label,first_seen_at,source,campaign_or_domain_group`. Labels must be independently justified; negative feed lookup or popularity is not ground-truth legitimacy. Dated temporal runs require real observation dates and purge overlapping connected domain/campaign groups from earlier windows. Undated data must use the explicit group protocol.

Hybrid JSONL adds `observations` with historical `domain`, `content`, `providers` and historical assessment time `asOf`. Nonmissing observations must be at or before `asOf`; for dated rows, `asOf` cannot postdate the labeled observation. Empty groups cannot establish an ablation result. Record collection timestamps, license, label basis, missingness and label/feature independence. Threat findings used to produce labels must not also become predictive features for the same comparison. See `ml/ablations.py` and the shared observation schemas.

Collect separate reviewed deceptive-store and investment cohorts before making broader claims. Preserve uncertainty and reviewer disagreement. Include hard negatives such as legitimate login pages, international domains, new stores and lawful cryptocurrency services. Never visit suspicious URLs outside the isolated collection boundary.

## Synthetic fixtures

The 240-row generator validates training/calibration/evaluation tooling only. Synthetic experiments are marked in their manifests, excluded from production promotion and never represented as measured real-world accuracy.
