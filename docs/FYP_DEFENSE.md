# FYP defense and demonstration guide

## Contribution statement

“WebShield AI implements persistent website-risk scans, explainable static warning signals, optional isolated observations and threat lookups, and a calibrated phishing model evaluated on a published benchmark. We compare three lexical baselines using domain-disjoint groups. Broader hybrid fraud improvement and temporal robustness remain unproven.”

Do not claim all-scam detection, a guaranteed 2% operational false-positive ceiling, real hybrid performance, temporal evaluation on undated data, or passed container/Google tests without running them.

## Demonstration

1. Follow README setup and run database migrations. Enable `ENABLE_ML=true` with the installed bundle to demonstrate real model inference.
2. Submit a public example URL. Show lifecycle, model version/threshold/scope, warning evidence and missing checks. `example.com` currently produces a false positive: explain benchmark/domain shift rather than representing it as fraud.
3. Open saved history, repeat the scan and export JSON. Show attributable timestamps and per-provider expiry when configured.
4. Run labeled `.example` phishing/retail/crypto fixtures. They remain explicitly synthetic, skip live/model calls and cannot establish accuracy. Address syntax alone is not wrongdoing.
5. Submit loopback input and show rejection. Explain parser, DNS, socket and firewall layers; do not equate parser tests with proof of container isolation.
6. Open research: compare real heldout class metrics, selected model, provenance, split protocol and false-positive rate. Open settings: enabled/configured does not mean independently verified healthy.
7. Show aggregate evidence and exact reproduction commands. Explain why the 240-row synthetic smoke is only plumbing validation.
8. If Docker/key prerequisites exist, run scanner isolation and live integration acceptance before demonstrating those modules.

## Questions

- Why HTTPS is insufficient: encrypted transport does not verify the business.
- Why three baselines: reproducible reference points before claiming improvements.
- How leakage is controlled: canonical deduplication, connected domain/campaign groups, validation-only selection, frozen holdout; temporal overlap purging for dated data.
- Why no temporal UCI result: observation dates are absent and were not invented.
- Why the model can misclassify example.com: historical class/source conventions and prevalence can differ from real traffic; lexical inputs cannot verify legitimacy.
- What remains: historical hybrid snapshots, dated validation and store/investment labels; Docker/live collection and Google acceptance; academic cover details and institution-specific submission requirements.

## User manual

Enter a complete HTTP(S) URL and choose Analyze website. Review each source, timestamp, status and limitation. Use history to revisit reports or search loaded rows; export JSON for research. Configuration is read-only and changes through root `.env` plus API restart. A partial scan indicates missing evidence; resubmitting does not supply absent credentials or historical data.

The original supplied proposal PDF was reviewed, not edited. Cover identities, registration numbers and institutional details must come from the student. The code cannot supply missing research evidence or academic identity information.
