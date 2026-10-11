# Implementation status — 12 October 2026

The software, Google integration, isolated collection, temporal phishing experiment and archived broader-fraud comparisons are implemented. The [original review](PROJECT_REVIEW.md) describes the older state; [verification](evidence/verification.md) and [completion ledger](COMPLETION_PROGRESS.md) record subsequent work.

| Proposal area                    | Working now                                                                                                                         | Remaining limits                                                           |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Submission and processing        | URL policy, persistent queue, retries/recovery, history and JSON export                                                             | Controlled shared local workspace; no accounts                             |
| Phishing ML                      | Corrected v2 features, dated public dataset, calibrated selected model, frozen chronological holdout, development promotion gates   | Recall 58.41% at FPR 1.64%; estimates do not establish safety              |
| Threat intelligence              | OpenPhish plus Google exact-URL reports, time/expiry/fallback                                                                       | Current provider coverage is incomplete                                    |
| Static content/domain            | Docker-isolated HTML/forms/redirects, public DNS and authoritative RDAP                                                             | Static HTML only; missing observations remain explicit                     |
| Crypto/investment/store warnings | Address validation, claim patterns, storefront/credential evidence                                                                  | Presence alone does not establish wrongdoing                               |
| Broader research                 | 1,190 archived store/investment/crypto labels,1,090 HTML snapshots,759 domain ages; three cumulative ablations and category metrics | Content-model FPR 8.47% overall/21.62% on legitimate crypto; research-only |
| Isolation acceptance             | Actual internal socket denial, privilege restriction, live HTML/DNS/RDAP and blocked internal target passed                         | No absolute sandbox guarantee                                              |
| Google acceptance                | Owner key configured privately; benign no-match and public phishing-test match/expiry passed                                        | Provider errors remain unavailable evidence                                |

## Is it fully developed?

**The controlled FYP application is implemented and its previously blocked integrations now work. The full research proposal is not yet scientifically complete.**

The known example.com false-positive regression is fixed without an allowlist: all-www sampling and path bias were diagnosed, versioned features and a newer dated source replaced the old model, and benign root/login regressions gate promotion.

Real archived store/investment/crypto data now supports measured URL/domain/content comparisons. Those results do not justify deploying a broad scam classifier: the content model exceeds the intended false-positive target, particularly on legitimate crypto services. It stays outside the production phishing runtime.

Aligned independent historical threat-provider observations are absent from both public corpora. The full historical threat-enriched/reputation-only comparison remains unavailable. Today's provider lookups cannot replace old observations without changing the experiment. No dates, labels or research improvements are invented. External, contemporary adjudicated fraud validation is still needed before a broad deployment claim.

Accounts, wallet operations, on-chain tracing, screenshot classification and browser extensions remain outside the agreed controlled FYP scope. Manual app testing follows the recorded developer acceptance checks.
