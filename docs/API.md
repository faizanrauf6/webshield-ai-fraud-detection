# API

Base: `http://127.0.0.1:4000/api/v1`. Frontend uses the same-origin `/api/v1` proxy. JSON responses are not cacheable.

## Submit

`POST /scans` → 202

```json
{ "url": "https://example.com/" }
```

```json
{ "scan_id": "generated-uuid", "status": "queued", "submitted_url": "https://example.com/" }
```

Optional `fixture` is `benign`, `phishing` or `investment`, and must match its defined `.example` URL. Unknown fields are rejected. Fixtures are explicitly synthetic. Request body limit is 8 KB; URL limit is 4,096 characters.

## Read/export

- `GET /scans/:id`: saved lifecycle, timestamps, assessment, checks, signals, lexical features, crypto candidates and limitations.
- `GET /scans/:id/export`: same serialized report with a JSON attachment filename.
- `GET /scans?limit=20&cursor=...`: `items`, deployment-wide `total` and opaque `next_cursor`. Limit 1–100; order is submission date/UUID descending. Invalid cursors return 400.
- `GET /health`: confirms actual PostgreSQL and queue queries.
- `GET /model-info`: enabled bundle version, feature schema, phishing scope, selected threshold, measured metrics and evaluation provenance; unavailable when disabled or invalid.
- `GET /providers`: configured/enabled flags and privacy explanation. Does not reveal keys or claim provider health.

`status`: queued, running, completed, partial or failed. Missing evidence typically means partial + inconclusive. When valid inference exists, `assessment.score_kind` is `model_probability`, `numeric_score` is the percentage, and `model_probability`, `model_threshold`, `model_scope`, and `model_version` expose the underlying estimate. Otherwise the score is null/unavailable. `providers` preserves each source's status, `checkedAt`, optional `expiresAt`, `reportedMalicious` and detail; expiry is refreshed at read/export time. A provider-reported potential threat requires an exact URL match and current source evidence; it is not an independently proven business-fraud verdict.

## Errors

400 invalid URL/body/UUID/cursor; 404 unknown scan; 429 request throttling; 503 queue submission failure (includes the persisted failed `scan_id`). Provider errors become unavailable checks rather than a negative finding. Body parser may return 413 for oversized input.

## Configuration

`DATABASE_URL`, `REDIS_URL`, `API_PORT`, `API_HOST`, `ALLOWED_ORIGIN`, `ENABLE_EXTERNAL_PROVIDERS`, `SAFE_BROWSING_API_KEY`, `ENABLE_OPENPHISH`, `ENABLE_CONTENT_SCANNING`, `ENABLE_DOMAIN_INTELLIGENCE`, `CONTENT_WORKER_URL`, `CONTENT_WORKER_TOKEN`, `ENABLE_ML`, `ML_PYTHON`, `MODEL_ARTIFACT_DIR`.

Provider calls require both the enabled flag and a backend key. Google Safe Browsing is intended for noncommercial use; consult its [usage restrictions](https://developers.google.com/safe-browsing/v4/usage-limits) before enabling it. Static content/domain collection requires the isolated Docker worker, a random token of at least 32 characters, and its corresponding enable flags. Run the isolation acceptance probe before enabling collection. See README for deployment instructions.
