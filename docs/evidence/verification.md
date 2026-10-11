# Verification evidence — 12 October 2026

Verified in the supplied workspace, without an existing Git repository. No commits or external deployment were performed. The supplied original proposal PDF remains unchanged.

| Check                                               | Observed result                                         | Boundary established                                                                                                                                                           |
| --------------------------------------------------- | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `npm run test:integration`                          | 85 passed across 11 files; no skipped integration cases | Core/API tests plus actual migrations, persistence, queue processing, failure behavior, history and export                                                                     |
| Python ML unittest discovery                        | 26 passed                                               | Shared features, split/leakage policy, validation selection, bundle checks, promotion rejection, historical snapshot guards                                                    |
| `make test-scanner`                                 | 9 passed                                                | DNS/public-peer policy, redirect/size boundaries, bounded local socket fixtures, form/base extraction                                                                          |
| `npm run lint`                                      | Passed                                                  | ESLint, Prettier, TypeScript and Next route types                                                                                                                              |
| `npm run build`                                     | Passed                                                  | Core/API compilation and production Next.js build                                                                                                                              |
| Full Playwright suite                               | 14 passed                                               | Desktop/mobile submission, history, export, unsafe-input errors, synthetic scenarios, missing/installed-model display, provider attribution, accessibility and viewport checks |
| Installed model HTTP workflow                       | Passed                                                  | Real Python inference, queued scan persistence, history, export equality and repeat submission; see installed-model-workflow.json                                              |
| Four-stage ablation smoke                           | Passed; all outputs explicitly synthetic                | Lexical/domain/content/threat stages execute with usable historical fixtures and shared partitions; no real hybrid accuracy claim                                              |
| Live OpenPhish lookup                               | Completed negative lookup for example.com               | Fixed feed endpoint reachable and adapter parses response; no listed target was visited                                                                                        |
| Compose configuration                               | Passed                                                  | Configuration resolves with model/provider settings                                                                                                                            |
| Docker application build / isolation / live scanner | Not run                                                 | Docker socket absent; no Docker engine available                                                                                                                               |
| Live Google lookup                                  | Not run                                                 | No API key supplied                                                                                                                                                            |

## Runtime and test isolation

Node 24.14.0, Python 3.14.3, scikit-learn 1.9.1. Persistence/browser acceptance used temporary loopback PostgreSQL 17.9 (pgembed) and Redis 8.6.1 because Docker was unavailable. CI retains PostgreSQL 16 and Redis 7; local results do not substitute for a completed run on those exact container versions.

Tests use a separate `_test` database and Redis DB 1. A repeat regression run initially shared the model-demo API queue and received that process's model-backed result; after stopping the demo API, the isolated suite passed all 85 cases. Tests must not share a queue with another worker. Temporary test processes were stopped after verification.

The browser suite ran with ML disabled for baseline behavior; the installed-model rendering case uses explicit intercepted API fixtures. The real enabled-model HTTP workflow was checked separately against the actual trained bundle. Its JSON records the approximate 3.38-second combined two-scan/history/export workflow, not a single-scan latency claim. First-time numerical library import exceeded inference's ten-second deadline; after initial startup, a direct prediction completed in approximately 1.8 seconds. Timeouts remain unavailable evidence.

## Research evidence and limits

Public PhiUSIIL labels support only historical phishing evaluation. The selected threshold/model were fixed on validation before holdout reporting. The 45,589-row holdout measured 95.31% phishing F1 and 2.10% false positives. The installed model falsely flags example.com; its score is never shown as verified fraud. No temporal, broader store/investment or real hybrid claim is established.

Aggregate benchmark metrics and provenance are saved beside this document. Raw data, model binaries and error URLs remain local. Production promotion rejects synthetic experiments. Review reproduced three edge cases; timestamp/target validation, nonempty hybrid groups and default form-action handling were corrected with red/green regression tests. Independent re-review confirmed the fixes and found no additional material issue.

## Remaining acceptance prerequisites

Run `docker compose --profile analysis up -d --build --wait` with a random worker token, then `make test-isolation` and authorized live public content/domain scans. Verify enabled Google lookup using an owner-supplied key. CI now includes scanner unit tests and an application-container/isolation job; configuration of that job is not a claim it ran successfully.

Complete research requires reviewed dated fraud cohorts and historical observation snapshots for aligned hybrid/reputation ablations. The selected benchmark cannot supply them. Institution/student cover details must be supplied by the student; no identity information was invented.
