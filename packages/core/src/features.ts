import { normalizeUrl } from './policy';
import ipaddr from 'ipaddr.js';

export const FEATURE_VERSION = 'lexical-v2';
export const FEATURE_NAMES = [
  'url_length',
  'hostname_length',
  'path_depth',
  'dot_count',
  'hyphen_count',
  'digit_ratio',
  'query_length',
  'punycode',
  'ip_literal',
  'encoded_chars',
  'https',
  'hostname_entropy',
] as const;
export function extractFeatures(input: string, version = FEATURE_VERSION): Record<string, number> {
  let normalized = normalizeUrl(input);
  const url = new URL(normalized);
  // PhiUSIIL's legitimate URLs all have www. Do not learn that collection convention.
  // This is feature-only canonicalization; request/provider URLs remain unchanged.
  if (version.endsWith('-v2') && url.hostname.startsWith('www.')) {
    url.hostname = url.hostname.slice(4);
    normalized = url.toString();
  }
  const counts = new Map<string, number>();
  for (const c of url.hostname) counts.set(c, (counts.get(c) || 0) + 1);
  let entropy = 0;
  for (const count of counts.values()) {
    const p = count / url.hostname.length;
    entropy -= p * Math.log2(p);
  }
  return {
    url_length: normalized.length,
    hostname_length: url.hostname.length,
    path_depth: url.pathname.split('/').filter(Boolean).length,
    dot_count: (url.hostname.match(/\./g) || []).length,
    hyphen_count: (url.hostname.match(/-/g) || []).length,
    digit_ratio: (url.hostname.match(/\d/g) || []).length / url.hostname.length,
    query_length: url.search.length,
    punycode: Number(url.hostname.includes('xn--')),
    ip_literal: Number(ipaddr.isValid(url.hostname.replace(/^\[|\]$/g, ''))),
    encoded_chars: (normalized.match(/%[a-f0-9]{2}/gi) || []).length,
    https: Number(url.protocol === 'https:'),
    hostname_entropy: entropy,
  };
}
