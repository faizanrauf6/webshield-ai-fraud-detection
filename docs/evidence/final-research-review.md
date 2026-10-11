# Final research review

Reviewed on 12 October 2026 PKT. The scoped code and aggregate evidence support the reported negative research conclusions. No outstanding critical or important issue was identified in this review. This is a developer research review, not independent label adjudication, a production approval or academic sign-off.

The review covered `ml/aligned_evaluation.py`, `ml/external_validation.py`, `ml/quality_study.py`, the aligned collector and reference definitions, focused tests, aggregate evidence, and the corresponding final-report/model-card claims. Two earlier defects were corrected and rechecked: the OpenPhish source-name mismatch and incomplete enforcement of frozen candidate labels and metadata.

## Verified integrity

- Independently checked all 200 frozen candidates, with 100 positive and 100 reference labels. Candidate membership, labels, sources, groups and label timestamps match the frozen list.
- Recomputed clock normalization without changing the raw rows. Both reports and the selection lock agree on 18 affected content observations and a maximum source-clock lead of 27.576 ms. Original source timestamps and host completion times remain intact; chronological partitions use host completion. The one-second rejection bound and preprocessing amendment are explicit.
- Raw dataset SHA-256: `6d9f31cdfc52830ead270ab55b606698d0ef80c897a3e3a96c65507e26a7b2e9`. Derived-row SHA-256: `dd5f208a6f967b0173f7722c05c82c02a3372365ac4775140e2165bc0defc635`. Both were independently recomputed and agree across aligned and external evidence.
- Checked implementation hashes for all three evaluators, the shared alignment implementation, selection/plan locks, all 24 aligned model artifacts, the external candidate, production manifest and historical source. Reconstructed partition identities agree with recorded hashes; all stages reuse the same partitions and locked selections.
- Reviewed the collection boundary: target observations use the existing authenticated isolated worker; provider requests use the configured existing integrations. Aggregate aligned/external JSON contains no raw candidate URL. Raw target data and model binaries remain ignored local artifacts.

## Verified results

Observed domain/content coverage is 64/200 and 41/200. Every candidate remains in evaluation despite missing observations. Google completed 198 lookups and alerted on 27 positives; OpenPhish completed 200 and alerted on one; either provider alerted on 28. None alerted on a reference.

All four selected group-holdout stages have confusion matrix `[[21,1],[0,18]]`: 100% recall and 4.55% reference FPR. This supplies no incremental operating-point gain from domain, content or threat features. Within-session lexical recall is 20/23 = 86.96%; hybrid recall is 18/23 = 78.26%. These are different selected operating points on a short, source-confounded pilot.

At unchanged frozen thresholds, the external character candidate detects 81/100 positives and falsely alerts on 12/100 references; production detects 62/100 with 0/100 reference alerts. Removing 76 rows with historical-domain overlap leaves 124 rows: candidate recall 74/91 and reference FPR 6/33 = 18.18%, versus production recall 56/91 and 0/33 reference alerts. The evidence supports retaining production and rejecting candidate promotion.

The final report and model card preserve the limits of famous HTTPS homepage references, arbitrary positive paths, community/identity labels, unequal observation availability, possible shared feed intelligence and small denominators. Historical holdout reuse is descriptive; this pilot does not establish long-term robustness or general store/investment fraud accuracy. Zero observed errors are not presented as zero operational risk.

## Verification performed

`.venv/bin/python -m pytest ml/test_aligned_evaluation.py ml/test_quality_study.py -q` passed **19 tests and 5 subtests**. Additional read-only checks recomputed hashes, normalization, offline feature/partition identities, artifact identities and aggregate counts. This review did not recollect targets, run scanner requests, retrain models, adjust thresholds or promote a model.
