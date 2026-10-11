# Threat model

Protect credentials, stored URLs/report integrity and internal networks. Submitted URLs, static page content and external reports are untrusted. Model joblib files are executable deserialization inputs and require a trusted local producer.

| Threat                           | Implemented control                                                                                                | Limit / acceptance status                                                                                                     |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| SSRF and DNS rebinding           | Conservative URL policy, every DNS answer public, pinned connections, peer checks, redirect revalidation           | Unit/socket fixtures pass; actual namespace firewall probe passed locally and in CI                                           |
| Internal/metadata socket access  | Worker firewall default-denies egress and rejects nonpublic ranges; drop privileges after setup                    | Container acceptance is wired into CI, not claimed passed on this workstation                                                 |
| Target scripts and wallet drains | Static HTML only; no browser execution, form submission or wallet connection                                       | Dynamic behavior cannot be detected                                                                                           |
| Evidence injection               | React text rendering, no raw target HTML                                                                           | Screenshots and script classifiers are not implemented                                                                        |
| Provider outages/stale matches   | Fixed endpoints, time/size bounds, exact matching, independent expiry fallback                                     | Live OpenPhish negative verified; Google benign and test-phishing checks passed with private key                              |
| Secrets in URLs                  | Backend-only provider credentials; no routine submitted URL logging                                                | Full URL persists/exports and may be sent to enabled providers; user must remove query secrets                                |
| Resource exhaustion              | 8 KB request, 4,096-character URL, two jobs, scanner child deadline/size caps, container limits, bounded inference | Per-process throttling; no tenant quotas or global storage cap                                                                |
| False certainty/data leakage     | Group-disjoint splits, validation selection, frozen holdout, missing masks, limited-scope model output             | www/path sampling regression corrected; temporal phishing + archived fraud results report remaining drift and false positives |
| Malicious model files            | Trusted-local promotion, hashes, schema/class/probability checks                                                   | Hashes do not authenticate a replaced manifest; never load untrusted joblib                                                   |

## Collection boundary

The API can invoke the scanner only with configured flags and a validated internal HTTP endpoint/token. The worker server refuses ordinary startup without its isolation marker and token. Its Docker entrypoint installs IPv4/IPv6 rules, then drops to UID/GID 65532 with no privilege escalation. Submitted public hostnames can resolve internally; parser checks alone never authorize a connection. Every resolved address, redirect and socket peer is checked. Defaults remain off for fresh installs; this workstation enables scanning after actual firewall/live acceptance passed.

`make test-isolation` creates an otherwise reachable internal HTTP service, proves it reachable from a control container, then verifies the scanner cannot reach it or loopback/private/metadata destinations and cannot change firewall rules. This is acceptance tooling, not evidence of a passed run here. It does not establish security against every future platform/network configuration.

## Deployment/privacy

Local shared history has no login or automatic retention. Public deployment requires separate access-control and retention design. Development database credentials are local-only. A provider negative, HTTPS scheme or low model estimate never establishes business legitimacy. This FYP does not execute or facilitate wallet operations.
