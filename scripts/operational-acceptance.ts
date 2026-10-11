/** Bounded developer acceptance. Never imports dotenv or reads private configuration. */
import assert from 'node:assert/strict';
import { spawn, type ChildProcess } from 'node:child_process';
import { once } from 'node:events';
import { cp, mkdtemp, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import { createServer } from 'node:net';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { Client } from 'pg';
import { Queue } from 'bullmq';
import Redis from 'ioredis';
import type { HistoryResponse, ScanReport } from '@webshield/core';

const root = path.resolve(__dirname, '..');
const base = 'http://127.0.0.1:4003/api/v1';
const liveBase = 'http://127.0.0.1:4000/api/v1';
const sample = [
  { url: 'https://example.com/' },
  { url: 'https://example.org/' },
  { url: 'https://github.com/' },
  { url: 'https://store-demo.example/', fixture: 'benign' },
  { url: 'https://login-demo.example/', fixture: 'phishing' },
  { url: 'https://investment-demo.example/', fixture: 'investment' },
];
const milliseconds = (n: number) => Math.round(n * 100) / 100;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const safeEnv: NodeJS.ProcessEnv = {
  PATH: process.env.PATH,
  HOME: process.env.HOME,
  TMPDIR: process.env.TMPDIR,
  LANG: 'en_US.UTF-8',
  DOTENV_CONFIG_PATH: '/dev/null',
  ENABLE_CONTENT_SCANNING: 'false',
  ENABLE_DOMAIN_INTELLIGENCE: 'false',
  ENABLE_EXTERNAL_PROVIDERS: 'false',
  ENABLE_OPENPHISH: 'false',
  ENABLE_ML: 'false',
};
type RequestResult<T> = { status: number; json: T; headers: Headers };
async function request<T = ScanReport>(
  endpoint: string,
  data?: unknown,
): Promise<RequestResult<T>> {
  const response = await fetch(endpoint, {
    method: data === undefined ? 'GET' : 'POST',
    headers: data === undefined ? {} : { 'Content-Type': 'application/json' },
    body: data === undefined ? undefined : JSON.stringify(data),
    signal: AbortSignal.timeout(10000),
  });
  return { status: response.status, json: (await response.json()) as T, headers: response.headers };
}
async function ready(endpoint: string, child?: ChildProcess) {
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    assert(!child || child.exitCode === null, 'Isolated process exited during startup.');
    try {
      if ((await request(endpoint)).status === 200) return;
    } catch {
      // Local process may still be binding its socket.
    }
    await sleep(200);
  }
  throw new Error('Isolated service readiness timed out.');
}
async function terminal(api: string, id: string) {
  const deadline = Date.now() + 90000;
  while (Date.now() < deadline) {
    const result = await request(`${api}/scans/${id}`);
    assert.equal(result.status, 200);
    const report = result.json as ScanReport;
    if (['completed', 'partial', 'failed'].includes(report.status)) return report;
    await sleep(100);
  }
  throw new Error('Scan terminal-state timeout.');
}
async function scan(api: string, item: (typeof sample)[number]) {
  const start = performance.now();
  const accepted = await request(`${api}/scans`, item);
  const acceptedMs = performance.now() - start;
  assert.equal(accepted.status, 202);
  const report = await terminal(api, accepted.json.scan_id);
  return {
    url: item.url,
    fixture: item.fixture || null,
    demo: report.demo,
    scan_id: report.scan_id,
    submit_ms: milliseconds(acceptedMs),
    end_to_end_ms: milliseconds(performance.now() - start),
    queue_ms:
      report.started_at && report.created_at
        ? Date.parse(report.started_at) - Date.parse(report.created_at)
        : null,
    processing_ms:
      report.completed_at && report.started_at
        ? Date.parse(report.completed_at) - Date.parse(report.started_at)
        : null,
    status: report.status,
    category: report.assessment.category,
    model_probability: report.assessment.model_probability ?? null,
    error: report.error,
    checks: report.checks.map(({ name, status }) => ({ name, status })),
    providers: (report.providers || []).map(({ source, status, reportedMalicious }) => ({
      source,
      status,
      reportedMalicious,
    })),
  };
}
function stats(rows: Awaited<ReturnType<typeof scan>>[]) {
  const sorted = rows.map((r) => r.end_to_end_ms).sort((a, b) => a - b);
  const frequencies: Record<string, number> = {};
  const missing: Record<string, number> = {};
  for (const row of rows) {
    frequencies[row.status] = (frequencies[row.status] || 0) + 1;
    for (const check of row.checks)
      if (['unavailable', 'failed', 'not_configured', 'skipped'].includes(check.status)) {
        const name = `${check.name}: ${check.status}`;
        missing[name] = (missing[name] || 0) + 1;
      }
  }
  return {
    count: rows.length,
    median_ms: milliseconds((sorted[(sorted.length - 1) >> 1] + sorted[sorted.length >> 1]) / 2),
    p95_ms: sorted[Math.ceil(sorted.length * 0.95) - 1],
    max_ms: sorted.at(-1),
    terminal_status_counts: frequencies,
    failed_scans: rows.filter((r) => r.status === 'failed').length,
    timeouts: 0,
    http_errors: 0,
    missing_check_counts: missing,
    percentiles: 'Median averages the middle pair; p95 is nearest rank; polling interval 100ms.',
  };
}
async function stop(child?: ChildProcess, signal: NodeJS.Signals = 'SIGTERM') {
  if (!child || child.exitCode !== null || child.signalCode) return;
  const closed = once(child, 'exit');
  child.kill(signal);
  await closed;
}
async function liveAcceptance() {
  const start = performance.now();
  const configuration = {
    health: (await request(`${liveBase}/health`)).json,
    providers: (await request(`${liveBase}/providers`)).json,
  };
  const live = [];
  for (const item of sample.slice(0, 3)) live.push(await scan(liveBase, item));
  assert(live.every((row) => row.status !== 'failed'));
  const id = live[0].scan_id;
  const [report, exported, history] = await Promise.all([
    request(`${liveBase}/scans/${id}`),
    request(`${liveBase}/scans/${id}/export`),
    request<HistoryResponse>(`${liveBase}/scans?limit=100`),
  ]);
  assert.equal(exported.status, 200);
  assert.deepEqual(exported.json, report.json);
  assert.match(exported.headers.get('content-disposition') || '', /attachment;/);
  assert(live.every((row) => history.json.items.some((item) => item.scan_id === row.scan_id)));
  const previous = history.json.items.find(
    (row) => row.normalized_url === 'https://example.com/' && row.scan_id !== id && !row.demo,
  );
  return {
    checked_at: new Date().toISOString(),
    configuration,
    persistence: {
      exact_json_export: true,
      attachment_filename: true,
      three_new_reports_visible_in_history: true,
      distinct_existing_prior_submission: Boolean(previous),
      prior_scan_id: previous?.scan_id || null,
    },
    summary: stats(live),
    scans: live,
    elapsed_ms: milliseconds(performance.now() - start),
    limit:
      'Three sequential public benign reference URL observations; no malicious-target navigation, no live load stress.',
  };
}
async function liveOnly() {
  const file = path.join(root, 'docs/evidence/operational-acceptance.json');
  const evidence: Record<string, unknown> = JSON.parse(await readFile(file, 'utf8'));
  assert.equal(
    evidence.result,
    'passed',
    'Run baseline acceptance before appending live measurements.',
  );
  evidence.live = await liveAcceptance();
  evidence.live_appended_separately = true;
  (evidence.runtime as Record<string, unknown>).live_requested = true;
  await writeFile(file, `${JSON.stringify(evidence, null, 2)}\n`);
  console.log(
    JSON.stringify({
      result: 'passed',
      phase: 'live',
      evidence: 'docs/evidence/operational-acceptance.json',
    }),
  );
}
async function assertPortFree(port: number) {
  const server = createServer();
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', resolve);
  });
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
}
async function main() {
  await assertPortFree(4003);
  if (process.argv.includes('--browser')) {
    await assertPortFree(4001);
    await assertPortFree(3002);
  }
  const runStart = performance.now();
  const startedAt = new Date().toISOString();
  const temp = await mkdtemp(path.join(os.tmpdir(), 'webshield-operational-'));
  const dbName = `webshield_operational_${Date.now()}_test`;
  const connection = { host: '127.0.0.1', port: 56379, db: 3 };
  const queue = new Queue('webshield-scans', { connection });
  const admin = new Client({
    connectionString: 'postgresql://webshield:webshield_local@127.0.0.1:55432/postgres',
    connectionTimeoutMillis: 5000,
  });
  let api: ChildProcess | undefined;
  let web: ChildProcess | undefined;
  let dbCreated = false;
  let redisOwned = false;
  const evidence: Record<string, unknown> = {
    checked_at: startedAt,
    acceptance_kind: 'Developer exploratory acceptance; no end-user signoff inferred.',
    runtime: {
      node: process.version,
      platform: `${process.platform}/${process.arch}`,
      infrastructure: 'Dedicated Colima webshield VM, 2 CPUs, 4 GiB; PostgreSQL 16, Redis 7.',
      baseline_api: base,
      live_api: liveBase,
      database: 'Unique disposable webshield_operational_<timestamp>_test',
      redis_database: 3,
      flags: Object.fromEntries(
        Object.entries(safeEnv).filter(([name]) => name.startsWith('ENABLE_')),
      ),
      worker_concurrency: 2,
      submission_timeout_ms: 10000,
      terminal_timeout_ms: 90000,
      poll_interval_ms: 100,
      live_requested: process.argv.includes('--live'),
      browser_requested: process.argv.includes('--browser'),
    },
    limits: [
      'Six sequential and six concurrent baseline submissions; this bounded run is not a capacity or long-duration soak test.',
      'Baseline URL cases do not fetch target sites or providers; synthetic fixtures have explicit demo labels.',
      'Host Node API plus VM database/Redis differs from the all-container production deployment.',
      'Crash recovery covers queued persistence and a missing queue job; no live infrastructure service is restarted.',
      'Unavailable optional checks must remain visible; partial is not a failed HTTP request or a clean security result.',
      'Live model probabilities are observations, not ground-truth accuracy labels or safety guarantees.',
    ],
  };
  try {
    const redis = new Redis(connection);
    try {
      const keys = await redis.keys('*');
      assert(
        keys.every((key) => key === 'bull:webshield-scans:meta'),
        'Redis DB 3 must contain no data except metadata created by this Queue client.',
      );
    } finally {
      // A rejected preflight must not leave this separate connection keeping Node alive.
      redis.disconnect();
    }
    redisOwned = true;
    await admin.connect();
    await admin.query(`CREATE DATABASE "${dbName}"`);
    dbCreated = true;
    await mkdir(path.join(temp, 'apps/api'), { recursive: true });
    await cp(path.join(root, 'apps/api/src'), path.join(temp, 'apps/api/src'), { recursive: true });
    await cp(path.join(root, 'apps/api/tsconfig.json'), path.join(temp, 'apps/api/tsconfig.json'));
    await cp(path.join(root, 'tsconfig.json'), path.join(temp, 'tsconfig.json'));
    await symlink(path.join(root, 'node_modules'), path.join(temp, 'node_modules'));
    const database = new Client({
      connectionString: `postgresql://webshield:webshield_local@127.0.0.1:55432/${dbName}`,
    });
    await database.connect();
    try {
      for (const file of ['001.sql', '002-timestamp-precision.sql'])
        await database.query(await readFile(path.join(root, 'apps/api/migrations', file), 'utf8'));
    } finally {
      await database.end();
    }
    const env = {
      ...safeEnv,
      DATABASE_URL: `postgresql://webshield:webshield_local@127.0.0.1:55432/${dbName}`,
      REDIS_URL: 'redis://127.0.0.1:56379/3',
      API_PORT: '4003',
    };
    const startApi = () =>
      spawn(process.execPath, ['--import', 'tsx', 'apps/api/src/main.ts'], {
        cwd: temp,
        env,
        stdio: 'ignore',
      });
    api = startApi();
    await ready(`${base}/health`, api);
    evidence.health = (await request(`${base}/health`)).json;
    const sequential = [];
    for (const item of sample) sequential.push(await scan(base, item));
    const batchStart = performance.now();
    const concurrent = await Promise.all(sample.map((item) => scan(base, item)));
    evidence.baseline = {
      sequential: { summary: stats(sequential), scans: sequential },
      concurrent: {
        submitted_concurrency: sample.length,
        batch_elapsed_ms: milliseconds(performance.now() - batchStart),
        summary: stats(concurrent),
        scans: concurrent,
      },
    };
    for (const item of [...sequential, ...concurrent]) {
      assert.notEqual(item.status, 'failed');
      assert.equal(item.demo, Boolean(item.fixture));
      assert.equal(item.model_probability, null);
      if (!item.fixture) assert.equal(item.category, 'inconclusive');
    }
    const rejectionCases = ['http://127.0.0.1/', 'file:///etc/passwd', 'http://169.254.169.254/'];
    const validation: { url: string; http_status: number; rejected: boolean }[] = [];
    evidence.validation = validation;
    for (const url of rejectionCases) {
      const result = await request(`${base}/scans`, { url });
      assert.equal(result.status, 400);
      validation.push({ url, http_status: result.status, rejected: true });
    }
    const repeat = await scan(base, sample[0]);
    assert.notEqual(repeat.scan_id, sequential[0].scan_id);
    const original = await request(`${base}/scans/${sequential[0].scan_id}`);
    const exported = await request(`${base}/scans/${sequential[0].scan_id}/export`);
    assert.equal(exported.status, 200);
    assert.deepEqual(exported.json, original.json);
    assert.match(
      exported.headers.get('content-disposition') || '',
      /attachment; filename="webshield-/,
    );
    const first = (await request<HistoryResponse>(`${base}/scans?limit=5`)).json;
    assert(first.next_cursor);
    const second = (
      await request<HistoryResponse>(
        `${base}/scans?limit=5&cursor=${encodeURIComponent(first.next_cursor)}`,
      )
    ).json;
    assert.equal(first.items.length, 5);
    assert.equal(second.items.length, 5);
    assert.equal(
      new Set([...first.items, ...second.items].map((r: ScanReport) => r.scan_id)).size,
      10,
    );
    evidence.persistence = {
      exact_json_export: true,
      attachment_filename: true,
      distinct_resubmission: true,
      paginated_history_no_duplicates: true,
      history_total_before_recovery: first.total,
    };
    await queue.pause();
    const queuedA = await request(`${base}/scans`, sample[0]);
    const queuedB = await request(`${base}/scans`, sample[1]);
    assert.equal(queuedA.status, 202);
    assert.equal(queuedB.status, 202);
    assert.equal((await request(`${base}/scans/${queuedA.json.scan_id}`)).json.status, 'queued');
    await stop(api, 'SIGKILL');
    let stopped = false;
    try {
      await request(`${base}/health`);
    } catch {
      stopped = true;
    }
    assert(stopped, 'Killed API must stop accepting requests before recovery begins.');
    await (await queue.getJob(queuedA.json.scan_id))!.remove();
    await queue.resume();
    const recoveryStart = performance.now();
    api = startApi();
    await ready(`${base}/health`, api);
    const recovered = await Promise.all(
      [queuedA, queuedB].map((row) => terminal(base, row.json.scan_id)),
    );
    assert(recovered.every((row) => row.status === 'partial'));
    evidence.recovery = {
      isolated_api_sigkill: true,
      killed_api_socket_closed_before_restart: true,
      database_persisted_queued_count: 2,
      removed_queue_job_count: 1,
      retained_queue_job_count: 1,
      recovered_count: recovered.length,
      statuses: recovered.map((r) => r.status),
      restart_to_terminal_ms: milliseconds(performance.now() - recoveryStart),
      live_services_restarted: false,
    };
    if (process.argv.includes('--live')) evidence.live = await liveAcceptance();
    if (process.argv.includes('--browser')) {
      await stop(api);
      env.API_PORT = '4001';
      api = startApi();
      await ready('http://127.0.0.1:4001/api/v1/health', api);
      web = spawn(
        process.execPath,
        [
          path.join(root, 'node_modules/next/dist/bin/next'),
          'start',
          '--hostname',
          '127.0.0.1',
          '--port',
          '3002',
        ],
        {
          cwd: path.join(root, 'apps/web'),
          env: safeEnv,
          stdio: 'ignore',
        },
      );
      await ready('http://127.0.0.1:3002/api/v1/health', web);
      const configFile = path.join(temp, 'playwright.config.cjs');
      await writeFile(
        configFile,
        `const { defineConfig, devices } = require(${JSON.stringify(path.join(root, 'node_modules/@playwright/test'))}); module.exports = defineConfig({ testDir: ${JSON.stringify(path.join(root, 'tests'))}, testMatch: ['e2e.spec.ts','theme.spec.ts'], fullyParallel: false, workers: 1, timeout: 30000, use: { baseURL: 'http://127.0.0.1:3002', trace: 'off' }, projects: [{ name: 'desktop', use: {...devices['Desktop Chrome']} }, { name: 'mobile', use: {...devices['iPhone 13'], defaultBrowserType: 'chromium'} }], reporter: [['json', {outputFile: ${JSON.stringify(path.join(temp, 'browser.json'))}}]], outputDir: ${JSON.stringify(path.join(temp, 'browser-results'))} });`,
      );
      const browserStart = performance.now();
      const browser = spawn(
        process.execPath,
        [path.join(root, 'node_modules/@playwright/test/cli.js'), 'test', '--config', configFile],
        {
          cwd: root,
          env: { ...safeEnv, PLAYWRIGHT_BROWSERS_PATH: '/tmp/webshield-review-browsers' },
          stdio: 'ignore',
        },
      );
      const [exitCode] = await once(browser, 'exit');
      const browserReport: {
        stats: unknown;
        suites: {
          specs: {
            title: string;
            tests: { projectName: string; results: { status: string }[] }[];
          }[];
        }[];
      } = JSON.parse(await readFile(path.join(temp, 'browser.json'), 'utf8'));
      evidence.browser = {
        exit_code: exitCode,
        elapsed_ms: milliseconds(performance.now() - browserStart),
        stats: browserReport.stats,
        scenarios: browserReport.suites.flatMap((s) =>
          s.specs.map((spec) => ({
            title: spec.title,
            tests: spec.tests.map((t) => ({
              project: t.projectName,
              status: t.results.at(-1)?.status,
            })),
          })),
        ),
        baseline_api: 'http://127.0.0.1:4001',
        frontend: 'http://127.0.0.1:3002',
      };
      assert.equal(exitCode, 0, 'Browser acceptance failed; inspect recorded scenario statuses.');
    }
    evidence.result = 'passed';
  } catch (error) {
    evidence.result = 'failed';
    evidence.failure_category = error instanceof Error ? error.name : 'UnknownError';
    // Error objects may contain connection strings. Preserve generic category only.
    process.exitCode = 1;
  } finally {
    await stop(web);
    await stop(api);
    if (redisOwned) await queue.obliterate({ force: true });
    await queue.close();
    if (dbCreated) await admin.query(`DROP DATABASE "${dbName}" WITH (FORCE)`);
    await admin.end();
    evidence.elapsed_ms = milliseconds(performance.now() - runStart);
    evidence.cleanup = {
      isolated_api_stopped: true,
      isolated_frontend_stopped: true,
      disposable_database_removed: dbCreated,
      owned_queue_removed: redisOwned,
    };
    await rm(temp, { recursive: true, force: true });
    await mkdir(path.join(root, 'docs/evidence'), { recursive: true });
    await writeFile(
      path.join(root, 'docs/evidence/operational-acceptance.json'),
      `${JSON.stringify(evidence, null, 2)}\n`,
    );
    console.log(
      JSON.stringify({
        result: evidence.result,
        elapsed_ms: evidence.elapsed_ms,
        evidence: 'docs/evidence/operational-acceptance.json',
      }),
    );
  }
}
(process.argv.includes('--live-only') ? liveOnly() : main()).catch(() => {
  console.error(
    'Operational harness setup or cleanup failed; no private configuration was loaded or logged.',
  );
  process.exitCode = 1;
});
