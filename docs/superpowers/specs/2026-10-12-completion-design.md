# WebShield completion design

Implement the pending review findings sequentially in the existing application. Preserve the controlled FYP scope and never substitute synthetic metrics for real performance.

1. Production inference uses a bounded Python subprocess and a trusted local versioned bundle. Reject synthetic bundles, incompatible features, missing/altered artifacts, invalid probabilities, and unavailable runtimes. API and reports expose probabilities as model estimates scoped to phishing, never verified fraud. Provider matches take precedence; warning evidence cannot be erased by a low model estimate.
2. Import the user-selected UCI PhiUSIIL benchmark, preserving its authors, CC BY 4.0 license, source labels, raw checksum, exclusions, and unknown observation dates. Use connected-domain/campaign group partitions when dates are absent; retain the existing temporal split for dated inputs. Calibrate on validation data, select model/threshold under an explicit maximum validation false-positive rate, and use test data only after selection. Keep the benchmark's precomputed label-derived features out of production lexical models.
3. Support optional versioned domain/content/threat observation features and staged ablations only when supplied with matching historical observations. Never fetch today's pages to reconstruct historical training content or fabricate missing hybrid performance.
4. Add redirect, credential, investment, and storefront screening indicators; summarize every completed observation accurately. Preserve narrow heuristic confidence and missing-data states.
5. Preserve per-provider lookup/expiry information through JSON export and age individual results consistently. Wire provider/model configuration through Compose and show model metadata and measured comparison results in the UI.
6. Run application, ML, scanner, database/queue, browser, and actual container socket-isolation checks where supported. Add these to CI; record external prerequisites rather than claiming checks ran.
7. Reconcile SRS, architecture, threat model, model/dataset cards, evaluation, status, and setup instructions. Leave personal academic details for the user; preserve the original proposal PDF.

Execution is inline, one step at a time, as requested. This directory is not a Git checkout; edit in place, keep a progress ledger, and do not initialize Git or create commits. Regression tests precede behavioral implementation. No external publication or accounts are in scope.
