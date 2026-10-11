import {
  analyzeUrl,
  applyContentObservation,
  buildObservationFeatures,
  type Fixture,
  type Analysis,
} from '@webshield/core';
import { requestObservation } from './observations';
import { lookupSafeBrowsing, type ProviderFinding } from './providers';
import { OpenPhishProvider } from './openphish';
import { predictRisk, applyModelPrediction, getModelInfo } from './model';

const openPhish = new OpenPhishProvider();
const enabled = (key: string) => process.env[key] === 'true';

export async function analyzeSubmittedUrl(
  url: string,
  fixture?: Fixture,
  fetcher: typeof fetch = fetch,
  infer: typeof predictRisk = predictRisk,
): Promise<Analysis> {
  const analysis = analyzeUrl(url, fixture);
  if (fixture) return analysis;
  const [domain, content] = await Promise.all([
    enabled('ENABLE_DOMAIN_INTELLIGENCE')
      ? requestObservation('domain', url, undefined, fetcher)
      : null,
    enabled('ENABLE_CONTENT_SCANNING')
      ? requestObservation('content', url, undefined, fetcher)
      : null,
  ]);
  if (domain) {
    analysis.domain = domain;
    Object.assign(
      analysis.checks.find((c) => c.name === 'Domain intelligence')!,
      {
        status: 'completed',
        source: 'Public DNS via isolated worker',
        observedAt: domain.observedAt,
        detail: `Public addresses: ${domain.addresses.join(', ')}. Address availability does not establish legitimacy.`,
      },
    );
    analysis.checks.push({
      name: 'Domain registration',
      status: domain.rdapStatus,
      source: 'Authoritative RDAP via IANA bootstrap',
      observedAt: domain.rdapStatus === 'completed' ? domain.observedAt : null,
      detail:
        domain.ageDays === null
          ? 'Registration age unavailable; missing data is not evidence of fraud.'
          : `Registered ${domain.registeredAt}; observed age ${domain.ageDays} days. Age alone does not establish fraud or safety.`,
    });
    analysis.limitations = analysis.limitations.filter(
      (l) => !l.startsWith('Only the submitted URL structure'),
    );
    analysis.limitations.push(
      'DNS and available registration metadata were checked. Domain age and HTTPS do not verify a business or its operator.',
    );
    if (domain.ageDays !== null && domain.ageDays < 30)
      analysis.signals.push({
        code: 'recent_domain_registration',
        label: 'Recently registered domain',
        severity: 'low',
        confidence: 'observation',
        source: 'Authoritative RDAP',
        observedAt: domain.observedAt,
        evidence: `Registration age ${domain.ageDays} days. New businesses and legitimate sites can also be recently registered.`,
      });
  }
  if (content) applyContentObservation(analysis, content);
  else if (enabled('ENABLE_CONTENT_SCANNING')) {
    Object.assign(
      analysis.checks.find((c) => c.name === 'Page content')!,
      {
        status: 'unavailable',
        source: 'Isolated static HTML worker',
        detail:
          'Page unavailable, blocked by scan policy, or worker timed out. This is not a clean result.',
      },
    );
    Object.assign(
      analysis.checks.find((c) => c.name === 'Cryptocurrency indicators')!,
      {
        status: 'unavailable',
        detail: 'Content unavailable; crypto-related claims and addresses could not be inspected.',
      },
    );
  }
  if (!domain && enabled('ENABLE_DOMAIN_INTELLIGENCE'))
    Object.assign(
      analysis.checks.find((c) => c.name === 'Domain intelligence')!,
      {
        detail:
          'Domain worker unavailable or DNS policy rejected the target. No registration or reachability claim can be made.',
      },
    );

  const findings: ProviderFinding[] = [];
  if (enabled('ENABLE_OPENPHISH')) findings.push(await openPhish.lookup(url));
  if (enabled('ENABLE_EXTERNAL_PROVIDERS') && process.env.SAFE_BROWSING_API_KEY)
    findings.push(await lookupSafeBrowsing(url, process.env.SAFE_BROWSING_API_KEY, fetcher));
  analysis.providers = findings;
  if (enabled('ENABLE_ML')) {
    const features = buildObservationFeatures(
      url,
      { domain: domain || undefined, content: content || undefined, providers: findings },
      getModelInfo().feature_version,
    );
    const prediction = await infer(features);
    if (prediction) applyModelPrediction(analysis, prediction);
  }
  // Remember independent screening evidence when a time-limited provider report expires.
  analysis.screeningCategory = analysis.category;
  analysis.screeningSummary = analysis.summary;
  if (findings.length) {
    const check = analysis.checks.find((c) => c.name === 'Threat intelligence')!;
    const positive = findings
      .filter((f) => f.reportedMalicious)
      .sort((a, b) => Date.parse(b.expiresAt || '') - Date.parse(a.expiresAt || ''))[0];
    Object.assign(check, {
      status: findings.every((f) => f.status === 'completed') ? 'completed' : 'unavailable',
      source: findings.map((f) => f.source).join(' + '),
      observedAt: new Date().toISOString(),
      detail: findings.map((f) => `${f.source}: ${f.detail}`).join(' '),
    });
    for (const finding of findings)
      analysis.checks.push({
        name: `Provider: ${finding.source}`,
        status: finding.status,
        source: finding.source,
        observedAt: finding.checkedAt,
        detail: finding.detail,
      });
    if (positive) {
      analysis.category = 'confirmed_malicious';
      analysis.providerExpiresAt = positive.expiresAt;
      analysis.providerSource = positive.source;
      analysis.summary = `${positive.source} reports this exact URL as a potential threat. Reports can contain errors; review the source and observation time.`;
      analysis.signals.push({
        code: 'reported_malicious_url',
        label: 'Exact URL reported as a potential threat',
        severity: 'high',
        evidence: positive.detail,
        source: positive.source,
        confidence: 'verified',
        observedAt: positive.checkedAt,
      });
    }
  }
  return analysis;
}
