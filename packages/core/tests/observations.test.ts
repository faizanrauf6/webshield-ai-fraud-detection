import { expect, it } from 'vitest';
import { buildObservationFeatures, featureSchema } from '../src';

it('encodes missing observations distinctly from a clean observation', () => {
  const absent = buildObservationFeatures('https://example.com/', {}, 'hybrid-v1');
  const present = buildObservationFeatures(
    'https://example.com/',
    {
      content: {
        url: 'https://example.com/',
        finalUrl: 'https://example.com/',
        observedAt: new Date().toISOString(),
        title: 'Welcome',
        text: 'Welcome',
        forms: [],
        redirects: [],
        linkDomains: [],
        iframeCount: 0,
      },
    },
    'hybrid-v1',
  );
  expect(absent.content_available).toBe(0);
  expect(present.content_available).toBe(1);
  expect(Object.keys(absent)).toEqual(featureSchema('hybrid-v1').features);
  expect(Object.values(present).every(Number.isFinite)).toBe(true);
});
it('keeps stages cumulative and rejects unknown feature schemas', () => {
  expect(featureSchema('url-domain-v1').features).toContain('domain_available');
  expect(featureSchema('url-content-v1').features).toContain('password_forms');
  expect(featureSchema('hybrid-v1').features).toContain('reported_threats');
  expect(() => featureSchema('invented')).toThrow();
});
it('rejects future or mismatched historical domain and content snapshots', () => {
  const content = {
    url: 'https://example.com/',
    finalUrl: 'https://example.com/',
    observedAt: '2030-01-01T00:00:00Z',
    title: '',
    text: 'guaranteed returns',
    forms: [],
    redirects: [],
    linkDomains: [],
    iframeCount: 0,
  };
  const domain = {
    hostname: 'example.com',
    addresses: ['8.8.8.8'],
    observedAt: content.observedAt,
    registeredAt: null,
    ageDays: null,
    rdapStatus: 'unavailable' as const,
  };
  for (const observations of [{ content }, { domain }])
    expect(() =>
      buildObservationFeatures(
        'https://example.com/',
        { ...observations, asOf: '2020-01-01T00:00:00Z' },
        'hybrid-v1',
      ),
    ).toThrow();
  expect(() =>
    buildObservationFeatures(
      'https://example.com/',
      {
        content: { ...content, url: 'https://other.example/', observedAt: '2019-01-01T00:00:00Z' },
      },
      'hybrid-v1',
    ),
  ).toThrow();
  expect(() =>
    buildObservationFeatures(
      'https://example.com/',
      { domain: { ...domain, hostname: 'other.example', observedAt: '2019-01-01T00:00:00Z' } },
      'hybrid-v1',
    ),
  ).toThrow();
});
