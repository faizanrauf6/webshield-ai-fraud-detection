# Final completion verification — 12 October 2026

Scope: the final research, operational and academic handoff additions to the controlled FYP. Earlier UI/Docker/provider evidence remains valid for unchanged production code; this run adds the actual prospective evaluation and a complete submission package.

## Executed checks

| Check                                                          | Result                                                                               |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Isolated PostgreSQL 16 / Redis 7 application/integration suite | 86 passed, including all eight database/queue cases                                  |
| Full Python ML suite                                           | 62 passed in 6.632 seconds                                                           |
| Scanner suite                                                  | Nine passed; loopback socket permission required                                     |
| Production frontend desktop/mobile suite                       | 20 passed, zero skipped/unexpected/flaky                                             |
| ESLint, Prettier, TypeScript/Next route types                  | Passed                                                                               |
| Production application build                                   | Passed                                                                               |
| Git whitespace check                                           | Passed                                                                               |
| Credential-content scan                                        | Both configured private values checked against tracked/unignored files; zero matches |

The first scanner invocation was blocked by sandbox loopback-socket restrictions; the identical suite passed with local socket access. This was an execution-permission issue, not a scanner assertion failure. Browser/performance measurements and the final Redis cleanup regression are detailed in [operational evidence](operational-verification.md); no broader load or end-user acceptance claim is made.

## Research and integrity

The complete four-stage prospective pilot and provider baselines ran on the same 200 frozen rows, with group and short-session chronological protocols. All 24 trained model artifacts and all stage/protocol selections were locked before holdout scoring. The fixed-model external comparison did not fit, recalibrate or alter thresholds. The [independent review](final-research-review.md) verified every artifact/source/implementation hash, partition identity, raw/derived dataset hash and reported count. Raw target URLs/content and binaries stay in ignored local directories; aggregate public evidence contains no raw candidate URLs.

The first scoring attempt correctly refused scanner timestamps slightly ahead of host assessment. A documented pre-scoring clock-watermark amendment preserves immutable raw data and source timestamps, bounds clock skew to one second, retains host completion for chronology, and reassesses provider expiry without extending TTL. Ten aligned integrity tests include label tampering, source matching, timestamp validation, unchanged raw data, expiry, cohort rejection and durable all-stage/all-protocol locking.

Measured conclusions are negative where appropriate: no primary-holdout hybrid gain, 4.55% reference FPR on that small holdout, and 12% external character-candidate FPR (18.18% on unseen references). The experimental candidate was not promoted. Host public-DNS failures were observed near collection completion, but worker-specific failure causes were not retained; all 200 rows remain with only 64 domain/41 content observations available. Source/identity labels and famous homepage controls cannot establish general fraud accuracy.

## Submission and deployment boundary

Final report/manual have editable DOCX, PDF and offline HTML exports; Markdown sources, diagrams and actual light/dark/mobile captures are included. [Document validation](../submission/document-validation.json) and the [manifest](../submission/submission-manifest.json) verify source/output/asset/evidence hashes, structural readability, local links, embedded images and clearly labelled sample identities. Original proposal files remain unchanged. Independent academic/user signatures are intentionally absent.

The existing enabled Docker app remains running at ports 3000/4000 with the installed lexical-v2 phishing bundle and private Google/scanner configuration. No experimental model, raw dataset or secret is included in the Git changes. DNS recovery restored the existing faizanrauf6 GitHub authorization; reauthentication was unnecessary. Broader representative adjudication, historical threat data and sustained operational studies remain scientific/deployment limits.
