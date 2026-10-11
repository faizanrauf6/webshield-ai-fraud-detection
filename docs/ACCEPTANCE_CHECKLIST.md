# WebShield AI Controlled Demonstration Acceptance

This checklist distinguishes recorded developer verification from an independent user's or academic examiner's acceptance. Developer evidence supports the local implementation; it does not sign the user's acceptance or establish general website-fraud accuracy. Sample cover information is dummy data.

## 1 Recorded developer evidence

| Area                        | Evidence already recorded                                                                          | Scope                                                                                        |
| --------------------------- | -------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Persistence and queue       | 86 integration-suite passes, including eight database/queue cases                                  | PostgreSQL 16 / Redis 7; dedicated test state                                                |
| ML tooling                  | 62 ML tests passed in the final full suite; chronological holdout metrics                          | Current lexical phishing model, not all fraud                                                |
| Static collector            | Nine scanner tests, real container isolation and live benign collection                            | Bounded static HTML, public DNS/RDAP                                                         |
| Live providers              | Google benign/test URL checks; OpenPhish negative lookup                                           | Configured services and observation times                                                    |
| Installed workflow          | Saved v2 inference, history, export and resubmission                                               | Enabled local deployment                                                                     |
| Frontend                    | Fresh 20-case browser suite passed; theme/accessibility/size evidence                              | Automated checks plus developer visual review                                                |
| Operational timing/recovery | Six sequential + six concurrent baseline runs, two recovered queued scans, three benign live scans | Small bounded sample; no capacity or soak claim                                              |
| Prospective research        | 200 aligned current candidates, four feature stages and reputation comparison                      | No incremental group-holdout hybrid gain; short session is not long-term temporal validation |
| Fresh model validation      | Frozen lexical/candidate comparison, including unseen-domain subgroup                              | Candidate 12% overall / 18.18% unseen reference FPR; no promotion                            |
| Research quality study      | Character/lexical and missingness-aware candidates with validation locks and paired intervals      | Previously inspected holdouts reused descriptively; no promotion                             |
| Research                    | 36,910-record PhreshPhish holdout; 214-site archived fraud holdout                                 | Distinct protocols; content model stays research-only                                        |

Details and retries are in [verification evidence](evidence/verification.md), [UI verification](evidence/ui-verification.md) and linked JSON artifacts. An independent rerun should record its own date and outcomes.

## 2 Independent user acceptance procedure

Use harmless `https://example.com/` and repository-owned synthetic scenarios. Do not open attacker websites in the normal browser.

| ID     | Action                                                            | Expected observable result                                         | Human result and notes |
| ------ | ----------------------------------------------------------------- | ------------------------------------------------------------------ | ---------------------- |
| UAT-01 | Open Overview at port 3000                                        | Readable form, navigation and actual capability state              | Not yet recorded       |
| UAT-02 | Enter unsupported or private URL                                  | Readable rejection; no false clean assessment                      | Not yet recorded       |
| UAT-03 | Run Storefront scenario                                           | Saved `.example` report with explicit Synthetic demo notice        | Not yet recorded       |
| UAT-04 | Run Phishing pattern scenario                                     | Explanation of credential/destination warnings; no real-site claim | Not yet recorded       |
| UAT-05 | Run Crypto investment scenario                                    | Return-claim/address warnings; no abuse claim from address alone   | Not yet recorded       |
| UAT-06 | Submit example.com                                                | Saved lifecycle and available model/provider/static evidence       | Not yet recorded       |
| UAT-07 | Read model context                                                | Phishing scope/version/threshold visible; no business guarantee    | Not yet recorded       |
| UAT-08 | Review checks/provider freshness                                  | Source, observed time, missingness and expiry visible              | Not yet recorded       |
| UAT-09 | Open History and saved report                                     | Same persisted scan ID and historical observations                 | Not yet recorded       |
| UAT-10 | Export JSON                                                       | Attachment matches report ID and serialized evidence               | Not yet recorded       |
| UAT-11 | Select Scan again                                                 | New UUID; previous scan retained                                   | Not yet recorded       |
| UAT-12 | Switch theme; navigate/reload                                     | Sun/moon switch works; manual preference persists when supported   | Not yet recorded       |
| UAT-13 | Test keyboard, zoom and phone width                               | Controls operable and text readable; tables scroll within cards    | Not yet recorded       |
| UAT-14 | Read Configuration and Research                                   | Enabled state/privacy and measured limitations understandable      | Not yet recorded       |
| UAT-15 | Have operator disable an optional check in an isolated test setup | Unavailable/partial evidence; no invented negative                 | Not yet recorded       |
| UAT-16 | Have operator restart the controlled stack                        | History retained; eligible queued/running work reconciled          | Not yet recorded       |

Operator-managed configuration/failure steps should use separate test state rather than interrupting another user's work. Record screenshots or redacted JSON where helpful. A failed item remains open until its resolution and retest are documented.

## 3 Research acceptance review

- [ ] Verify dataset pins, license, label convention and exclusions in the dataset card/provenance.
- [ ] Confirm train/validation/holdout separation and domain purging; recognize source dates are day precision.
- [ ] Confirm calibration/model/threshold selection use validation and final holdout remains frozen.
- [ ] Reconcile reported precision, recall, F1, FPR and confusion counts with JSON evidence.
- [ ] Keep synthetic plumbing, benign development checks and measured holdout accuracy separate.
- [ ] Explain the legacy www/path failure and replacement without presenting legacy scores as current performance.
- [ ] Explain archived content false positives and why those models are not promoted.
- [ ] Recognize full historical threat/reputation comparisons are unavailable without aligned independent observations.
- [ ] State the prospective pilot's 200-row size, seven-minute window, label/source confounding and low observation coverage separately from historical experiments.
- [ ] Explain no incremental hybrid group-holdout gain and within-session hybrid recall loss without making long-term temporal claims.
- [ ] Explain fresh candidate reference false positives and why historical improvement did not justify promotion.
- [ ] Confirm claims remain within phishing/indicator scope and do not certify arbitrary businesses.

## 4 Submission package review

- [ ] Original proposal PDF and proposal exports remain unchanged.
- [ ] Final report and manual are available in Markdown, editable DOCX, PDF and HTML.
- [ ] Architecture/database diagrams and refreshed light/dark/mobile screenshots are readable.
- [ ] Cover metadata is clearly labeled SAMPLE / DEMONSTRATION and does not imply actual identity.
- [ ] Replace sample identities only when real authorized metadata is supplied.
- [ ] Follow any actual university formatting requirements before official submission.
- [ ] Do not treat blank declaration or approval fields as signed.

## 5 Human acceptance record

Current status: **NOT SIGNED — independent academic/user acceptance has not been supplied.**

Reviewer name and role: ____________________

Environment and application revision: ____________________

Review date: ____________________

Accepted items and remaining defects: ____________________

Decision (accepted / accepted with conditions / not accepted): ____________________

Reviewer signature: ____________________

Supervisor/examiner approval, if required by the institution: ____________________

Dummy sample names are intentionally excluded from signatures. This form records a future human decision and does not manufacture approval.
