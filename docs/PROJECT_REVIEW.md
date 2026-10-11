# WebShield AI code and proposal review

> Historical review before implementation. See [current implementation status](IMPLEMENTATION_STATUS.md) and [verification evidence](evidence/verification.md) for the subsequent fixes and measured results.

Reviewed on 12 October 2026 against the seven-page `WebShield_AI_FYP_Proposal.pdf` supplied by the user.

**Verdict: WebShield AI is not fully developed against its proposal.** It has substantial application infrastructure, tested URL analysis, optional detection integrations, and a functioning offline ML research pipeline. The central requirement of an evaluated ML model integrated into website scans is still pending. It should currently be described as a website-risk analysis prototype with rule-based screening and ML experimentation tooling.

The proposal is the assessment baseline. Its descriptions of future functionality are requirements to compare with the code, rather than evidence that those features already work. Existing repository documentation describes an earlier, narrower implementation in several places.

## Verification results

| Check                             | Result                                 | What it establishes                                                                                                                             |
| --------------------------------- | -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm test`                        | 66 passed; 8 integration tests skipped | URL policy, feature extraction, crypto checks, content rules, provider adapters, orchestration, recovery, and mocked persistence/queue behavior |
| `npm run lint`                    | Passed                                 | ESLint, Prettier, TypeScript checks, and Next.js route type generation                                                                          |
| `npm run build`                   | Passed                                 | Core checks, API compilation, and production frontend build                                                                                     |
| Python ML unit tests              | 9 passed                               | Feature parity, dataset validation, canonical deduplication, and domain/campaign separation                                                     |
| Python analysis-worker unit tests | 7 passed                               | URL/DNS/peer checks, redirect rejection, response-size bounds, and HTML extraction; local socket tests required execution outside the sandbox   |
| Selected Playwright checks        | 4 passed across desktop and mobile     | Core-page accessibility/viewport checks with the API unavailable, plus report rendering and attribution using intercepted API responses         |
| ML smoke experiment               | Passed for all three models            | Training, calibration, artifact generation, and evaluation on 240 synthetic rows, partitioned 80/80/80                                          |
| Docker Compose configuration      | Passed syntax/configuration validation | Compose configuration can be resolved; containers were not started                                                                              |
| Database and queue integration    | Blocked                                | PostgreSQL connection was refused at `127.0.0.1:55432`; Docker daemon was unavailable                                                           |

Synthetic ML scores establish that the experiment pipeline runs. They do not establish real-world fraud-detection accuracy. No real labeled dataset or installed production model was present in the reviewed project. Full submission-to-report browser verification, live provider connectivity, live DNS/RDAP/content scans, and container firewall isolation require additional runtime validation.

## What is implemented

**URL submission and analysis.** The shared URL policy rejects private/reserved IPs, ambiguous numeric address forms, credentials, unsupported schemes, internal hostname patterns, unsafe ports, control characters, and oversized inputs. It normalizes URLs and extracts 12 versioned lexical features. Unit tests verify representative accepted and rejected inputs. See [policy](../packages/core/src/policy.ts), [features](../packages/core/src/features.ts), and [core tests](../packages/core/tests/core.test.ts).

**Backend scan workflow.** NestJS endpoints support submission, polling, history, report retrieval, JSON export, health, model status, and provider configuration. TypeORM entities and migrations support PostgreSQL persistence. BullMQ code supports background processing, three execution attempts, failure recording, and startup recovery. Mocked boundary tests pass; actual PostgreSQL/Redis behavior remains unverified in this review. See [scan service](../apps/api/src/service.ts), [controller](../apps/api/src/controller.ts), and [recovery](../apps/api/src/recovery.ts).

**Frontend.** Dashboard, scan reports, history, research, settings, loading/error states, polling, scan resubmission, and export controls are implemented. History search applies to loaded rows and discloses that limitation. Settings display server configuration and do not change it. The production build succeeds. See [components](../apps/web/components) and [API client](../apps/web/lib/api.ts).

**Optional domain and content integrations.** A separate Python worker implements public DNS resolution, authoritative RDAP lookup through IANA bootstrap, domain age, bounded static HTML extraction, forms, links, iframe counts, and redirect collection. The API validates worker responses and records unavailable observations. These features are disabled by default and need the analysis Docker profile, a worker token, and the corresponding flags. The worker includes pinned socket connections, peer verification, redirect validation, time/size limits, and firewall setup. The container-level isolation probe exists but was not run because Docker was unavailable. See [scanner](../services/analysis-worker/scanner.py), [worker entrypoint](../services/analysis-worker/entrypoint.py), and [observation adapter](../apps/api/src/observations.ts).

**Threat intelligence.** Google Safe Browsing and OpenPhish adapters implement bounded requests, parsing, availability handling, and exact-URL matches. OpenPhish caches a limited feed for 12 hours. The report serializer falls back from expired positive provider evidence to independent screening evidence. Adapter tests use controlled responses; live service success has not been demonstrated here. See [Safe Browsing adapter](../apps/api/src/providers.ts), [OpenPhish adapter](../apps/api/src/openphish.ts), and [orchestration](../apps/api/src/orchestration.ts).

**Basic crypto and phishing indicators.** Rules detect external password-form destinations, HTTP password-form actions, two investment-claim phrases, crypto-related wording, and EVM/Bitcoin Base58Check address candidates. Synthetic fixtures are clearly identified. Live observations can produce a suspicious category; address presence alone does not. This is narrow screening, not validated detection of cryptocurrency fraud. See [content analysis](../packages/core/src/content.ts) and [address validation](../packages/core/src/analysis.ts).

**Offline ML tooling.** Logistic Regression, Random Forest, and Histogram Gradient Boosting can train and calibrate using the same TypeScript lexical features as the application. Preparation checks labels and duplicates; temporal splitting purges overlapping connected domain/campaign groups. Evaluation produces class metrics, confusion matrices, false-positive rate, average precision, ROC-AUC, Brier score, calibration bins, and batch inference timing. See [pipeline](../ml/pipeline.py).

## Comparison with the proposal

“Implemented” below means present in source with the verification qualifications above. It does not imply that every deployment path has passed an end-to-end test.

| Requirement                           | Current status                                                        | Remaining work                                                                                                                  |
| ------------------------------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| FR-01 URL submission and validation   | Implemented and unit tested                                           | Complete browser/API acceptance checks with services running                                                                    |
| FR-02 Asynchronous scans              | Implemented; mocked lifecycle/recovery tests pass                     | Verify persistence, retries, and restart recovery with real PostgreSQL/Redis                                                    |
| FR-03 URL and domain analysis         | URL features tested; DNS/RDAP integration implemented but default-off | Validate worker deployment, public DNS, successful/missing RDAP data, and domain-age results                                    |
| FR-04 AI fraud detection              | Pending in the application; offline training tooling exists           | Real dataset, model comparison/selection, validation-selected thresholds, frozen evaluation, and versioned production inference |
| FR-05 Threat-intelligence lookup      | Adapter implementations and offline tests exist                       | Enable and verify live integrations; improve per-provider expiry reporting                                                      |
| FR-06 Website-content analysis        | Partially implemented                                                 | Validate live isolated collection; add meaningful redirect-pattern analysis and broader deceptive-content coverage              |
| FR-07 Crypto scam indicators          | Basic rules and address validation implemented                        | Validate live behavior and detection quality against independently reviewed examples                                            |
| FR-08 Risk assessment and explanation | Partially implemented                                                 | Integrate model estimates and validate the combined decision policy; current scores remain unavailable                          |
| FR-09 History and export              | Implemented in API and UI                                             | Verify actual persisted history, pagination, resubmission, and downloads end to end                                             |
| FR-10 Safety and configuration        | Local controls implemented                                            | Verify container isolation, resource limits, and deployed failure behavior; document accurate setup                             |

Objective O3, evaluated ML classification integrated into detection, is the clearest unmet objective. O2, O4, and O5 remain partial because detection coverage, model estimates, real evaluation, and complete operational evidence are missing. O1 has substantial implementation but still needs runtime verification in this review.

## Issues and pending development

1. **Production AI inference is absent.** `ScanService.modelInfo()` returns `available: false`; reports hard-code `numeric_score: null`, `score_kind: 'unavailable'`, and `model_version: null`. The scan orchestrator does not load or invoke a model. Training an offline artifact does not change that. This directly prevents completion of FR-04 and the model component of FR-08.

2. **Research completion is pending.** There is no independently labeled benchmark, selected production model, real holdout result, or reported error analysis. The pipeline hard-codes a 0.5 threshold instead of selecting an operational threshold on validation data. Its current schema contains only lexical URL features; domain, content, and threat information are not part of the ML feature matrix. The proposal's hybrid ablations and improvement hypothesis have therefore not been established.

3. **Detection coverage is limited.** Content rules cover specific form and investment indicators. Redirects are followed, checked for safety, stored, and counted, but redirect patterns do not contribute fraud signals. Domain age is reported without a calibrated relationship to risk. There is no dedicated deceptive-storefront classifier or evidence that the system generalizes across phishing, stores, and investment fraud.

4. **A report summary can contradict its evidence.** A reproduced observation containing a same-domain HTTP password form generated `unencrypted_credential_form`, while the assessment retained the URL-only summary and inconclusive category. Keeping the category inconclusive can be a valid conservative choice; the summary should still acknowledge the content observation and warning. Investment phrases without crypto wording have a similar aggregation limitation. See [content aggregation](../packages/core/src/content.ts).

5. **Provider provenance is incomplete in exported reports.** Individual findings have expiry values, but orchestration preserves only the selected positive provider's expiry internally. `ScanReport` and serialization do not expose explicit expiry fields. Preserve each provider's status, lookup time, and expiry so users can audit freshness as described in FR-05.

6. **Docker configuration does not expose the Google provider path.** Compose hard-codes `ENABLE_EXTERNAL_PROVIDERS: 'false'` and does not pass `SAFE_BROWSING_API_KEY` into the API container. A host `.env` alone therefore does not enable Google Safe Browsing in the supplied container deployment. OpenPhish has a separate configurable flag. See [Compose](../docker-compose.yml).

7. **Documentation is stale and conflicts with the proposal.** The README says DNS/RDAP and live page fetching are not implemented; they now exist as optional modules. The threat model says content scanning always prevents startup, whereas startup now accepts it with valid worker configuration. Architecture omits the separate scanner and describes an obsolete recovery limit. The SRS excludes live content even though the proposal includes it. The implementation checklist leaves all four milestones unchecked. Update these documents to the actual agreed scope and measured status.

8. **Operational evidence is incomplete.** CI includes application, browser, and ML checks, but does not run the Python analysis-worker tests or container isolation probe. The full scan workflow, live integrations, and isolation need reproducible acceptance evidence. Missing authentication and automatic retention are limitations for public deployment, not missing proposal requirements for the stated controlled FYP environment.

## Proposal review

The proposal has a coherent structure: problem, objectives, scope, ten functional requirements, tools, methodology, requirement mapping, evaluation, and deliverables. Its distinction between synthetic testing and independently labeled evaluation is appropriate. It also avoids promising a predetermined accuracy figure.

Before submission, replace the cover-page placeholders for students, registration numbers, programme, department, institution, supervisor, session, and date. Add relevant fraud/phishing detection literature and research datasets: the current four references mostly document tools and methods. Define dataset sources, class taxonomy, expected sample sizes, collection windows, and how legitimate examples will be reviewed. Specify measurable acceptance criteria for false positives, detection quality, scan latency, and reliability, with a schedule for the remaining work.

Reconcile the proposal and SRS. If integrated ML and hybrid detection remain required, retain them as pending work and complete them. If the institution approves a reduced scope, revise the objectives and expected deliverables consistently. The current implementation cannot support a claim that the original proposal has been fully delivered.

Full on-chain tracing, wallet transactions, seed collection, bypassing authentication/CAPTCHA, and automated takedown are explicitly excluded. Screenshot brand comparison and a browser extension are future enhancements. Their absence should not count as a failure to meet the stated FYP scope.

## Recommended completion order

1. Reconcile requirements and documentation, and fix the identified reporting/configuration gaps.
2. Start the controlled database, queue, and scanner environment; verify existing integration, browser, provider, and isolation behavior.
3. Acquire and independently review labeled examples matching the claimed fraud categories; document provenance and collection dates.
4. Run the three-model comparison, select the model and thresholds on validation data, and freeze the final holdout evaluation.
5. Implement versioned inference and combine it with observed evidence, preserving explicit unavailable states.
6. Complete redirect/content coverage and the proposed hybrid comparisons; report errors, false positives, calibration, and end-to-end latency.
7. Produce the final test evidence, deployment instructions, screenshots, evaluation report, and academic submission details.

**Current completion statement:** WebShield AI has substantial prototype infrastructure and verified offline components. Integrated AI detection, real-world research evaluation, and complete operational acceptance remain pending, so it is not yet the fully developed system promised in the proposal.
