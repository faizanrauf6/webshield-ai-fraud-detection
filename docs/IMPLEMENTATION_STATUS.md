# Implementation status — 12 October 2026

The pending software work from the original [review](PROJECT_REVIEW.md) has been implemented sequentially. The original review records the state before these changes. The [completion ledger](COMPLETION_PROGRESS.md) records execution; [verification evidence](evidence/verification.md) records the acceptance checks.

| Proposal requirement                        | Current implementation                                                                | Remaining acceptance / research work                                     |
| ------------------------------------------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| FR-01–03 submission, URL policy, processing | Persistent queued scans, parsing, retries and recovery                                | Application integration and browser checks passed                        |
| FR-04 ML classification                     | Real selected phishing bundle, bounded inference, probabilities, calibrated threshold | Temporal and broader fraud external validity                             |
| FR-05 threat intelligence                   | OpenPhish and optional Google; per-source provenance and expiry                       | Google live test requires key                                            |
| FR-06 content                               | Isolated static HTML, forms, redirects, storefront/claim indicators                   | Container isolation and live collection acceptance require Docker engine |
| FR-07 crypto indicators                     | Address checksums, claim patterns, static evidence                                    | Independently labeled investment/crypto fraud evaluation                 |
| FR-08 assessment                            | Model estimate, warning aggregation, independent current provider authority           | No universal safety or business-legitimacy claim                         |
| FR-09 history/export                        | Persisted reports, pagination, repeat submissions, JSON export                        | Verified with actual database/queue and browser flows                    |
| FR-10 safety/configuration                  | Local defaults, validated worker config, firewall probe and CI job                    | Run container acceptance before enabling collection                      |

## Delivered changes

- Real UCI dataset import/provenance, label conversion, canonical deduplication, domain-group splits, three calibrated baselines, validation-only model/threshold selection and frozen holdout reporting.
- Trusted-local promotion and checksum/schema validation, bounded Python inference, versioned report metadata and actual research metrics in the UI.
- Four cumulative lexical/domain/content/threat schemas, explicit missingness and historical-snapshot ablation tooling. All four stages executed on synthetic smoke data only.
- Broader form/redirect/storefront/investment warnings, accurate summaries, associated HTML form/base extraction, per-provider exported observations and expiry fallback.
- Docker Python runtime, provider/model environment wiring, scanner unit checks and isolation CI job.
- Corrected requirements, deployment, model/dataset cards and FYP handoff documents.

## Is it fully developed?

**No, against the full proposal.** The software and evaluated lexical phishing path are substantially complete and tested. The original hybrid improvement hypothesis still requires independently reviewed historical domain/content/provider snapshots, dated temporal data and labeled deceptive-store/investment examples. The chosen public phishing benchmark cannot supply that evidence. Container-level and live collection acceptance also remains pending until Docker is available; Google live acceptance requires credentials.

Accounts, on-chain tracing, wallet operations, screenshot classification and browser extensions are outside the agreed controlled FYP scope.
