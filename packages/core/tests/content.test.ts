import { expect, it } from 'vitest';
import { analyzeUrl, applyContentObservation, type ContentObservation } from '../src';

const observation: ContentObservation = {
  url: 'https://example.com/',
  finalUrl: 'https://example.com/',
  observedAt: '2026-10-11T10:00:00.000Z',
  title: 'Account',
  text: 'Welcome to your account',
  forms: [],
  linkDomains: [],
  iframeCount: 0,
  redirects: [],
};
it('reports real credential-destination mismatch as suspicious, never confirmed fraud', () => {
  const result = applyContentObservation(analyzeUrl(observation.url), {
    ...observation,
    forms: [{ action: 'https://collector.example/send', hasPassword: true }],
  });
  expect(result.category).toBe('suspicious');
  expect(result.numericScore).toBeNull();
  expect(result.signals.find((s) => s.code === 'credential_destination_mismatch')?.source).toBe(
    'Isolated static HTML scan',
  );
  expect(result.checks.find((c) => c.name === 'Page content')?.status).toBe('completed');
  expect(result.limitations.join(' ')).not.toContain('no target-page requests');
});
it('same registrable-domain forms are not misidentified as an external collector', () => {
  const result = applyContentObservation(analyzeUrl('https://login.example.com/'), {
    ...observation,
    url: 'https://login.example.com/',
    finalUrl: 'https://login.example.com/',
    forms: [{ action: 'https://auth.example.com/', hasPassword: true }],
  });
  expect(result.signals.some((s) => s.code === 'credential_destination_mismatch')).toBe(false);
  expect(result.category).toBe('inconclusive');
});
it('detects investment claims and validated crypto addresses from live text with provenance', () => {
  const result = applyContentObservation(analyzeUrl(observation.url), {
    ...observation,
    text: 'Bitcoin investment. Guaranteed returns. Double your deposit. 1BoatSLRHtKNngkdXEeobR76b53LETtpyT',
  });
  expect(result.crypto.addresses).toHaveLength(1);
  expect(result.crypto.claims).toEqual(['guaranteed returns', 'double your deposit']);
  expect(result.demo).toBe(false);
  expect(result.category).toBe('suspicious');
  expect(result.signals.every((s) => s.confidence !== 'verified')).toBe(true);
});
it('crypto address presence alone never makes a website suspicious', () => {
  const result = applyContentObservation(analyzeUrl(observation.url), {
    ...observation,
    text: 'Bitcoin donations 1BoatSLRHtKNngkdXEeobR76b53LETtpyT',
  });
  expect(result.category).toBe('inconclusive');
});
it('summarizes HTTP password forms and non-crypto investment claims as observed warnings', () => {
  const form = applyContentObservation(analyzeUrl(observation.url), {
    ...observation,
    forms: [{ action: 'http://example.com/login', hasPassword: true }],
  });
  expect(form.summary).toContain('Password form');
  expect(form.category).toBe('suspicious');
  const investment = applyContentObservation(analyzeUrl(observation.url), {
    ...observation,
    text: 'Our investment offers guaranteed returns',
  });
  expect(investment.category).toBe('suspicious');
  expect(investment.crypto.detected).toBe(false);
});
it('reports suspicious redirect chains and storefront payment pressure as heuristics', () => {
  const result = applyContentObservation(analyzeUrl(observation.url), {
    ...observation,
    finalUrl: 'https://store.example/',
    redirects: ['https://relay.example/', 'https://store.example/'],
    text: 'Online shop sale 90% off. Pay only in Bitcoin. No refunds.',
  });
  expect(result.signals.some((s) => s.code === 'cross_domain_redirect_chain')).toBe(true);
  expect(result.signals.some((s) => s.code === 'storefront_payment_pressure')).toBe(true);
  expect(result.category).toBe('suspicious');
  expect(result.signals.every((s) => s.confidence !== 'verified')).toBe(true);
});
it('describes completed content inspection even when no warning appears', () => {
  const result = applyContentObservation(analyzeUrl(observation.url), observation);
  expect(result.summary).toContain('Static page content');
  expect(result.category).toBe('inconclusive');
});
