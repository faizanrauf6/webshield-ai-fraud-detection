import { describe, expect, it } from 'vitest';
import { normalizeUrl, analyzeUrl, extractFeatures, extractCryptoAddresses } from '../src/index';

describe('URL safety policy — no network requests', () => {
  it.each([
    'http://127.0.0.1',
    'http://localhost',
    'http://[::1]',
    'http://169.254.169.254',
    'http://10.0.0.1',
    'http://172.16.1.1',
    'http://192.168.1.1',
    'http://[fc00::1]',
    'http://[fe80::1]',
    'http://[::ffff:127.0.0.1]',
    'http://2130706433',
    'http://0177.0.0.1',
    'http://0x7f000001',
    'http://127.1',
    'http://user:pass@example.com',
    'ftp://example.com',
    'file:///etc/passwd',
    'https://example.com:22',
    'http://service.internal',
    'http://db.local',
    'http://x.localhost',
    'http://metadata.google.internal',
    'http://%31%32%37.0.0.1',
    'https://exam\nple.com',
    'https://example.com\\@127.0.0.1',
    'http://192.0.2.1',
    'http://[2001:db8::1]',
    'https://example.com:abc',
    'http://example.com:8080',
    'http://intranet',
    'https://example.com/%00',
  ])('rejects unsafe or ambiguous input %s', (url) => {
    expect(() => normalizeUrl(url)).toThrow();
  });
  it('normalizes public host, default ports and IDNA', () => {
    expect(normalizeUrl(' HTTPS://Example.COM:443/path?q=test#secret ')).toBe(
      'https://example.com/path?q=test',
    );
    expect(normalizeUrl('https://bücher.de')).toBe('https://xn--bcher-kva.de/');
  });
  it('accepts public IP literal without treating it as fraud', () => {
    expect(normalizeUrl('https://8.8.8.8')).toBe('https://8.8.8.8/');
  });
});

describe('truthful evidence aggregation', () => {
  it('never fabricates a verdict or score for a lexical-only scan', () => {
    const result = analyzeUrl('https://example.com/');
    expect(result.category).toBe('inconclusive');
    expect(result.numericScore).toBeNull();
    expect(result.checks.find((c) => c.name === 'Threat intelligence')?.status).toBe('unavailable');
    expect(result.checks.find((c) => c.name === 'Page content')?.status).toBe('skipped');
  });
  it('marks synthetic investment evidence and addresses without confirming fraud', () => {
    const result = analyzeUrl('https://investment-demo.example/', 'investment');
    expect(result.demo).toBe(true);
    expect(result.category).toBe('inconclusive');
    expect(result.signals.some((s) => s.code === 'guaranteed_returns')).toBe(true);
    expect(result.crypto.addresses.length).toBeGreaterThan(0);
    expect(result.signals.every((s) => s.confidence !== 'verified')).toBe(true);
  });
  it('does not apply a synthetic fixture to an unrelated URL', () => {
    expect(() => analyzeUrl('https://example.com/', 'investment')).toThrow();
  });
  it('finds mismatched login form in a labeled fixture', () => {
    const result = analyzeUrl('https://login-demo.example/', 'phishing');
    expect(result.signals.some((s) => s.code === 'credential_destination_mismatch')).toBe(true);
  });
  it('validates addresses rather than merely matching a regex', () => {
    expect(extractCryptoAddresses('0x52908400098527886E0F7030069857D2E4169EE7')).toHaveLength(1);
    expect(extractCryptoAddresses('0x52908400098527886e0F7030069857D2E4169EE7')).toHaveLength(0);
    expect(extractCryptoAddresses('1BoatSLRHtKNngkdXEeobR76b53LETtpyT')).toHaveLength(1);
    expect(extractCryptoAddresses('1BoatSLRHtKNngkdXEeobR76b53LETtpyU')).toHaveLength(0);
  });
  it('extracts stable finite numeric features', () => {
    const features = extractFeatures('https://shop.example/path/to?q=1');
    expect(features.path_depth).toBe(2);
    expect(features.hostname_length).toBe(12);
    expect(Object.values(features).every(Number.isFinite)).toBe(true);
  });
});
