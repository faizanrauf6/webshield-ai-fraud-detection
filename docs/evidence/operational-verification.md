# Operational acceptance — 12 October 2026

The bounded developer acceptance run passed. This records executed HTTP/browser scenarios and developer visual inspection; it is **not end-user acceptance signoff**, a production capacity claim or proof that arbitrary websites are safe. Raw results, individual scan timings, statuses, optional-check counts and browser scenario names are in [operational-acceptance.json](operational-acceptance.json).

| Measured case                                        |            Count |    Median |            p95 / maximum | Result                                        |
| ---------------------------------------------------- | ---------------: | --------: | -----------------------: | --------------------------------------------- |
| Isolated baseline, sequential                        |                6 | 118.82 ms |                161.84 ms | 6 partial, 0 failed                           |
| Isolated baseline, six submitted together            |                6 | 168.28 ms |                168.67 ms | 6 partial, 0 failed; batch 169.93 ms          |
| Enabled Docker app, sequential public reference URLs |                3 |   5.413 s |                  7.012 s | 3 completed, 0 failed                         |
| Isolated process crash and restart                   | 2 queued reports |         — | 1.434 s to both terminal | Missing job recreated; retained job processed |
| Production frontend browser suite                    |               20 |         — |   36.85 s suite duration | 20 passed, 0 skipped, 0 unexpected, 0 flaky   |

Latency is submission-to-observed-terminal HTTP time, including queueing and 100 ms polling. Median averages the middle pair; p95 uses nearest rank. With only six or three observations, p95 equals the maximum and has little statistical stability. There were **zero HTTP errors, terminal timeouts or failed scans** in these measured samples. The baseline/browser/recovery harness took 44.93 s including setup and cleanup; the separate enabled three-scan workflow took 17.63 s. A final provider-free recheck of the completed harness also passed in 5.27 s; its separate timings and cleanup record are retained under `harness_final_recheck`.

## What was accepted

The baseline sample was example.com, example.org, github.com and all three explicitly synthetic fixtures: storefront, phishing pattern and crypto investment. All synthetic results retained their demo marker. With integrations disabled, real URLs remained inconclusive with no model score. All 12 baseline results were partial: domain intelligence, threat intelligence and ML remained explicitly unavailable; real page-content/crypto checks were skipped. These missing-data states are expected configuration outcomes, not clean scan results.

Loopback, link-local metadata and file URLs returned HTTP 400. Resubmitting the same URL created a distinct report ID. JSON export exactly matched the report endpoint and provided an attachment filename. Two history pages of five records had no duplicates. The live read-only follow-up also verified exact export, presence of all three new reports in persisted history, and a distinct earlier submission of example.com.

For recovery, the harness paused its isolated queue, submitted two reports, killed the actual API process with SIGKILL, and confirmed its HTTP socket was closed. It removed one queued job while preserving the database record, retained the other job, then restarted the API. Both original report IDs reached partial terminal states. This exercises startup reconciliation across a missing-job boundary and ordinary retained-queue recovery. It does not test a live VM restart, Redis/PostgreSQL outage or an interrupted in-flight provider request.

The fresh browser suite covered overview, history, research and configuration; real URL submission/report/export/history; URL rejection; a synthetic crypto report; provider/model display fixtures; device theme preference, manual theme choice, persistence, blocked storage; and automated accessibility/readability/viewport checks in both themes on desktop and mobile. Provider/model rendering tests use explicit mocked API responses; their names do not imply live provider execution.

Developer exploration additionally navigated the real baseline frontend at a 390 × 664 CSS-pixel mobile viewport, captured and visually inspected the light overview and dark synthetic crypto report. The form, responsive cards, synthetic label, inconclusive assessment, warning evidence and address candidates were visible; the history table retained panel scrolling. Temporary screenshots are recorded in the JSON; they are not committed. This visual scope is two pages, with wider route/theme assertions supplied by the automated suite.

## Enabled app observations

The running Docker app used its existing server-side configuration; no credential file or key was loaded or printed by the harness. OpenPhish, Google Safe Browsing, isolated content scanning and DNS/RDAP were enabled. Actual installed model inference and every listed check completed for example.com (7.012 s), example.org (5.413 s) and github.com (4.980 s). Both threat providers returned negative observations for each; categories were low observed risk. Observed phishing model probabilities were 36.54%, 37.05% and 37.05%. These are model estimates, not calibrated probabilities of safety or measured accuracy on these three targets.

The scanner workers were reserved for these three sequential checks; the separate research collector started afterward. No enabled-provider concurrency stress was performed, keeping public service usage bounded.

## Reproduction and boundaries

Use Node 24 and the repository dependencies with the dedicated local PostgreSQL 16 / Redis 7 services available on loopback 55432 / 56379. The measured VM had two CPUs and 4 GiB memory. The API ran on the macOS arm64 host for the isolated baseline; enabled checks ran through the existing Docker app on 4000. These are different runtime boundaries.

```sh
# Baseline load, validation, persistence and process recovery only:
npx tsx scripts/operational-acceptance.ts

# Add the existing production frontend's 20 browser checks:
npx tsx scripts/operational-acceptance.ts --browser

# Append three enabled-app observations to successful baseline evidence:
npx tsx scripts/operational-acceptance.ts --live-only

# Or collect all three phases in one coordinated run:
npx tsx scripts/operational-acceptance.ts --browser --live
```

The script reserves free ports 4003 and, for browser checks, 4001/3002; creates a unique disposable database ending `_test`; and requires Redis DB 3 to contain no preexisting data beyond BullMQ metadata. It copies API source to a temporary tree with no `.env`, sets all five optional integration/ML flags false for the baseline, and uses worker concurrency two. Submission requests have a 10 s timeout and terminal polling a 90 s deadline. Test API/frontend processes, the disposable database and the owned queue are removed afterward. Existing live containers are not restarted or mutated by the harness; optional live submissions remain in normal application history.

`--browser` requires a current production frontend build whose API rewrite targets 4001 and installed Chromium under `/tmp/webshield-review-browsers`, matching this workspace's verification setup. If rebuilding is needed, use `API_BASE_URL=http://127.0.0.1:4001 npm run build -w @webshield/web` before starting the harness. The commands overwrite the measured JSON; `--live-only` appends to an existing successful baseline run. The two-page developer visual inspection is separately recorded and is not synthesized by rerunning automated tests.

This is a short operational sample, not a sustained soak, maximum-throughput benchmark, cross-network reliability study, human usability study or end-user acceptance decision. No production behavior, model threshold or provider policy was changed for these measurements.
