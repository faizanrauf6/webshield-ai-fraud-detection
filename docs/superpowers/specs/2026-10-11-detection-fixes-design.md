# Detection fixes design

The user requested implementation of the fixes and capabilities described in the revised WebShield AI proposal. Keep the existing Next.js/NestJS/PostgreSQL/Redis architecture. Repair existing quality failures and implement the missing integration paths without manufacturing training data, scores or provider results.

## Components

1. Format the existing API changes and generated proposal HTML. Correct persistent queue reconciliation so recovery is paginated rather than capped at 1,000 records. Preserve terminal scan records across retries and ambiguous enqueue acknowledgements.
2. Add a separately deployable Python analysis worker for DNS/RDAP and bounded HTML collection. Only this worker contacts submitted sites. Resolve and validate all addresses, pin the chosen IP, verify the socket peer, validate redirects, bound bytes and total execution time, and do not execute JavaScript or submit forms. A Docker entrypoint installs independent IPv4/IPv6 egress rules, then drops privileges. The worker has no DB/Redis credentials or application network membership. Feature flags remain off by default.
3. Add a shared content evidence engine for credential destination mismatches, investment claims and checksum-aware crypto address candidates. Preserve source, timestamp and uncertainty; heuristic findings never become confirmed reports.
4. Add model review/promotion and trusted local inference. Promotion requires a non-synthetic evaluated manifest, reviewed dataset/model, thresholds and reviewer metadata. Inference checks schema and artifact hashes. No supplied real labels means no production model can be installed in this session; the application must report unavailable rather than train on artificial examples and claim detection performance.
5. Integrate optional worker/model observations into saved reports and the frontend. Show actual model metadata and calibrated estimates when installed. Provider reports take precedence; expired reports revert to remaining valid evidence. Offline fixture demonstrations remain available with all network features disabled.

## Verification

Use failing regressions for lifecycle, content, model trust and network boundaries. Run lint/types, TypeScript and Python suites, PostgreSQL/Redis integration, production builds and browser/accessibility flows. Exercise independent Docker egress restrictions with actual attempted internal socket connections. Live credentials and independent labeled data are external prerequisites, recorded explicitly in the final implementation status.
