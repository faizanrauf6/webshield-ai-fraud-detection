CREATE TABLE IF NOT EXISTS scans (
 id uuid PRIMARY KEY,
 url_input text NOT NULL,
 url_normalized text NOT NULL,
 hostname text NOT NULL,
 status text NOT NULL CHECK(status IN ('queued','running','completed','partial','failed')),
 fixture text,
 analysis jsonb,
 error_code text,
 created_at timestamptz NOT NULL DEFAULT now(),
 started_at timestamptz,
 finished_at timestamptz
);
CREATE INDEX IF NOT EXISTS scans_created ON scans(created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS scans_status ON scans(status);
CREATE INDEX IF NOT EXISTS scans_hostname ON scans(hostname);
CREATE TABLE IF NOT EXISTS model_versions (
 version text PRIMARY KEY,
 metadata jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
