import { expect, it } from 'vitest';
import { analyzeUrl, type ProviderEvidence } from '@webshield/core';
import { refreshProviderEvidence } from '../src/evidence';

it('expires each provider independently and preserves a still-current report', () => {
  const a = analyzeUrl('https://example.com/');
  const now = Date.now();
  const finding = (source: string, expiry: number): ProviderEvidence => ({
    source,
    status: 'completed',
    reportedMalicious: true,
    checkedAt: new Date(now - 1000).toISOString(),
    expiresAt: new Date(expiry).toISOString(),
    detail: 'Exact URL match',
  });
  a.category = 'confirmed_malicious';
  a.screeningCategory = 'suspicious';
  a.screeningSummary = 'Observed content warning';
  a.providers = [finding('first', now - 1), finding('second', now + 1000)];
  const current = refreshProviderEvidence(a, now);
  expect(current.providers?.map((p) => p.status)).toEqual(['expired', 'completed']);
  expect(current.category).toBe('confirmed_malicious');
  expect(current.providerSource).toBe('second');
  const expired = refreshProviderEvidence(a, now + 2000);
  expect(expired.category).toBe('suspicious');
  expect(expired.summary).toContain('Observed content warning');
  expect(a.providers[0].status).toBe('completed');
});
