import { afterEach, expect, it, vi } from 'vitest';
import { analyzeSubmittedUrl } from '../src/orchestration';

afterEach(() => vi.unstubAllEnvs());
it('analyzes live content and domain observations while preserving unavailable model status', async () => {
  vi.stubEnv('ENABLE_CONTENT_SCANNING', 'true');
  vi.stubEnv('ENABLE_DOMAIN_INTELLIGENCE', 'true');
  vi.stubEnv('CONTENT_WORKER_TOKEN', 'x'.repeat(32));
  const fetcher: typeof fetch = async (input) =>
    Response.json({
      status: 'completed',
      observation: String(input).endsWith('/domain')
        ? {
            hostname: 'example.com',
            addresses: ['8.8.8.8'],
            observedAt: new Date().toISOString(),
            rdapStatus: 'unavailable',
            registeredAt: null,
            ageDays: null,
          }
        : {
            url: 'https://example.com/',
            finalUrl: 'https://example.com/',
            observedAt: new Date().toISOString(),
            title: 'Investment',
            text: 'Crypto investment guaranteed returns',
            forms: [],
            linkDomains: [],
            redirects: [],
            iframeCount: 0,
          },
    });
  const result = await analyzeSubmittedUrl('https://example.com/', undefined, fetcher);
  expect(result.category).toBe('suspicious');
  expect(result.domain?.addresses).toEqual(['8.8.8.8']);
  expect(result.checks.find((c) => c.name === 'Domain registration')?.status).toBe('unavailable');
  expect(result.checks.find((c) => c.name === 'Machine learning')?.status).toBe('unavailable');
  expect(result.numericScore).toBeNull();
});
it('worker failure becomes partial evidence rather than a failed or clean scan', async () => {
  vi.stubEnv('ENABLE_CONTENT_SCANNING', 'true');
  vi.stubEnv('CONTENT_WORKER_TOKEN', 'x'.repeat(32));
  const result = await analyzeSubmittedUrl('https://example.com/', undefined, async () => {
    throw new Error('Timeout');
  });
  expect(result.category).toBe('inconclusive');
  expect(result.checks.find((c) => c.name === 'Page content')?.status).toBe('unavailable');
});
it('synthetic fixtures never invoke live lookups even if enabled', async () => {
  vi.stubEnv('ENABLE_CONTENT_SCANNING', 'true');
  vi.stubEnv('ENABLE_DOMAIN_INTELLIGENCE', 'true');
  vi.stubEnv('ENABLE_OPENPHISH', 'true');
  const result = await analyzeSubmittedUrl(
    'https://investment-demo.example/',
    'investment',
    async () => {
      throw new Error('Must stay offline');
    },
  );
  expect(result.demo).toBe(true);
  expect(result.category).toBe('inconclusive');
  expect(result.crypto.addresses).toHaveLength(2);
});
