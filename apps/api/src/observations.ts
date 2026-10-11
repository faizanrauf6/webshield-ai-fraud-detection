import { getDomain } from 'tldts';
import { normalizeUrl, type ContentObservation, type DomainObservation } from '@webshield/core';

export function workerConfig() {
  return {
    endpoint: process.env.CONTENT_WORKER_URL || 'http://127.0.0.1:4100',
    token: process.env.CONTENT_WORKER_TOKEN || '',
  };
}
export function validateWorkerConfig(config = workerConfig()) {
  const endpoint = new URL(config.endpoint);
  if (
    endpoint.protocol !== 'http:' ||
    !['127.0.0.1', 'analysis-worker'].includes(endpoint.hostname) ||
    endpoint.port !== '4100' ||
    endpoint.username ||
    endpoint.password ||
    endpoint.search ||
    endpoint.hash ||
    endpoint.pathname !== '/'
  )
    throw new Error('Invalid isolated worker endpoint.');
  if (config.token.length < 32)
    throw new Error('CONTENT_WORKER_TOKEN must contain at least 32 characters.');
  return endpoint.origin;
}
function timestamp(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    Number.isFinite(Date.parse(value)) &&
    Math.abs(Date.now() - Date.parse(value)) < 5 * 60 * 1000
  );
}
function bounded(value: unknown, limit: number): value is string {
  return typeof value === 'string' && value.length <= limit;
}

export async function requestObservation<K extends 'domain' | 'content'>(
  kind: K,
  url: string,
  config = workerConfig(),
  fetcher: typeof fetch = fetch,
): Promise<(K extends 'domain' ? DomainObservation : ContentObservation) | null> {
  const endpoint = validateWorkerConfig(config);
  try {
    const response = await fetcher(`${endpoint}/${kind}`, {
      method: 'POST',
      redirect: 'error',
      signal: AbortSignal.timeout(20000),
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.token}` },
      body: JSON.stringify({
        url,
        ...(kind === 'domain' ? { registeredDomain: getDomain(new URL(url).hostname) } : {}),
      }),
    });
    if (!response.ok || !response.body) return null;
    const reader = response.body.getReader();
    let bytes = 0,
      body = '';
    const decoder = new TextDecoder();
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        bytes += value.length;
        if (bytes > 262144) {
          await reader.cancel();
          return null;
        }
        body += decoder.decode(value, { stream: true });
      }
    } finally {
      reader.releaseLock();
    }
    body += decoder.decode();
    const result = JSON.parse(body);
    const o = result?.observation;
    if (result?.status !== 'completed' || !o || !timestamp(o.observedAt)) return null;
    if (kind === 'content') {
      if (
        normalizeUrl(o.url) !== normalizeUrl(url) ||
        !bounded(o.finalUrl, 4096) ||
        normalizeUrl(o.finalUrl) !== o.finalUrl ||
        !bounded(o.text, 50000) ||
        !bounded(o.title, 300) ||
        !Array.isArray(o.forms) ||
        o.forms.length > 32 ||
        !o.forms.every(
          (f: { action: unknown; hasPassword: unknown }) =>
            f && bounded(f.action, 4096) && typeof f.hasPassword === 'boolean',
        ) ||
        !Array.isArray(o.linkDomains) ||
        o.linkDomains.length > 100 ||
        !o.linkDomains.every((d: unknown) => bounded(d, 253)) ||
        !Array.isArray(o.redirects) ||
        o.redirects.length > 4 ||
        !o.redirects.every((r: string) => bounded(r, 4096) && normalizeUrl(r) === r) ||
        !Number.isInteger(o.iframeCount) ||
        o.iframeCount < 0
      )
        return null;
    } else {
      if (
        o.hostname !== new URL(url).hostname ||
        !Array.isArray(o.addresses) ||
        !o.addresses.length ||
        o.addresses.length > 32 ||
        !o.addresses.every((ip: unknown) => bounded(ip, 45)) ||
        !['completed', 'unavailable'].includes(o.rdapStatus) ||
        !(
          o.registeredAt === null ||
          (typeof o.registeredAt === 'string' && Number.isFinite(Date.parse(o.registeredAt)))
        ) ||
        !(o.ageDays === null || (Number.isInteger(o.ageDays) && o.ageDays >= 0))
      )
        return null;
    }
    return o;
  } catch {
    return null;
  }
}
