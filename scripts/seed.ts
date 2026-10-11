import { FIXTURES } from '../packages/core/src';
async function main() {
  const base = process.env.API_BASE_URL || 'http://127.0.0.1:4000';
  for (const [fixture, data] of Object.entries(FIXTURES)) {
    const response = await fetch(`${base}/api/v1/scans`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: data.url, fixture }),
    });
    if (!response.ok)
      throw new Error('Demo seeding failed. Start the API and check its availability.');
    const saved = await response.json();
    console.log(`${data.label} (synthetic): ${saved.scan_id}`);
  }
}
main().catch((error) => {
  console.error(error instanceof Error ? error.message : 'Demo seeding failed.');
  process.exitCode = 1;
});
