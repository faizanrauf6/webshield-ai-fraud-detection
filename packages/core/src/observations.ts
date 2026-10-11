import { getDomain } from 'tldts';
import { extractFeatures, FEATURE_NAMES, FEATURE_VERSION } from './features';
import { extractCryptoAddresses } from './analysis';
import { normalizeUrl } from './policy';
import groups from './observation-groups.json';
import type { ContentObservation, DomainObservation, ProviderEvidence } from './types';

export function featureSchema(version: string) {
  const stages: Record<string, (keyof typeof groups)[]> = {
    'lexical-v1': [],
    'url-domain-v1': ['domain'],
    'url-content-v1': ['domain', 'content'],
    'hybrid-v1': ['domain', 'content', 'threat'],
    'lexical-v2': [],
    'url-domain-v2': ['domain'],
    'url-content-v2': ['domain', 'content'],
    'hybrid-v2': ['domain', 'content', 'threat'],
  };
  if (!Object.hasOwn(stages, version)) throw new Error('Unknown feature schema.');
  return {
    version,
    features: [...FEATURE_NAMES, ...stages[version].flatMap((group) => groups[group])],
  };
}
export interface ObservationSnapshot {
  domain?: DomainObservation;
  content?: ContentObservation;
  providers?: ProviderEvidence[];
  asOf?: string;
}
const domain = (value: string) => {
  const host = new URL(value).hostname;
  return getDomain(host, { allowPrivateDomains: true }) || host;
};
export function buildObservationFeatures(
  url: string,
  o: ObservationSnapshot,
  version = FEATURE_VERSION,
) {
  const content = o.content;
  const at = o.asOf ? Date.parse(o.asOf) : Date.now();
  if (!Number.isFinite(at)) throw new Error('Invalid observation timestamp.');
  for (const observation of [o.domain, content]) {
    if (!observation) continue;
    const observed = Date.parse(observation.observedAt);
    if (!Number.isFinite(observed) || observed > at)
      throw new Error('Observation must have a valid timestamp at or before assessment.');
  }
  if (o.domain && o.domain.hostname.toLowerCase() !== new URL(url).hostname.toLowerCase())
    throw new Error('Domain snapshot does not match the assessed hostname.');
  if (content && normalizeUrl(content.url) !== normalizeUrl(url))
    throw new Error('Content snapshot does not match the assessed URL.');
  const providers = (o.providers || []).filter(
    (p) =>
      p.status === 'completed' &&
      (!p.expiresAt || Date.parse(p.expiresAt) > at) &&
      Date.parse(p.checkedAt) <= at,
  );
  const values: Record<string, number> = {
    ...extractFeatures(url, version),
    domain_available: Number(Boolean(o.domain)),
    domain_age_known: Number(o.domain?.ageDays != null),
    domain_age_days: Math.min(o.domain?.ageDays || 0, 36500),
    dns_address_count: o.domain?.addresses.length || 0,
    content_available: Number(Boolean(content)),
    password_forms: content?.forms.filter((f) => f.hasPassword).length || 0,
    external_password_forms:
      content?.forms.filter((f) => {
        try {
          return f.hasPassword && domain(f.action) !== domain(content.finalUrl);
        } catch {
          return false;
        }
      }).length || 0,
    http_password_forms:
      content?.forms.filter((f) => f.hasPassword && f.action.startsWith('http:')).length || 0,
    redirect_count: content?.redirects.length || 0,
    cross_domain_redirects: content?.redirects.filter((r) => domain(r) !== domain(url)).length || 0,
    iframe_count: content?.iframeCount || 0,
    link_domain_count: content?.linkDomains.length || 0,
    crypto_present: Number(
      /\b(?:crypto|bitcoin|ethereum|wallet|token)\b/i.test(content?.text || ''),
    ),
    investment_claims: ['guaranteed returns', 'double your deposit'].filter((p) =>
      content?.text.toLowerCase().includes(p),
    ).length,
    crypto_addresses: extractCryptoAddresses(content?.text || '').length,
    threat_available: Number(providers.length > 0),
    completed_providers: providers.length,
    reported_threats: providers.filter((p) => p.reportedMalicious && p.expiresAt).length,
  };
  return Object.fromEntries(featureSchema(version).features.map((name) => [name, values[name]]));
}
