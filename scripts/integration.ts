import { Client } from 'pg';
import { spawnSync } from 'node:child_process';
async function main() {
  const databaseUrl =
    process.env.TEST_DATABASE_URL ||
    'postgresql://webshield:webshield_local@127.0.0.1:55432/webshield_test';
  const url = new URL(databaseUrl);
  const database = url.pathname.slice(1);
  if (!/^[a-zA-Z0-9_]+_test$/.test(database))
    throw new Error('Integration database name must end in _test.');
  url.pathname = '/postgres';
  const admin = new Client({ connectionString: url.toString(), connectionTimeoutMillis: 5000 });
  await admin.connect();
  try {
    const found = await admin.query('SELECT 1 FROM pg_database WHERE datname=$1', [database]);
    if (!found.rowCount) await admin.query(`CREATE DATABASE "${database}"`);
  } finally {
    await admin.end();
  }
  const env = {
    ...process.env,
    DATABASE_URL: databaseUrl,
    TEST_DATABASE_URL: databaseUrl,
    REDIS_URL: process.env.TEST_REDIS_URL || 'redis://127.0.0.1:56379/1',
    RUN_INTEGRATION: 'true',
    ENABLE_CONTENT_SCANNING: 'false',
    ENABLE_DOMAIN_INTELLIGENCE: 'false',
    ENABLE_EXTERNAL_PROVIDERS: 'false',
    ENABLE_OPENPHISH: 'false',
  };
  for (const args of [['run', 'migrate'], ['test']]) {
    const result = spawnSync('npm', args, { env, stdio: 'inherit' });
    if (result.status !== 0) {
      process.exitCode = result.status || 1;
      return;
    }
  }
}
main().catch((error) => {
  console.error(error instanceof Error ? error.message : 'Integration setup failed.');
  process.exitCode = 1;
});
