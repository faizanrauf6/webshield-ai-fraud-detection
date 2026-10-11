import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { createDatabase } from './database';
async function main() {
  const db = await createDatabase().initialize();
  try {
    await db.transaction(async (manager) => {
      await manager.query('SELECT pg_advisory_xact_lock(781234)');
      await manager.query(
        'CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())',
      );
      const directory = path.join(__dirname, '../migrations');
      const names = (await readdir(directory)).filter((name) => /^\d+.*\.sql$/.test(name)).sort();
      for (const name of names) {
        const applied = await manager.query('SELECT 1 FROM schema_migrations WHERE name=$1', [
          name,
        ]);
        if (applied.length) continue;
        await manager.query(await readFile(path.join(directory, name), 'utf8'));
        await manager.query('INSERT INTO schema_migrations (name) VALUES ($1)', [name]);
        console.log(`Applied ${name}.`);
      }
    });
    console.log('Database migrations are current.');
  } finally {
    await db.destroy();
  }
}
main().catch(() => {
  console.error('Migration failed. Check DATABASE_URL and PostgreSQL availability.');
  process.exitCode = 1;
});
