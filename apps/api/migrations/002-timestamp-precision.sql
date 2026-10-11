-- JavaScript dates preserve milliseconds. Keep cursor ordering at the same precision.
ALTER TABLE scans ALTER COLUMN created_at TYPE timestamptz(3);
ALTER TABLE scans ALTER COLUMN started_at TYPE timestamptz(3);
ALTER TABLE scans ALTER COLUMN finished_at TYPE timestamptz(3);
